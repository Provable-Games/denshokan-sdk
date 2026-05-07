# Telegram Score Bot

This example runs a dependency-free Telegram bot that lets a chat register one or more Starknet account addresses and receive live Denshokan score updates.

It uses Telegram long polling (`getUpdates`), so it does not need a public HTTPS webhook. On startup it calls `deleteWebhook` because `getUpdates` can return a conflict when a webhook is configured.

## Create a Telegram bot

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`.
3. Choose a display name and username.
4. Copy the bot token from BotFather.

Keep the token secret.

## Run locally

From the repo root:

```bash
bun install
bun run build
export TELEGRAM_BOT_TOKEN="123456789:replace-with-your-token"
node examples/telegram-score-bot.mjs
```

The script starts the bot and stores registrations in `.telegram-score-bot-registrations.json` by default.

Optional environment variables are listed in `telegram-score-bot.env.example`. Empty optional environment variables are ignored, so unset and empty values both use the SDK defaults.

## Test in Telegram

Open a private chat with your bot and send:

```text
/start
/register 0xACCOUNT_ADDRESS
/status
```

Expected results:

- `/start` returns the command list.
- `/register` confirms the account registration.
- `/status` returns the registered account's most recently updated token, game ID, score, and `lastUpdatedAt`.
- Live score and game-over WebSocket events for the registered account are posted into the chat.

To stop updates:

```text
/unregister
```

You can also add the bot to a group and run `/register 0xACCOUNT_ADDRESS` in that group. If BotFather privacy mode is enabled, use `/register@your_bot_username 0xACCOUNT_ADDRESS` or disable privacy mode with `/setprivacy` in BotFather.

## Optional command menu

Telegram can show these commands in the bot menu:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command":"start","description":"Show help"},
      {"command":"help","description":"Show help"},
      {"command":"register","description":"Register an account"},
      {"command":"unregister","description":"Unregister accounts"},
      {"command":"accounts","description":"List registered accounts"},
      {"command":"status","description":"Show latest token status"}
    ]
  }'
```

## Deploy with systemd

Example VPS deployment:

```bash
sudo git clone https://github.com/Provable-Games/denshokan-sdk.git /opt/denshokan-sdk
sudo chown -R "$USER":"$USER" /opt/denshokan-sdk
cd /opt/denshokan-sdk
bun install
bun run build
```

Create an environment file:

```bash
sudo tee /etc/denshokan-telegram-bot.env >/dev/null <<'EOF'
TELEGRAM_BOT_TOKEN=123456789:replace-with-your-token
DENSHOKAN_CHAIN=mainnet
REGISTRATIONS_FILE=/opt/denshokan-sdk/.telegram-score-bot-registrations.json
EOF
sudo chown root:root /etc/denshokan-telegram-bot.env
sudo chmod 600 /etc/denshokan-telegram-bot.env
```

Create the service:

```bash
sudo tee /etc/systemd/system/denshokan-telegram-bot.service >/dev/null <<'EOF'
[Unit]
Description=Denshokan Telegram Score Bot
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/denshokan-sdk
EnvironmentFile=/etc/denshokan-telegram-bot.env
ExecStart=/usr/bin/node examples/telegram-score-bot.mjs
Restart=always
RestartSec=5
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF
```

Start and inspect logs:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now denshokan-telegram-bot
sudo journalctl -u denshokan-telegram-bot -f
```

Replace `User=ubuntu` with the operating-system user that owns `/opt/denshokan-sdk`.
