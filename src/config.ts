export interface AppConfig {
  port: number;
  crispTokenIdentifier: string;
  crispTokenKey: string;
  crispWebhookSigningSecret: string;
  crispWebsiteID: string;
  zhidaGatewayURL: string;
  zhidaAccessKey: string;
  zhidaSigningSecret: string;
  zhidaWebhookSecret: string;
  botName: string;
  botAvatar: string;
  forwardOperatorMessages: boolean;
  requestTimeoutMS: number;
  sessionStorePath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config: AppConfig = {
    port: numberFromEnv(env.PORT, 8787),
    crispTokenIdentifier: stringFromEnv(env.CRISP_TOKEN_IDENTIFIER),
    crispTokenKey: stringFromEnv(env.CRISP_TOKEN_KEY),
    crispWebhookSigningSecret: stringFromEnv(env.CRISP_WEBHOOK_SIGNING_SECRET),
    crispWebsiteID: stringFromEnv(env.CRISP_WEBSITE_ID),
    zhidaGatewayURL: stringFromEnv(env.ZHIDA_GATEWAY_URL),
    zhidaAccessKey: stringFromEnv(env.ZHIDA_ACCESS_KEY),
    zhidaSigningSecret: stringFromEnv(env.ZHIDA_SIGNING_SECRET),
    zhidaWebhookSecret: stringFromEnv(env.ZHIDA_WEBHOOK_SECRET),
    botName: stringFromEnv(env.BOT_NAME, 'AI Assistant'),
    botAvatar: stringFromEnv(env.BOT_AVATAR),
    forwardOperatorMessages: boolFromEnv(env.FORWARD_OPERATOR_MESSAGES, true),
    requestTimeoutMS: numberFromEnv(env.REQUEST_TIMEOUT_MS, 15000),
    sessionStorePath: stringFromEnv(env.SESSION_STORE_PATH, './data/sessions.json')
  };
  validateConfig(config);
  return config;
}

function validateConfig(config: AppConfig): void {
  const missing = [
    ['CRISP_TOKEN_IDENTIFIER', config.crispTokenIdentifier],
    ['CRISP_TOKEN_KEY', config.crispTokenKey],
    ['CRISP_WEBHOOK_SIGNING_SECRET', config.crispWebhookSigningSecret],
    ['ZHIDA_GATEWAY_URL', config.zhidaGatewayURL],
    ['ZHIDA_ACCESS_KEY', config.zhidaAccessKey],
    ['ZHIDA_SIGNING_SECRET', config.zhidaSigningSecret],
    ['ZHIDA_WEBHOOK_SECRET', config.zhidaWebhookSecret]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.map(([key]) => key).join(', ')}`);
  }
}

function stringFromEnv(value: string | undefined, fallback = ''): string {
  return (value ?? fallback).trim();
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}
