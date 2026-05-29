import { loadConfig } from './config.js';
import { createAdapterServer } from './server.js';

const config = loadConfig();
const server = createAdapterServer(config);

server.listen(config.port, () => {
  console.log(`[adapter] listening on :${config.port}`);
  console.log('[adapter] Crisp webhook: /webhooks/crisp');
  console.log('[adapter] Crisp action:  /webhooks/crisp/action');
  console.log('[adapter] ZHIDA callback: /webhooks/zhida');
});
