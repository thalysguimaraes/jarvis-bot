# Baileys WhatsApp Service

This service maintains the WhatsApp Web connection using Baileys and forwards audio messages to the Cloudflare Worker.

## Quick Start

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your Worker URL and shared secret
```

3. **Run the service**
```bash
npm run dev
```

4. **Scan QR code** with WhatsApp when it appears

## Commands

- `npm run dev` - Development with hot reload
- `npm run build` - Build TypeScript
- `npm start` - Production mode
- `npm run typecheck` - Type checking

## Docker

```bash
docker-compose up -d
```

## How it Works

1. Connects to WhatsApp Web using Baileys
2. Listens for incoming audio messages
3. Downloads and converts audio to base64
4. Forwards to Cloudflare Worker via webhook
5. Receives response from Worker
6. Sends confirmation back to user

## Files

- `src/index.ts` - Express server and API endpoints
- `src/whatsapp.ts` - Baileys client implementation
- `src/config.ts` - Environment configuration
- `auth_info/` - WhatsApp session data (gitignored)

## Troubleshooting

- **QR Code not appearing**: Delete `auth_info/` folder and restart
- **Connection lost**: Service auto-reconnects, check logs
- **Webhook errors**: Verify WEBHOOK_SECRET matches Worker