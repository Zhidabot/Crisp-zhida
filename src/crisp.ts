import { AppConfig } from './config.js';
import {
  buildCrispSignature,
  canonicalizeCrispActionBody,
  verifyFreshTimestamp,
  verifySignature
} from './signatures.js';
import {
  CrispActionRequest,
  CrispEnvelope,
  CrispMessageData,
  NativeActionControlData,
  NativeEnvelope,
  NativeMessageData
} from './types.js';

type CrispMessageMapping =
  | {
      native: NativeEnvelope<NativeMessageData>;
      websiteID: string;
      sessionID: string;
      ignored?: undefined;
    }
  | {
      ignored: string;
      websiteID: string;
      sessionID: string;
      native?: undefined;
    };

export function verifyCrispWebhook(config: AppConfig, headers: Record<string, string | string[] | undefined>, rawBody: string): void {
  verifyCrispSignedBody(config, headers, rawBody);
}

export function verifyCrispAction(config: AppConfig, headers: Record<string, string | string[] | undefined>, rawBody: string): void {
  verifyCrispSignedBody(config, headers, canonicalizeCrispActionBody(rawBody));
}

export function mapCrispMessageToNative(
  config: AppConfig,
  envelope: CrispEnvelope
): CrispMessageMapping {
  const data = asRecord(envelope.data) as CrispMessageData;
  const websiteID = stringValue(data.website_id) || stringValue(envelope.website_id) || config.crispWebsiteID;
  const sessionID = stringValue(data.session_id);
  if (!websiteID || !sessionID) {
    return ignoredMessage('missing website_id or session_id');
  }
  if (data.automated === true) {
    return ignoredMessage('automated crisp message');
  }

  const event = stringValue(envelope.event);
  const from = stringValue(data.from).toLowerCase();
  if (event === 'message:send' && from && from !== 'user') {
    return ignoredMessage(`ignored non-user message: ${from}`);
  }
  if (event === 'message:received') {
    const receivedDecision = classifyReceivedMessage(config, sessionID, data);
    if (receivedDecision) return ignoredMessage(receivedDecision);
  }

  const content = toNativeContent(data);
  if (!content.text && (!content.attachments || content.attachments.length === 0)) {
    return ignoredMessage('empty or unsupported message content');
  }

  const now = Math.floor(Date.now() / 1000);
  const timestamp = numberValue(data.timestamp) || numberValue(envelope.timestamp) || now;
  const fingerprint = buildCrispFingerprint(event, websiteID, sessionID, data.fingerprint, timestamp);
  const userID = stringValue(data.user?.user_id) || sessionID;
  const nickname = stringValue(data.user?.nickname);

  return {
    websiteID,
    sessionID,
    native: {
      event: event === 'message:received' ? 'message:received' : 'message:send',
      timestamp,
      token: config.zhidaAccessKey,
      data: {
        fingerprint,
        timestamp,
        token: config.zhidaAccessKey,
        session_id: sessionID,
        user: {
          id: userID,
          nickname
        },
        content
      }
    }
  };

  function ignoredMessage(reason: string): CrispMessageMapping {
    return { websiteID, sessionID, ignored: reason };
  }
}

export function mapCrispActionToNative(
  config: AppConfig,
  actionRequest: CrispActionRequest
): { native: NativeEnvelope<NativeActionControlData>; mode: 'auto' | 'manual'; sessionID: string; websiteID: string } {
  const sessionID = resolveActionSessionID(actionRequest);
  const websiteID = resolveActionWebsiteID(actionRequest) || config.crispWebsiteID;
  if (!sessionID) {
    throw new Error('missing Crisp action session_id');
  }

  const enabled = resolveActionEnabled(actionRequest);
  const action = enabled === undefined ? 'refresh_status' : enabled ? 'enable_ai' : 'disable_ai';
  const mode = action === 'disable_ai' ? 'manual' : 'auto';
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    mode,
    sessionID,
    websiteID,
    native: {
      event: 'action:control',
      timestamp,
      token: config.zhidaAccessKey,
      data: {
        fingerprint: `crisp:action:${sessionID}:${timestamp}`,
        timestamp,
        token: config.zhidaAccessKey,
        session_id: sessionID,
        action,
        user: {
          id: 'crisp_action',
          nickname: 'Crisp Action'
        }
      }
    }
  };
}

export function buildCrispStatusResponse(mode: string): Record<string, unknown> {
  const normalized = mode === 'manual' ? 'manual' : 'auto';
  return {
    data: {
      value: normalized
    },
    targets: [
      {
        section_id: 'ai_section',
        item_id: 'status',
        value: {
          value: normalized
        }
      },
      {
        section_id: 'ai_section',
        item_id: 'enable_ai',
        value: {
          visible: normalized === 'manual'
        }
      },
      {
        section_id: 'ai_section',
        item_id: 'disable_ai',
        value: {
          visible: normalized === 'auto'
        }
      }
    ]
  };
}

