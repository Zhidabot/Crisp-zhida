import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AppConfig } from './config.js';
import {
  buildCrispStatusResponse,
  mapCrispActionToNative,
  mapCrispMessageToNative,
  sendCrispTextMessage,
  verifyCrispAction,
  verifyCrispWebhook
} from './crisp.js';
import { methodNotAllowed, notFound, readRawBody, sendJSON, sendNoContent } from './http.js';
import { sendNativeEvent, verifyNativeCallback } from './native.js';
import { SessionStore } from './session-store.js';
import { CrispActionRequest, CrispEnvelope, NativeAssistantMessage } from './types.js';

export function createAdapterServer(config: AppConfig, sessionStore = new SessionStore(config.sessionStorePath)) {
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
      if (req.method === 'GET' && path === '/health') {
        sendJSON(res, 200, { ok: true });
        return;
      }
      if (path === '/webhooks/crisp') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        await handleCrispWebhook(config, sessionStore, req, res);
        return;
      }
      if (path === '/webhooks/crisp/action') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        await handleCrispAction(config, sessionStore, req, res);
        return;
      }
      if (path === '/webhooks/zhida') {
        if (req.method !== 'POST') return methodNotAllowed(res);
        await handleZhidaCallback(config, sessionStore, req, res);
        return;
      }
      notFound(res);
    } catch (err) {
      console.error('[adapter] request failed', err);
      sendJSON(res, 500, { error: 'internal_error', reason: (err as Error).message });
    }
  });
}

async function handleCrispWebhook(
  config: AppConfig,
  sessionStore: SessionStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawBody = await readRawBody(req);
  verifyCrispWebhook(config, req.headers, rawBody);
  const envelope = JSON.parse(rawBody) as CrispEnvelope;

  if (envelope.event !== 'message:send' && envelope.event !== 'message:received') {
    sendJSON(res, 200, { ignored: true, event: envelope.event });
    return;
  }
  if (envelope.event === 'message:received' && !config.forwardOperatorMessages) {
    sendJSON(res, 200, { ignored: true, reason: 'operator forwarding disabled' });
    return;
  }

  const mapped = mapCrispMessageToNative(config, envelope);
  if (!mapped.native) {
    sendJSON(res, 200, { ignored: true, reason: mapped.ignored });
    return;
  }
  await sessionStore.upsert({
    sessionID: mapped.sessionID,
    websiteID: mapped.websiteID,
    customerID: mapped.native.data.user.id,
    customerName: mapped.native.data.user.nickname
  });
  await sendNativeEvent(config, mapped.native);
  sendJSON(res, 200, { accepted: true });
}

async function handleCrispAction(
  config: AppConfig,
  sessionStore: SessionStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawBody = await readRawBody(req);
  verifyCrispAction(config, req.headers, rawBody);
  const actionRequest = JSON.parse(rawBody) as CrispActionRequest;
  const mapped = mapCrispActionToNative(config, actionRequest);
  if (mapped.websiteID) {
    await sessionStore.upsert({
      sessionID: mapped.sessionID,
      websiteID: mapped.websiteID
    });
  }
  const result = await sendNativeEvent(config, mapped.native);
  sendJSON(res, 200, buildCrispStatusResponse(result.ai_mode ?? mapped.mode));
}

async function handleZhidaCallback(
  config: AppConfig,
  sessionStore: SessionStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawBody = await readRawBody(req);
  verifyNativeCallback(config, req.headers, rawBody);
  const payload = JSON.parse(rawBody) as NativeAssistantMessage;
  if (payload.event !== 'message:assistant') {
    sendJSON(res, 200, { ignored: true, event: payload.event });
    return;
  }

  const sessionID = payload.data.session_id.trim();
  const text = (payload.data.content.text ?? '').trim();
  if (!sessionID || !text) {
    sendJSON(res, 400, { error: 'missing session_id or text' });
    return;
  }

  const session = await sessionStore.get(sessionID);
  const websiteID = session?.websiteID || config.crispWebsiteID;
  if (!websiteID) {
    sendJSON(res, 400, { error: 'unknown Crisp website_id for session', session_id: sessionID });
    return;
  }

  await sendCrispTextMessage(config, websiteID, sessionID, text);
  sendNoContent(res);
}
