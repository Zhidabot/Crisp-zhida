import test from 'node:test';
import assert from 'node:assert/strict';
import { AppConfig } from './config.js';
import {
  mapCrispMessageToNative,
  sendCrispTextMessage,
  verifyCrispWebhook
} from './crisp.js';
import { buildCrispSignature } from './signatures.js';

const baseConfig: AppConfig = {
  port: 8787,
  crispTokenIdentifier: 'crisp_identifier',
  crispTokenKey: 'crisp_key',
  crispWebhookSigningSecret: 'crisp_secret',
  crispWebsiteID: '',
  zhidaGatewayURL: 'https://zhida.example.com/v1/native/webhook',
  zhidaAccessKey: 'nk_live_xxx',
  zhidaSigningSecret: 'ns_live_secret',
  zhidaWebhookSecret: 'nwh_live_secret',
  botName: 'AI Assistant',
  botAvatar: '',
  forwardOperatorMessages: true,
  requestTimeoutMS: 15000,
  sessionStorePath: './data/test-sessions.json'
};

test('verifyCrispWebhook accepts millisecond timestamps and case-insensitive headers', () => {
  const now = Date.now;
  Date.now = () => 1712224800123;
  try {
    const body = '{"website_id":"site-1","event":"message:send","data":{}}';
    const timestamp = '1712224800123';
    verifyCrispWebhook(baseConfig, {
      'X-Crisp-Request-Timestamp': timestamp,
      'X-Crisp-Signature': buildCrispSignature(baseConfig.crispWebhookSigningSecret, timestamp, body)
    }, body);
  } finally {
    Date.now = now;
  }
});

test('mapCrispMessageToNative maps visitor text into Native message:send', () => {
  const mapped = mapCrispMessageToNative(baseConfig, {
    website_id: 'site-1',
    event: 'message:send',
    data: {
      website_id: 'site-1',
      session_id: 'session-1',
      type: 'text',
      content: ' hello ',
      timestamp: 1712224800,
      fingerprint: 12345,
      from: 'user',
      user: {
        user_id: 'visitor-1',
        nickname: 'Visitor'
      }
    }
  });

  assert.equal(mapped.ignored, undefined);
  assert.equal(mapped.websiteID, 'site-1');
  assert.equal(mapped.sessionID, 'session-1');
  assert.equal(mapped.native.event, 'message:send');
  assert.equal(mapped.native.token, 'nk_live_xxx');
  assert.equal(mapped.native.data.token, 'nk_live_xxx');
  assert.equal(mapped.native.data.content.text, 'hello');
  assert.equal(mapped.native.data.fingerprint, 'crisp:message:send:site-1:session-1:12345');
});

test('mapCrispMessageToNative maps accepted operator text into Native message:received', () => {
  const mapped = mapCrispMessageToNative(baseConfig, {
    website_id: 'site-1',
    event: 'message:received',
    data: {
      website_id: 'site-1',
      session_id: 'session-1',
      type: 'text',
      origin: 'chat',
      content: ' manual reply ',
      timestamp: 1712224800,
      fingerprint: 67890,
      from: 'operator',
      user: {
        type: 'operator',
        user_id: 'operator-1',
        nickname: 'Agent'
      }
    }
  });

  assert.equal(mapped.ignored, undefined);
  assert.equal(mapped.native.event, 'message:received');
  assert.equal(mapped.native.data.user.id, 'operator-1');
  assert.equal(mapped.native.data.content.text, 'manual reply');
});

test('mapCrispMessageToNative ignores bot display-name message:received to avoid reply loops', () => {
  const mapped = mapCrispMessageToNative(baseConfig, {
    website_id: 'site-1',
    event: 'message:received',
    data: {
      website_id: 'site-1',
      session_id: 'session-1',
      type: 'text',
      origin: 'chat',
      content: 'AI reply',
      timestamp: 1712224800,
      fingerprint: 67891,
      from: 'operator',
      user: {
        type: 'operator',
        user_id: 'operator-1',
        nickname: 'AI Assistant'
      }
    }
  });

  assert.equal(mapped.ignored, 'bot display name');
  assert.equal(mapped.native, undefined);
});

test('mapCrispMessageToNative ignores visitor-like message:received', () => {
  const mapped = mapCrispMessageToNative(baseConfig, {
    website_id: 'site-1',
    event: 'message:received',
    data: {
      website_id: 'site-1',
      session_id: 'session_visitor',
      type: 'text',
      origin: 'chat',
      content: 'visitor echo',
      timestamp: 1712224800,
      fingerprint: 67892,
      from: 'operator',
      user: {
        type: 'session',
        user_id: 'session_visitor',
        nickname: 'Visitor'
      }
    }
  });

  assert.equal(mapped.ignored, 'visitor-like actor');
  assert.equal(mapped.native, undefined);
});

test('sendCrispTextMessage omits empty avatar while preserving bot nickname', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = '';
  let capturedAuthorization = '';
  try {
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      capturedAuthorization = String(init?.headers && (init.headers as Record<string, string>).Authorization);
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    await sendCrispTextMessage(baseConfig, 'site-1', 'session-1', 'hello');

    const body = JSON.parse(capturedBody) as Record<string, unknown>;
    assert.equal(body.type, 'text');
    assert.equal(body.content, 'hello');
    assert.deepEqual(body.user, { nickname: 'AI Assistant' });
    assert.match(capturedAuthorization, /^Basic /);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