export async function sendCrispTextMessage(
  config: AppConfig,
  websiteID: string,
  sessionID: string,
  text: string
): Promise<void> {
  const body: Record<string, unknown> = {
    type: 'text',
    from: 'operator',
    origin: 'chat',
    content: text.trim()
  };
  if (config.botName || config.botAvatar) {
    const user: Record<string, string> = {};
    if (config.botName) user.nickname = config.botName;
    if (config.botAvatar) user.avatar = config.botAvatar;
    body.user = user;
  }

  const response = await fetch(
    `https://api.crisp.chat/v1/website/${encodeURIComponent(websiteID)}/conversation/${encodeURIComponent(sessionID)}/message`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.crispTokenIdentifier}:${config.crispTokenKey}`).toString('base64')}`,
        'X-Crisp-Tier': 'plugin',
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(config.requestTimeoutMS),
      body: JSON.stringify(body)
    }
  );
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Crisp send failed: status=${response.status} body=${responseText}`);
  }
}

function verifyCrispSignedBody(
  config: AppConfig,
  headers: Record<string, string | string[] | undefined>,
  bodyForSignature: string
): void {
  const timestamp = headerValue(headers, 'x-crisp-request-timestamp');
  const signature = headerValue(headers, 'x-crisp-signature');
  if (!timestamp || !signature) {
    throw new Error('missing Crisp signature headers');
  }
  const numericTimestamp = Number.parseInt(timestamp, 10);
  if (!verifyFreshTimestamp(numericTimestamp)) {
    throw new Error('expired Crisp request');
  }
  const expected = buildCrispSignature(config.crispWebhookSigningSecret, timestamp, bodyForSignature);
  if (!verifySignature(expected, signature.toLowerCase())) {
    throw new Error('invalid Crisp signature');
  }
}

function toNativeContent(data: CrispMessageData): NativeMessageData['content'] {
  const type = stringValue(data.type).toLowerCase();
  if (type === 'text') {
    return { text: typeof data.content === 'string' ? data.content.trim() : '' };
  }
  const media = asRecord(data.content);
  const url = stringValue(media.url);
  const mimeType = stringValue(media.type);
  if (!url || !mimeType) return {};
  if (type === 'audio' || mimeType.toLowerCase().startsWith('audio/')) {
    return { attachments: [{ type: 'audio', url, mime_type: mimeType }] };
  }
  if (type === 'animation' || mimeType.toLowerCase().startsWith('image/')) {
    return { attachments: [{ type: 'image', url, mime_type: mimeType }] };
  }
  return {};
}

function classifyReceivedMessage(config: AppConfig, sessionID: string, data: CrispMessageData): string {
  if (data.automated === true) return 'automated crisp message';
  if (stringValue(data.type).toLowerCase() !== 'text') return 'unsupported received message type';
  if (stringValue(data.origin).toLowerCase() !== 'chat') return 'unsupported received origin';
  if (stringValue(data.from).toLowerCase() !== 'operator') return 'ignored non-operator message';

  const actorID = stringValue(data.user?.user_id);
  if (!actorID) return 'missing operator actor id';
  if (isLikelyCrispVisitorActor(sessionID, data.user)) return 'visitor-like actor';
  if (isCrispBotNickname(data.user?.nickname, config.botName)) return 'bot display name';
  return '';
}

function isLikelyCrispVisitorActor(sessionID: string, user: CrispMessageData['user']): boolean {
  if (!user) return false;
  if (stringValue(user.type).toLowerCase() === 'session') return true;
  const userID = stringValue(user.user_id);
  if (!userID) return false;
  return userID.toLowerCase() === sessionID.trim().toLowerCase() || userID.toLowerCase().startsWith('session_');
}

function isCrispBotNickname(nickname: unknown, botName: string): boolean {
  const normalizedNickname = stringValue(nickname);
  const normalizedBotName = botName.trim();
  return !!normalizedNickname && !!normalizedBotName && normalizedNickname.toLowerCase() === normalizedBotName.toLowerCase();
}

function buildCrispFingerprint(event: string, websiteID: string, sessionID: string, fingerprint: unknown, timestamp: number): string {
  const suffix = stringValue(fingerprint) || String(timestamp);
  return `crisp:${event}:${websiteID}:${sessionID}:${suffix}`;
}

function resolveActionEnabled(req: CrispActionRequest): boolean | undefined {
  if (typeof req.payload?.enabled === 'boolean') return req.payload.enabled;
  const payloadMode = normalizeMode(req.payload?.mode);
  if (payloadMode !== undefined) return payloadMode;
  const payloadData = req.payload?.data ?? {};
  const data = req.data ?? {};
  const payloadDataMode = normalizeMode(payloadData.mode);
  if (payloadDataMode !== undefined) return payloadDataMode;
  if (typeof payloadData.enabled === 'boolean') return payloadData.enabled;
  const dataMode = normalizeMode(data.mode);
  if (dataMode !== undefined) return dataMode;
  if (typeof data.enabled === 'boolean') return data.enabled;
  return undefined;
}

function resolveActionWebsiteID(req: CrispActionRequest): string {
  return stringValue(req.website_id) ||
    stringValue(req.origin?.website_id) ||
    stringValue(req.payload?.data?.website_id) ||
    stringValue(req.data?.website_id);
}

function resolveActionSessionID(req: CrispActionRequest): string {
  return stringValue(req.session_id) ||
    stringValue(req.origin?.session_id) ||
    stringValue(req.payload?.session_id) ||
    stringValue(req.payload?.data?.session_id) ||
    stringValue(req.data?.session_id);
}

function normalizeMode(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  switch (value.trim().toLowerCase()) {
    case 'on':
    case 'auto':
    case 'enable':
    case 'enabled':
    case 'true':
      return true;
    case 'off':
    case 'manual':
    case 'disable':
    case 'disabled':
    case 'false':
      return false;
    default:
      return undefined;
  }
}

function headerValue(headers: Record<string, string | string[] | undefined>, key: string): string {
  const value = getHeaderValue(headers, key);
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').trim();
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, key: string): string | string[] | undefined {
  const lowerKey = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === lowerKey) return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
