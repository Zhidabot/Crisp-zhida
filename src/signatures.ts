import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export function buildNativeRequestSignature(
  secret: string,
  timestamp: number,
  nonce: string,
  method: string,
  path: string,
  rawBody: string
): string {
  const payload = `${timestamp}.${nonce.trim()}.${method.trim().toUpperCase()}.${path.trim()}.${rawBody}`;
  return `v1=${hmacHex(secret, payload)}`;
}

export function buildNativeCallbackSignature(secret: string, fingerprint: string, timestamp: number, rawBody: string): string {
  const payload = `${fingerprint.trim()}.${timestamp}.${rawBody}`;
  return `v1=${hmacHex(secret, payload)}`;
}

export function buildCrispSignature(secret: string, timestamp: string, rawBody: string): string {
  return hmacHex(secret, `[${timestamp.trim()};${rawBody}]`);
}

export function canonicalizeCrispActionBody(rawBody: string): string {
  return JSON.stringify(JSON.parse(rawBody)) ?? '';
}

export function verifySignature(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected.trim());
  const actualBuffer = Buffer.from(actual.trim());
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyFreshTimestamp(timestamp: number, toleranceSeconds = 300): boolean {
  const normalized = normalizeUnixTimestampSeconds(timestamp);
  if (!normalized) return false;
  const drift = Math.floor(Date.now() / 1000) - normalized;
  return drift <= toleranceSeconds && drift >= -toleranceSeconds;
}

export function newNonce(): string {
  return randomUUID();
}

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret.trim()).update(payload).digest('hex');
}

function normalizeUnixTimestampSeconds(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  if (timestamp >= 1_000_000_000_000) {
    return Math.floor(timestamp / 1000);
  }
  return Math.floor(timestamp);
}
