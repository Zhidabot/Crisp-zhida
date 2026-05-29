# Crisp AI 回复插件

此插件用于对接Crisp与智答 AI 客服网关，实现24小时全自动 AI 回复

中文部署教程：[docs/zh-CN-deploy.md](docs/zh-CN-deploy.md)

English deployment guide: [docs/en-deploy.md](docs/en-deploy.md)

## 工作流程

```text
Crisp -> 本适配器 -> 智答 Native 网关
智答 -> 本适配器 -> Crisp 会话
```

## 主要功能

- 接收 Crisp 访客消息
- 接收 Crisp 人工客服消息
- 转发消息到智答 Native 网关
- 接收智答 AI 回复并发送回 Crisp
- 支持 Crisp 面板里的启用 / 停用 AI 按钮
- 支持 Docker 部署

## 快速启动

```bash
cp .env.example .env
npm install
npm run build
npm start
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

Docker 启动：

```bash
docker compose up -d --build
```

## 需要配置的地址

在 Crisp 插件后台配置：

- Webhook URL: `https://crisp-adapter.example.com/webhooks/crisp`
- Action URL: `https://crisp-adapter.example.com/webhooks/crisp/action`

在智答 Native 接入里配置：

- Webhook URL: `https://crisp-adapter.example.com/webhooks/zhida`

## 需要填写的密钥

复制 `.env.example` 为 `.env`，然后填写：

- `CRISP_TOKEN_IDENTIFIER`
- `CRISP_TOKEN_KEY`
- `CRISP_WEBHOOK_SIGNING_SECRET`
- `ZHIDA_GATEWAY_URL`
- `ZHIDA_ACCESS_KEY`
- `ZHIDA_SIGNING_SECRET`
- `ZHIDA_WEBHOOK_SECRET`

详细步骤见：[中文部署教程](docs/zh-CN-deploy.md)
