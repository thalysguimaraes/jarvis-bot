# JarvisBot 🤖

![JarvisBot Banner](public/banner-image.jpg)

An AI-powered WhatsApp personal assistant that handles voice commands, task management, portfolio tracking, and fund monitoring. **100% free** and self-hosted using Baileys (WhatsApp Web API).

## 🆓 Why JarvisBot?

Most AI assistants require expensive APIs or cloud services. JarvisBot uses:
- **Baileys** - Free WhatsApp Web library (no API costs)
- **Self-hosted** - Run on your own infrastructure  
- **Open source** - Full transparency and control
- **Multi-modal** - Voice, text, portfolio tracking, and more

## 🎯 Features

### 🎙️ Voice Assistant
- **Voice to Task**: Send audio → AI creates Todoist tasks
- **Voice to Note**: Send audio → AI saves to Obsidian vault
- **Smart Classification**: AI distinguishes between tasks and notes
- **Smart Parsing**: Extracts dates, priorities, and labels

### 📊 Portfolio Tracking
- **Stock Portfolio**: Track Brazilian and US stocks (BDRs)
- **Fund Monitoring**: Track investment funds via CNPJ
- **Daily Reports**: Automated portfolio performance updates
- **Voice Commands**: "Meu portfolio", "Como estão meus fundos?"

### 📝 Note Management  
- **Obsidian Integration**: Notes saved directly to your vault
- **GitHub Sync**: Version control for your notes
- **Daily/Individual**: Flexible note organization

### 🔒 Privacy & Security
- **Your Data Stays Private**: All processing on your infrastructure
- **No Cloud Dependencies**: Except for OpenAI transcription
- **Open Source**: Fully auditable code

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  WhatsApp App   │────▶│  Baileys Service │────▶│ Cloudflare      │
│                 │     │  (Local/VPS)     │     │ Worker          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                │ Audio Data               │ Processing
                                ▼                          ▼
                         ┌──────────────────┐     ┌─────────────────┐
                         │                  │     │ • OpenAI Whisper│
                         │  WhatsApp Web    │     │ • Todoist API   │
                         │  Connection      │     │ • Portfolio APIs│
                         └──────────────────┘     │ • Fund APIs     │
                                                  └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- OpenAI API key
- Todoist API token (optional)
- A server to run Baileys (VPS, Raspberry Pi, or local computer)

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/jarvis-bot.git
cd jarvis-bot
npm install
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your configuration
nano .dev.vars
```

### 3. Deploy Worker

```bash
npm run deploy
```

### 4. Run Baileys Service

```bash
cd baileys-service
npm install
cp .env.example .env

# Edit .env with your worker URL and secrets
nano .env

npm run dev
```

### 5. Connect WhatsApp

1. QR code will appear when you run Baileys
2. Open WhatsApp → Settings → Linked Devices → Link Device
3. Scan the QR code
4. Send a test voice message!

## ⚙️ Configuration

### Core Configuration (.dev.vars)

```env
# Core Settings
WEBHOOK_SECRET=your-secret-key
OPENAI_API_KEY=sk-your-openai-key
TODOIST_API_TOKEN=your-todoist-token

# Voice Classification  
CLASSIFICATION_ENABLED=true
CLASSIFICATION_CONFIDENCE_THRESHOLD=0.8

# Obsidian Integration
OBSIDIAN_STORAGE_TYPE=github
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-username
GITHUB_REPO=your-obsidian-vault
OBSIDIAN_VAULT_PATH=.
OBSIDIAN_NOTE_FORMAT=daily
OBSIDIAN_NOTE_PATH=WhatsApp Notes
```

### Portfolio Configuration

```env
# Stock Portfolio (JSON format)
PORTFOLIO_DATA='[
  {"ticker":"AAPL34","shares":100,"avgPrice":50.0},
  {"ticker":"VALE3","shares":500,"avgPrice":60.0}
]'

# Fund Portfolio (JSON format) 
FUND_PORTFOLIO_DATA='[
  {
    "cnpj":"00.000.000/0001-00",
    "name":"Example Fund",
    "quotas":100,
    "investedAmount":10000,
    "avgPrice":100.0,
    "purchaseDate":"2024-01-15"
  }
]'

# Portfolio APIs
BRAPI_TOKEN=your-brapi-token
ZAISEN_API_URL=your-fund-api-url
ZAISEN_API_KEY=your-fund-api-key

