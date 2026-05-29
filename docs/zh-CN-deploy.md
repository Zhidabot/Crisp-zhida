# 智答 Crisp 适配器部署教程

本文说明如何把 Crisp 接入智答。部署完成后，Crisp 里的访客消息会进入智答，智答生成回复后会自动回到对应的 Crisp 会话。

## 一、部署前准备

你需要准备以下信息：

| 项目 | 说明 |
| --- | --- |
| 服务器 | 一台可以被公网访问的 Linux 服务器 |
| 域名 | 例如 `https://crisp-adapter.example.com` |
| 运行环境 | 推荐 Docker，也可以使用 Node.js 20+ |
| Crisp 插件凭据 | `Token Identifier`、`Token Key`、`Webhook Signing Secret` |
| 智答接入凭据 | `Access Key`、`Signing Secret`、`Webhook Secret` |

建议生产环境使用 HTTPS 域名访问，不要直接把裸 IP 和端口填到 Crisp 后台。

## 二、需要配置的地址

部署时会用到 4 个地址：

| 地址 | 示例 | 用途 |
| --- | --- | --- |
| Crisp Webhook URL | `https://crisp-adapter.example.com/webhooks/crisp` | Crisp 把访客消息发到这里 |
| Crisp Action URL | `https://crisp-adapter.example.com/webhooks/crisp/action` | Crisp 面板按钮点击时调用 |
| 智答回调地址 | `https://crisp-adapter.example.com/webhooks/zhida` | 智答把 AI 回复发回这里 |
| 智答网关地址 | `https://你的智答域名/v1/native/webhook` | 适配器把 Crisp 消息发到这里 |

前三个地址属于本适配器；最后一个地址属于智答服务。

## 三、下载代码

```bash
git clone https://github.com/Zhidabot/Crisp-zhida.git
cd Crisp-zhida
```

## 四、填写配置

复制配置模板：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
PORT=8787

CRISP_TOKEN_IDENTIFIER=你的_Crisp_Token_Identifier
CRISP_TOKEN_KEY=你的_Crisp_Token_Key
CRISP_WEBHOOK_SIGNING_SECRET=你的_Crisp_Webhook_Signing_Secret

ZHIDA_GATEWAY_URL=https://你的智答域名/v1/native/webhook
ZHIDA_ACCESS_KEY=智答后台生成的_Access_Key
ZHIDA_SIGNING_SECRET=智答后台生成的_Signing_Secret
ZHIDA_WEBHOOK_SECRET=智答后台生成的_Webhook_Secret

BOT_NAME=AI Assistant
BOT_AVATAR=

FORWARD_OPERATOR_MESSAGES=true
REQUEST_TIMEOUT_MS=15000
SESSION_STORE_PATH=./data/sessions.json
```

配置说明：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `PORT` | 否 | 本服务监听端口，默认 `8787` |
| `CRISP_TOKEN_IDENTIFIER` | 是 | Crisp 插件 Token Identifier |
| `CRISP_TOKEN_KEY` | 是 | Crisp 插件 Token Key |
| `CRISP_WEBHOOK_SIGNING_SECRET` | 是 | Crisp Webhook 签名密钥 |
| `CRISP_WEBSITE_ID` | 否 | 只接一个 Crisp 站点时可以填写；通常可以留空 |
| `ZHIDA_GATEWAY_URL` | 是 | 智答 Native 网关地址 |
| `ZHIDA_ACCESS_KEY` | 是 | 智答 Native 接入的 Access Key |
| `ZHIDA_SIGNING_SECRET` | 是 | 请求智答网关时使用的签名密钥 |
| `ZHIDA_WEBHOOK_SECRET` | 是 | 校验智答回调时使用的密钥 |
| `BOT_NAME` | 否 | AI 回复在 Crisp 中显示的名字 |
| `BOT_AVATAR` | 否 | AI 回复头像 URL |
| `FORWARD_OPERATOR_MESSAGES` | 否 | 是否同步人工客服消息，默认 `true` |
| `REQUEST_TIMEOUT_MS` | 否 | 请求超时时间，默认 `15000` |
| `SESSION_STORE_PATH` | 否 | 会话映射保存路径，默认 `./data/sessions.json` |

## 五、配置智答 Native 接入

在智答后台创建 Native / 第三方接入。

Webhook URL 填：

```text
https://crisp-adapter.example.com/webhooks/zhida
```

保存后，把智答生成的以下 3 个值填入 `.env`：

```env
ZHIDA_ACCESS_KEY=...
ZHIDA_SIGNING_SECRET=...
ZHIDA_WEBHOOK_SECRET=...
```

## 六、配置 Crisp 插件

在 Crisp 插件后台填写：

Webhook URL：

```text
https://crisp-adapter.example.com/webhooks/crisp
```

Action URL：

```text
https://crisp-adapter.example.com/webhooks/crisp/action
```

Conversation widget 使用项目中的：

```text
plugin_widget.json
```

该面板会显示 AI 状态，并提供启用 / 停用 AI 回复按钮。

## 七、使用 Docker 启动

推荐使用 Docker 部署：

```bash
docker compose up -d --build
```

查看运行状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f crisp-adapter
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

正常返回：

```json
{"ok":true}
```

常用维护命令：

```bash
docker compose restart crisp-adapter
docker compose stop crisp-adapter
docker compose up -d --build
```

## 八、使用 Node.js 启动

如果不使用 Docker：

```bash
npm install
npm run build
npm start
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

