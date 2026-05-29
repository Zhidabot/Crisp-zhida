# Crisp Setup

1. Create or open your Crisp plugin.
2. Set the webhook URL to:

   ```text
   https://adapter.example.com/webhooks/crisp
   ```

3. Set the action URL to:

   ```text
   https://adapter.example.com/webhooks/crisp/action
   ```

4. Use `plugin_widget.json` as the conversation widget definition.
5. Copy the Crisp signing secret into `CRISP_WEBHOOK_SIGNING_SECRET`.
6. Copy the plugin token identifier and key into `CRISP_TOKEN_IDENTIFIER` and `CRISP_TOKEN_KEY`.

The adapter posts AI replies through the Crisp REST API as operator messages with the optional `BOT_NAME` and `BOT_AVATAR` display fields.
