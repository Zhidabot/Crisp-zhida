# Zhida Crisp Adapter Deployment Guide

This guide explains how to connect Crisp to Zhida. After deployment, visitor messages in Crisp are sent to Zhida, and Zhida replies are posted back to the matching Crisp conversation.

## 1. Prerequisites

Prepare the following before deployment:

| Item | Description |
| --- | --- |
| Server | A Linux server reachable from the public internet |
| Domain | For example, `https://crisp-adapter.example.com` |
| Runtime | Docker is recommended; Node.js 20+ is also supported |
| Crisp plugin credentials | `Token Identifier`, `Token Key`, `Webhook Signing Secret` |
| Zhida integration credentials | `Access Key`, `Signing Secret`, `Webhook Secret` |

Use an HTTPS domain in production. Avoid configuring a raw IP address and port in the Crisp dashboard.

## 2. URLs To Configure

You will use 4 URLs:

| URL | Example | Purpose |
| --- | --- | --- |
| Crisp Webhook URL | `https://crisp-adapter.example.com/webhooks/crisp` | Crisp sends visitor events here |
| Crisp Action URL | `https://crisp-adapter.example.com/webhooks/crisp/action` | Crisp calls this when panel buttons are clicked |
| Zhida Callback URL | `https://crisp-adapter.example.com/webhooks/zhida` | Zhida sends AI replies back here |
| Zhida Gateway URL | `https://your-zhida-domain/v1/native/webhook` | The adapter sends Crisp messages to this URL |

The first three URLs belong to this adapter. The last URL belongs to your Zhida service.

## 3. Download The Code

```bash
git clone https://github.com/Zhidabot/Crisp-zhida.git
cd Crisp-zhida
```

## 4. Configure Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=8787

CRISP_TOKEN_IDENTIFIER=your_crisp_token_identifier
CRISP_TOKEN_KEY=your_crisp_token_key
CRISP_WEBHOOK_SIGNING_SECRET=your_crisp_webhook_signing_secret

ZHIDA_GATEWAY_URL=https://your-zhida-domain/v1/native/webhook
ZHIDA_ACCESS_KEY=your_zhida_access_key
ZHIDA_SIGNING_SECRET=your_zhida_signing_secret
ZHIDA_WEBHOOK_SECRET=your_zhida_webhook_secret

BOT_NAME=AI Assistant
BOT_AVATAR=

FORWARD_OPERATOR_MESSAGES=true
REQUEST_TIMEOUT_MS=15000
SESSION_STORE_PATH=./data/sessions.json
```

Field reference:

| Field | Required | Description |
| --- | --- | --- |
| `PORT` | No | Local listening port. Default: `8787` |
| `CRISP_TOKEN_IDENTIFIER` | Yes | Crisp plugin Token Identifier |
| `CRISP_TOKEN_KEY` | Yes | Crisp plugin Token Key |
| `CRISP_WEBHOOK_SIGNING_SECRET` | Yes | Crisp webhook signing secret |
| `CRISP_WEBSITE_ID` | No | Optional when the adapter handles only one Crisp website |
| `ZHIDA_GATEWAY_URL` | Yes | Zhida Native gateway URL |
| `ZHIDA_ACCESS_KEY` | Yes | Access key for the Zhida Native integration |
| `ZHIDA_SIGNING_SECRET` | Yes | Secret used to sign requests sent to Zhida |
| `ZHIDA_WEBHOOK_SECRET` | Yes | Secret used to verify callbacks from Zhida |
| `BOT_NAME` | No | Display name for AI replies in Crisp |
| `BOT_AVATAR` | No | Avatar URL for AI replies in Crisp |
| `FORWARD_OPERATOR_MESSAGES` | No | Whether to forward operator messages. Default: `true` |
| `REQUEST_TIMEOUT_MS` | No | Request timeout. Default: `15000` |
| `SESSION_STORE_PATH` | No | Session mapping file. Default: `./data/sessions.json` |

Keep `.env` private and only place real credential values on your own server.

## 5. Configure The Zhida Native Integration

Create a Native / third-party integration in the Zhida dashboard.

Set the Webhook URL to:

```text
https://crisp-adapter.example.com/webhooks/zhida
```

After saving, copy these values from Zhida into `.env`:

```env
ZHIDA_ACCESS_KEY=...
ZHIDA_SIGNING_SECRET=...
ZHIDA_WEBHOOK_SECRET=...
```

## 6. Configure The Crisp Plugin

In the Crisp plugin dashboard, set the Webhook URL:

```text
https://crisp-adapter.example.com/webhooks/crisp
```

Set the Action URL:

```text
https://crisp-adapter.example.com/webhooks/crisp/action
```

Use the project file below as the conversation widget definition:

```text
plugin_widget.json
```

The panel shows the AI status and provides buttons to enable or disable AI replies.

## 7. Run With Docker

Docker is recommended for deployment:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f crisp-adapter
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Expected response:

```json
{"ok":true}
```

Common maintenance commands:

```bash
docker compose restart crisp-adapter
docker compose stop crisp-adapter
docker compose up -d --build
```

## 8. Run With Node.js

If you do not use Docker:

```bash
npm install
npm run build
npm start
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

