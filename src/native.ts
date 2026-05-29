import { URL } from 'node:url';
import { AppConfig } from './config.js';
import {
  NativeActionControlData,
  NativeEnvelope,
  NativeMessageData
} from './types.js';
import {
  buildNativeCallbackSignature,
  buildNativeRequestSignature,
  newNonce,
  verifyFreshTimestamp,
  verifySignature
} from './signatures.js';

export interface NativeGatewayResult {
  accepted?: boolean;
  ai_mode?: string;
  raw: unknown;
}

export async function sendNativeEvent(
  config: AppConfig,
  envelope: NativeEnvelope<NativeMessageData | NativeActionControlData>
): Promise<NativeGatewayResult> {
  const rawBody = JSON.stringify(envelope);
  const gatewayURL = new URL(config.zhidaGatewayURL);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = newNonce();
  const signature = buildNativeRequestSignature(
    config.zhidaSigningSecret,
    timestamp,
    nonce,
    'POST',
    gatewayURL.pathname,
    rawBody
  );

  const response = await fetch(gatewayURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ZHIDA-Access-Key': config.zhidaAccessKey,
      'X-ZHIDA-Timestamp': String(timestamp),
      'X-ZHIDA-Nonce': nonce,
      'X-ZHIDA-Signature': signature
    },
    signal: AbortSignal.timeout(config.requestTimeoutMS),
    body: rawBody
  });

  const text = await response.text();
  let parsed: unknown = text;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    throw new Error(`ZHIDA gateway failed: status=${response.status} body=${text}`);
  }
  return normalizeGatewayResult(parsed);
}

export function verifyNativeCallback(config: AppConfig, headers: HeadersLike, rawBody: string): void {
  const fingerprint = headerValue(headers, 'x-zhida-fingerprint');
  const timestampRaw = headerValue(headers, 'x-zhida-timestamp');
  const signature = headerValue(headers, 'x-zhida-signature');
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!fingerprint || !timestampRaw || !signature) {
    throw new Error('missing ZHIDA callback signature headers');
  }
  if (!verifyFreshTimestamp(timestamp)) {
    throw new Error('expired ZHIDA callback');
  }
  const expected = buildNativeCallbackSignature(config.zhidaWebhookSecret, fingerprint, timestamp, rawBody);
  if (!verifySignature(expected, signature)) {
    throw new Error('invalid ZHIDA callback signature');
  }
}

type HeadersLike = Record<string, string | string[] | undefined>;

function headerValue(headers: HeadersLike, key: string): string {
  const value = getHeaderValue(headers, key);
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').trim();
}

function getHeaderValue(headers: HeadersLike, key: string): string | string[] | undefined {
  const lowerKey = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === lowerKey) return value;
  }
  return undefined;
}

function normalizeGatewayResult(raw: unknown): NativeGatewayResult {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const data = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj;
    return {
      accepted: typeof data.accepted === 'boolean' ? data.accepted : undefined,
      ai_mode: typeof data.ai_mode === 'string' ? data.ai_mode : undefined,
      raw
    };
  }
  return { raw };
}