# Notifications
PORTFOLIO_WHATSAPP_NUMBER=5511999999999
```

### WhatsApp Service (.env in baileys-service/)

```env
PORT=3000
WORKER_WEBHOOK_URL=https://your-worker.workers.dev
WEBHOOK_SECRET=your-secret-key
```

## 🎤 Voice Commands

### Task Management
- **"Comprar leite amanhã"** → Creates Todoist task for tomorrow
- **"Urgente: enviar relatório até sexta"** → High priority task due Friday
- **"Reunião com cliente segunda 14h"** → Task with specific date/time

### Note Taking
- **"Tive uma ideia para melhorar vendas"** → Saves as Obsidian note
- **"Cliente prefere reuniões de manhã"** → Classified as note, not task

### Portfolio Commands
- **"Meu portfolio"** → Full portfolio report
- **"Como está a AAPL34?"** → Specific stock performance
- **"Meus fundos"** → Fund portfolio status
- **"Cota do fundo Trend"** → Specific fund quote

## 📊 Portfolio Features

### Supported Markets
- **Brazilian Stocks**: B3 listed companies (VALE3, PETR4, etc.)
- **US BDRs**: Brazilian Depositary Receipts (AAPL34, MSFT34, etc.)
- **Investment Funds**: Brazilian funds tracked by CNPJ

### Automated Reports
- Daily portfolio performance (weekdays 6 PM BRT)
- Weekend summaries
- Real-time quote updates
- Performance calculations with purchase prices

### Voice Integration
Ask about your investments naturally in Portuguese:
- "Como estão minhas ações?"
- "Qual o rendimento hoje?"
- "Fundos subiram ou desceram?"

## 🔧 Deployment Options

### Local Development
Perfect for testing and personal use:
```bash
npm run dev
```

### VPS Deployment (Recommended)
Deploy on cloud server for 24/7 availability:
- DigitalOcean, Linode, AWS EC2
- ~$5/month for small VPS
- Use included Docker setup

### Docker Deployment
```bash
cd baileys-service
docker-compose up -d
```

### Home Server
Run on Raspberry Pi or spare computer:
- Zero monthly costs
- Perfect for personal use
- Requires static IP or dynamic DNS

## 🔐 Security Best Practices

### Environment Variables
- Never commit secrets to Git
- Use `.dev.vars` for local development
- Use Cloudflare secrets for production

### WhatsApp Security
- Webhook authentication via shared secret
- Session data encrypted locally
- No message content stored in cloud

### API Security
- All external API calls use HTTPS
- Tokens stored as environment variables
- Rate limiting on webhook endpoints

## 💰 Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| WhatsApp | Free | Via Baileys/WhatsApp Web |
| Cloudflare Workers | Free | 100k requests/day limit |
| OpenAI Transcription | ~$0.006/min | Pay per use |
| VPS (optional) | $5/month | 24/7 hosting |
| **Total** | **$0-5/month** | + minimal OpenAI usage |

## 🛠️ Development

### Project Structure
```
src/
├── index.ts                 # Main worker entry point
├── modules/
│   ├── classification/      # AI voice classification
│   ├── portfolio-tracker/   # Stock portfolio management
│   ├── fund-tracker/       # Investment fund tracking  
│   ├── todoist/            # Task management
│   └── obsidian/           # Note management
├── router/                 # Request routing
└── utils/                  # Shared utilities
```

### Build Commands
```bash
npm run build        # Type check and build
npm run typecheck    # TypeScript validation
npm run lint         # Code linting
npm run deploy       # Deploy to Cloudflare
```

### Adding New Features
1. Create module in `src/modules/`
2. Add voice commands to classifier
3. Update AudioProcessor router
4. Add environment configuration
5. Test locally with `npm run dev`

## 🔍 Troubleshooting

### Common Issues

**QR Code Not Appearing**
- Check console for errors
- Ensure Node.js 18+
- Delete `auth_info` folder and retry

**Messages Not Processing**  
- Check worker logs: `npx wrangler tail`
- Verify webhook URL in Baileys .env
- Ensure WEBHOOK_SECRET matches

**Portfolio Not Updating**
- Check BRAPI_TOKEN is valid
- Verify ticker symbols in PORTFOLIO_DATA
- Check worker logs for API errors

**WhatsApp Disconnecting**
- Normal behavior for WhatsApp Web
- Baileys auto-reconnects
- Keep phone connected to internet

### Debug Commands

```bash
# Check worker logs
npx wrangler tail

# Test portfolio locally
node test-portfolio.js

# Validate configuration
npm run typecheck
```

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- **Language Support**: Add English/Spanish voice commands
- **New Integrations**: More task managers, note apps
- **Market Support**: International stock markets
- **Mobile App**: React Native companion app
- **Voice Responses**: Text-to-speech replies

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test locally
4. Submit pull request with description

## 📄 Legal & Disclaimer

This project uses third-party services and APIs:

- **WhatsApp**: Uses Baileys library for WhatsApp Web access
- **OpenAI**: For voice transcription services  
- **Market APIs**: For real-time financial data
- **Todoist**: For task management integration

**Not affiliated with**: WhatsApp Inc., Meta Platforms, OpenAI, Todoist, or any mentioned services.

Use at your own risk. Ensure compliance with WhatsApp Terms of Service.

## 📜 License

ISC License - See LICENSE file for details

---

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open GitHub issue for bugs or feature requests  
- **Discussions**: Use GitHub Discussions for questions
- **Community**: Join our Discord for real-time help

---

*Built with ❤️ for personal productivity and financial awareness*