For long-running production use, Docker, PM2, or systemd is recommended.

## 9. Configure HTTPS Reverse Proxy

The following Nginx example assumes the adapter listens on `127.0.0.1:8787`:

```nginx
server {
    listen 443 ssl http2;
    server_name crisp-adapter.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After configuring the reverse proxy, check public access:

```bash
curl https://crisp-adapter.example.com/health
```

Expected response:

```json
{"ok":true}
```

## 10. Go-Live Verification

Check in this order:

1. Local health check passes:

   ```bash
   curl http://127.0.0.1:8787/health
   ```

2. Public health check passes:

   ```bash
   curl https://crisp-adapter.example.com/health
   ```

3. Send a visitor message in Crisp.

4. Check adapter logs:

   ```bash
   docker compose logs -f crisp-adapter
   ```

5. Confirm that Zhida receives the conversation.

6. Confirm that the AI reply appears in the Crisp conversation.

If step 2 fails, check DNS, HTTPS certificate, firewall, and reverse proxy configuration first.

If step 5 fails, check `ZHIDA_GATEWAY_URL`, `ZHIDA_ACCESS_KEY`, and `ZHIDA_SIGNING_SECRET`.

If step 6 fails, check `ZHIDA_WEBHOOK_SECRET`, `CRISP_TOKEN_IDENTIFIER`, and `CRISP_TOKEN_KEY`.

## 11. Session State File

The adapter stores the mapping between Crisp sessions and websites:

```text
data/sessions.json
```

Docker deployment mounts this path by default:

```yaml
volumes:
  - ./data:/app/data
```

Do not delete `data/sessions.json` during normal operation. If it is deleted, replies for older sessions may no longer map to the correct Crisp website.

## 12. Troubleshooting

### Crisp returns `invalid Crisp signature`

Check:

- `CRISP_WEBHOOK_SIGNING_SECRET` is correct
- The Signing Secret in the Crisp plugin dashboard matches `.env`
- The reverse proxy does not modify the request body

### Zhida gateway returns 401

Check:

- `ZHIDA_ACCESS_KEY`
- `ZHIDA_SIGNING_SECRET`
- `ZHIDA_GATEWAY_URL`
- Server time is accurate

The signature includes a timestamp. A large server time drift can cause verification failure.

### AI replies do not appear in Crisp

Check:

- The Zhida Native integration Webhook URL is `/webhooks/zhida`
- `ZHIDA_WEBHOOK_SECRET` is correct
- `CRISP_TOKEN_IDENTIFIER` and `CRISP_TOKEN_KEY` are correct
- `data/sessions.json` contains the matching session

### Should operator messages be forwarded?

This is controlled by:

```env
FORWARD_OPERATOR_MESSAGES=true
```

Set it to `false` to forward only visitor messages.

### How are AI replies prevented from being forwarded again?

The adapter ignores Crisp operator messages whose nickname equals `BOT_NAME`. Make sure `BOT_NAME` matches the AI display name in Crisp.

## 13. Upgrade

Pull the latest code and rebuild:

```bash
git pull
docker compose up -d --build
```

Back up configuration and session state before upgrading:

```bash
cp .env .env.bak
cp -r data data.bak
```
