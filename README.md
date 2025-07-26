# audio2task

![audio2task banner](public/banner-image.jpg)

A WhatsApp bot that converts voice messages into Todoist tasks using OpenAI Whisper. **100% free** and self-hosted using Baileys (WhatsApp Web).

## 🆓 Why This Project?

Most WhatsApp bots require expensive APIs. This project uses:
- **Baileys** - Free WhatsApp Web library (no API costs)
- **Self-hosted** - Run on your own infrastructure
- **Open source** - Full transparency and control

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  WhatsApp App   │────▶│  Baileys Service │────▶│ Cloudflare      │
│                 │     │  (Local/VPS)     │     │ Worker          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                          │
                               │ Audio Data               │ Transcription
                               ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │                  │     │                 │
                        │  WhatsApp Web    │     │  OpenAI Whisper │
                        │  Connection      │     │  + Todoist API  │
                        └──────────────────┘     └─────────────────┘
```

## Features

- 🎙️ **Voice to Task**: Send audio → Get Todoist task
- 🤖 **Smart Parsing**: AI extracts dates, priorities, labels
- 🔒 **Privacy First**: Your messages stay on your server
- 💰 **100% Free**: No WhatsApp API costs

## Requirements

- Node.js 18+
- Cloudflare account (free tier works)
- OpenAI API key (for transcription)
- Todoist API token
- A server/computer to run Baileys (VPS, Raspberry Pi, or local)

## Quick Start

### 1. Deploy the Worker

```bash
# Clone the repository
git clone https://github.com/yourusername/audio2task.git
cd audio2task

# Install dependencies
npm install

# Configure Worker
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your keys

# Deploy to Cloudflare
npm run deploy
```

### 2. Run Baileys Service

```bash
# Go to Baileys service directory
cd baileys-service

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with:
# - WORKER_WEBHOOK_URL=https://your-worker.workers.dev
# - WEBHOOK_SECRET=your-secret-key

# Run the service
npm run dev
```

### 3. Connect WhatsApp

1. When you run the Baileys service, a QR code will appear
2. Open WhatsApp on your phone
3. Go to Settings → Linked Devices → Link a Device
4. Scan the QR code
5. Done! Send an audio message to test

## Configuration

### Worker Environment Variables

```env
WEBHOOK_SECRET=your-secret-key        # Shared with Baileys
BAILEYS_SERVICE_URL=http://your-server:3000  # Your Baileys service
OPENAI_API_KEY=sk-...                # OpenAI for transcription
TODOIST_API_TOKEN=...                # Todoist API token
```

### Baileys Service Environment

```env
PORT=3000
WORKER_WEBHOOK_URL=https://your-worker.workers.dev
WEBHOOK_SECRET=your-secret-key        # Same as Worker
```

## Deployment Options

### Option 1: Local Computer
Perfect for personal use. Run Baileys on your computer.

### Option 2: VPS (Recommended)
Deploy on a small VPS (DigitalOcean, Linode, etc.)
- $5/month gets you 24/7 uptime
- Use the included Docker setup

### Option 3: Docker

```bash
cd baileys-service
docker-compose up -d
```

### Option 4: Home Server
Run on Raspberry Pi or old laptop for zero monthly cost.

## How It Works

1. **Audio Message**: You send a voice message to your WhatsApp
2. **Baileys Receives**: The service captures the audio
3. **Forward to Worker**: Audio sent to Cloudflare Worker
4. **Transcription**: OpenAI Whisper converts speech to text
5. **Task Creation**: AI parses and creates Todoist task
6. **Confirmation**: Bot sends back task details

## Examples

**"Comprar leite amanhã"**
→ Task: "Comprar leite" 
→ Due: Tomorrow
→ Label: compras

**"Urgente: enviar relatório até sexta"**
→ Task: "Enviar relatório"
→ Due: Friday
→ Priority: High

## Security

- Webhook authentication via shared secret
- No data stored in cloud (except Cloudflare KV)
- WhatsApp session encrypted locally
- Open source for full transparency

## Costs

- **WhatsApp**: Free (via Baileys/WhatsApp Web)
- **Cloudflare Workers**: Free tier (100k requests/day)
- **OpenAI**: ~$0.006 per minute of audio
- **Server**: Free (local) or ~$5/month (VPS)

Total: **$0-5/month** + minimal OpenAI usage

## Troubleshooting

### QR Code not appearing
- Check console for errors
- Ensure Node.js 18+
- Delete `auth_info` folder and retry

### Messages not processing
- Check Worker logs: `npx wrangler tail`
- Verify webhook URL in Baileys .env
- Ensure WEBHOOK_SECRET matches

### WhatsApp disconnecting
- Normal for WhatsApp Web
- Baileys auto-reconnects
- Keep phone connected to internet

## Contributing

PRs welcome! Areas for improvement:
- Support more languages
- Add more task management services
- Improve error handling
- Better documentation

## Legal Disclaimer

This project uses Baileys to connect to WhatsApp Web. Use at your own risk. 

**This project is not affiliated with, endorsed by, or sponsored by WhatsApp Inc., Meta Platforms Inc., Todoist, Doist Inc., OpenAI, or any of their affiliates or subsidiaries. All product names, logos, and brands mentioned are property of their respective owners.**

The use of these names, logos, and brands does not imply endorsement. All company, product, and service names used are for identification purposes only.

## License

ISC