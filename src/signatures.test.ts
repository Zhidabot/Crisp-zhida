import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCrispSignature,
  buildNativeCallbackSignature,
  buildNativeRequestSignature,
  canonicalizeCrispActionBody,
  verifyFreshTimestamp
} from './signatures.js';

test('buildNativeRequestSignature matches gateway implementation', () => {
  const body = '{"event":"message:send","timestamp":1712224800,"token":"nk_live_xxx","data":{"fingerprint":"fp_001"}}';
  const got = buildNativeRequestSignature('ns_live_secret', 1712224800, 'nonce-001', 'post', '/v1/native/webhook', body);
  assert.equal(got, 'v1=e57ce62cd2da859c983486476c5dc234afa9b822ca2d8bd75bdb24d27a9c2138');
});

test('buildNativeCallbackSignature matches gateway implementation', () => {
  const body = '{"event":"message:assistant","timestamp":1712224810,"data":{"fingerprint":"fp_asst_001","session_id":"ticket_12345","content":{"text":"hello"}}}';
  const got = buildNativeCallbackSignature('nwh_live_secret', 'fp_asst_001', 1712224810, body);
  assert.equal(got, 'v1=d370d66ac81bc9540fcbe7c7944a9b0dab155f06c554d94d4994f39dcc350075');
});

test('buildCrispSignature uses Crisp trace format', () => {
  const got = buildCrispSignature('secret', '1712224800', '{"hello":"world"}');
  assert.equal(got, 'dd37c9bd9aa9e25b204af813b82dbc0ae0824fbf78cf440be32cf49f451204ea');
});

test('canonicalizeCrispActionBody compacts JSON without reordering keys', () => {
  const got = canonicalizeCrispActionBody('{\n  "action": "session.ai_reply.toggle",\n  "data": {"enabled": true}\n}');
  assert.equal(got, '{"action":"session.ai_reply.toggle","data":{"enabled":true}}');
});

test('verifyFreshTimestamp accepts second and millisecond timestamps', () => {
  const now = Date.now;
  Date.now = () => 1712224800123;
  try {
    assert.equal(verifyFreshTimestamp(1712224800), true);
    assert.equal(verifyFreshTimestamp(1712224800123), true);
    assert.equal(verifyFreshTimestamp(1712225800123), false);
  } finally {
    Date.now = now;
  }
});
