# Native Protocol

## Adapter -> ZHIDA

Endpoint:

```text
POST /v1/native/webhook
```

Headers:

```text
Content-Type: application/json
X-ZHIDA-Access-Key: <access_key>
X-ZHIDA-Timestamp: <unix_seconds>
X-ZHIDA-Nonce: <random_nonce>
X-ZHIDA-Signature: v1=<hex_hmac_sha256>
```

Signature payload:

```text
<timestamp>.<nonce>.<METHOD>.<path>.<raw_body>
```

Example:

```text
1712224800.nonce-001.POST./v1/native/webhook.{"event":"message:send",...}
```

## Message Event

```json
{
  "event": "message:send",
  "timestamp": 1712224800,
  "token": "nk_live_xxx",
  "data": {
    "fingerprint": "crisp:message:send:site:session:123",
    "timestamp": 1712224800,
    "token": "nk_live_xxx",
    "session_id": "session_123",
    "user": {
      "id": "visitor_123",
      "nickname": "Visitor"
    },
    "content": {
      "text": "hello",
      "attachments": []
    }
  }
}
```

Events:

- `message:send`: customer sent a public message.
- `message:received`: operator sent a public message.
- `action:control`: operator clicked a control action.

## ZHIDA -> Adapter Callback

Endpoint configured in the ZHIDA Native integration:

```text
POST /webhooks/zhida
```

Headers:

```text
Content-Type: application/json
X-ZHIDA-Fingerprint: <fingerprint>
X-ZHIDA-Timestamp: <unix_seconds>
X-ZHIDA-Signature: v1=<hex_hmac_sha256>
```

Callback signature payload:

```text
<fingerprint>.<timestamp>.<raw_body>
```

Body:

```json
{
  "event": "message:assistant",
  "timestamp": 1712224810,
  "data": {
    "fingerprint": "fp_asst_001",
    "timestamp": 1712224810,
    "session_id": "session_123",
    "content": {
      "text": "AI reply"
    }
  }
}
```