长期运行建议使用 Docker、PM2 或 systemd。

## 九、配置 HTTPS 反代

下面是 Nginx 示例。假设适配器监听 `127.0.0.1:8787`：

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

反代配置完成后，检查公网访问：

```bash
curl https://crisp-adapter.example.com/health
```

正常返回：

```json
{"ok":true}
```

## 十、上线验证

按下面顺序检查：

1. 本地健康检查通过：

   ```bash
   curl http://127.0.0.1:8787/health
   ```

2. 公网健康检查通过：

   ```bash
   curl https://crisp-adapter.example.com/health
   ```

3. 在 Crisp 里发送一条访客消息。

4. 查看适配器日志：

   ```bash
   docker compose logs -f crisp-adapter
   ```

5. 确认智答后台能收到会话。

6. 确认 AI 回复能回到 Crisp 会话。

如果第 2 步失败，优先检查域名、HTTPS 证书、防火墙和反代配置。

如果第 5 步失败，优先检查 `ZHIDA_GATEWAY_URL`、`ZHIDA_ACCESS_KEY`、`ZHIDA_SIGNING_SECRET`。

如果第 6 步失败，优先检查 `ZHIDA_WEBHOOK_SECRET`、`CRISP_TOKEN_IDENTIFIER`、`CRISP_TOKEN_KEY`。

## 十一、会话状态文件

适配器会保存 Crisp 会话和站点的映射：

```text
data/sessions.json
```

Docker 部署时已默认挂载：

```yaml
volumes:
  - ./data:/app/data
```

不要随意删除 `data/sessions.json`。删除后，旧会话的 AI 回复可能无法定位到对应 Crisp 站点。

## 十二、常见问题

### Crisp 返回 `invalid Crisp signature`

检查：

- `CRISP_WEBHOOK_SIGNING_SECRET` 是否填写正确
- Crisp 插件后台的 Signing Secret 是否和 `.env` 一致
- 代理服务是否修改了请求 body

### 智答网关返回 401

检查：

- `ZHIDA_ACCESS_KEY`
- `ZHIDA_SIGNING_SECRET`
- `ZHIDA_GATEWAY_URL`
- 服务器时间是否准确

签名会校验时间戳，服务器时间偏差太大会失败。

### AI 回复没有回到 Crisp

检查：

- 智答 Native 接入的 Webhook URL 是否是 `/webhooks/zhida`
- `ZHIDA_WEBHOOK_SECRET` 是否正确
- `CRISP_TOKEN_IDENTIFIER` 和 `CRISP_TOKEN_KEY` 是否正确
- `data/sessions.json` 是否存在对应会话

### 是否同步人工客服消息

由下面配置控制：

```env
FORWARD_OPERATOR_MESSAGES=true
```

设为 `false` 后，只转发访客消息，不转发人工客服消息。

### 如何避免 AI 回复再次触发转发

适配器会自动忽略昵称等于 `BOT_NAME` 的 Crisp 操作员消息。请确保 `BOT_NAME` 和 AI 在 Crisp 里显示的名字一致。

## 十三、升级

拉取最新代码并重新构建：

```bash
git pull
docker compose up -d --build
```

升级前建议先备份配置和会话状态：

```bash
cp .env .env.bak
cp -r data data.bak
```
