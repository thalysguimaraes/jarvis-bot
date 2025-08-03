# JarvisBot Deployment Guide

This guide walks you through deploying JarvisBot for personal use.

## Prerequisites

- Node.js 18+
- Git
- Cloudflare account (free)
- OpenAI API account
- A server to run Baileys (VPS, local machine, or Raspberry Pi)

## Step 1: Clone and Setup

```bash
git clone https://github.com/yourusername/jarvis-bot.git
cd jarvis-bot
npm install
```

## Step 2: Configure Environment

1. Copy the example configuration:
```bash
cp .dev.vars.example .dev.vars
```

2. Edit `.dev.vars` with your actual values:

### Required Configuration
```env
WEBHOOK_SECRET=choose-a-random-secret-key
OPENAI_API_KEY=sk-your-openai-api-key
```

### Optional Features

**Task Management with Todoist:**
```env
TODOIST_API_TOKEN=your-todoist-api-token
```

**Note Taking with Obsidian:**
```env
GITHUB_TOKEN=your-github-personal-access-token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-obsidian-vault-repo
```

**Portfolio Tracking:**
```env
BRAPI_TOKEN=your-brapi-token
PORTFOLIO_DATA=[{"ticker":"AAPL34","shares":100,"avgPrice":50.0}]
PORTFOLIO_WHATSAPP_NUMBER=5511999999999
```

**Fund Tracking:**
```env
ZAISEN_API_URL=https://your-fund-api.com
ZAISEN_API_KEY=your-fund-api-key
FUND_PORTFOLIO_DATA=[{"cnpj":"11.222.333/0001-44","name":"My Fund","quotas":100,"investedAmount":10000,"avgPrice":100.0,"purchaseDate":"2024-01-15"}]
```

## Step 3: Deploy to Cloudflare

1. Login to Cloudflare:
```bash
npx wrangler login
```

2. Deploy the worker:
```bash
npm run deploy
```

3. Note your worker URL (something like `https://jarvis-bot.your-subdomain.workers.dev`)

## Step 4: Setup Baileys Service

1. Navigate to Baileys service:
```bash
cd baileys-service
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Edit `.env`:
```env
PORT=3000
WORKER_WEBHOOK_URL=https://your-worker-url.workers.dev
WEBHOOK_SECRET=same-secret-as-worker
```

## Step 5: Run Baileys Service

### Local Development
```bash
npm run dev
```

### Production (VPS with PM2)
```bash
npm install -g pm2
pm2 start npm --name "jarvis-baileys" -- run start
pm2 save
pm2 startup
```

### Docker Deployment
```bash
docker-compose up -d
```

## Step 6: Connect WhatsApp

1. Start the Baileys service (previous step)
2. A QR code will appear in the console
3. Open WhatsApp on your phone
4. Go to Settings → Linked Devices → Link a Device
5. Scan the QR code
6. Send a test voice message to your own number

## Configuration Details

### API Keys and Tokens

**OpenAI API Key:**
1. Go to https://platform.openai.com/
2. Create account and add billing information
3. Go to API Keys section
4. Create new secret key

**Todoist API Token:**
1. Go to https://todoist.com/prefs/integrations
2. Scroll to API token section
3. Copy your personal API token

**GitHub Personal Access Token:**
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` for private repos or `public_repo` for public repos
4. Copy the generated token

**BRAPI Token:**
1. Go to https://brapi.dev/
2. Register for free account
3. Get your API token from dashboard

### Portfolio Configuration

Edit your portfolio data in JSON format:

```env
PORTFOLIO_DATA=[
  {"ticker":"AAPL34","shares":190,"avgPrice":57.6},
  {"ticker":"VALE3","shares":1200,"avgPrice":62.8},
  {"ticker":"PETR4","shares":765,"avgPrice":37.91}
]
```

### Fund Configuration

Add your investment funds:

```env
FUND_PORTFOLIO_DATA=[
  {
    "cnpj":"00.017.024/0001-53",
    "name":"BRADESCO FIA",
    "quotas":1000,
    "investedAmount":150250,
    "avgPrice":150.25,
    "purchaseDate":"2024-01-15"
  }
]
```

## Testing Your Setup

### 1. Test Worker Deployment
Visit your worker URL - you should see "JarvisBot is running!"

### 2. Test Voice Commands
Send audio messages like:
- "Comprar leite amanhã" (creates task)
- "Tive uma ideia interessante" (creates note)
- "Meu portfolio" (portfolio report)

### 3. Test Portfolio
Send text message: `/portfolio` or voice: "Como está meu portfolio?"

## Troubleshooting

### Worker Not Responding
```bash
npx wrangler tail
```
Check logs for errors in real-time.

### QR Code Not Showing
- Ensure Node.js 18+
- Delete `auth_info` folder and restart
- Check console for error messages

### Messages Not Processing
- Verify WEBHOOK_SECRET matches in both services
- Check worker URL is correct in Baileys .env
- Ensure Cloudflare worker is deployed successfully

### Portfolio Not Working
- Verify BRAPI_TOKEN is valid
- Check ticker symbols are correct (Brazilian format)
- Ensure PORTFOLIO_DATA is valid JSON

## Security Considerations

### Environment Variables
- Never commit .dev.vars to Git
- Use different secrets for production
- Rotate API keys periodically

### WhatsApp Security
- Only use with your own WhatsApp number
- Be aware this connects via WhatsApp Web
- Monitor for unusual activity

### Server Security
- Use HTTPS for webhook URLs
- Keep Baileys service behind firewall
- Update dependencies regularly

## Scaling Considerations

### Single User (Recommended)
- Run on local machine or small VPS
- Use PM2 for process management
- Basic monitoring with PM2 logs

### Multiple Users
- Use Docker containers
- Implement user isolation
- Add rate limiting
- Consider managed hosting

## Backup and Recovery

### Important Data
- Save your WhatsApp session: `baileys-service/auth_info/`
- Backup your portfolio configuration
- Export Cloudflare worker settings

### Recovery Process
1. Redeploy worker with same configuration
2. Restore Baileys session folder
3. Restart Baileys service
4. Re-scan QR if needed

## Performance Optimization

### Cloudflare Workers
- Free tier: 100k requests/day
- Usually sufficient for personal use
- Upgrade if needed for heavy usage

### Baileys Service
- Minimum 512MB RAM
- 1 CPU core sufficient
- SSD storage recommended

### API Rate Limits
- OpenAI: Standard rate limits apply
- BRAPI: 1000 requests/day (free tier)
- Todoist: 450 requests per 15 minutes

## Monitoring

### Health Checks
- Monitor worker uptime via Cloudflare dashboard
- Check Baileys service with PM2: `pm2 status`
- Test voice commands daily

### Logs
- Worker logs: `npx wrangler tail`
- Baileys logs: `pm2 logs jarvis-baileys`
- System logs: `journalctl -u your-service`

## Updates

### Worker Updates
```bash
git pull origin main
npm run deploy
```

### Baileys Service Updates
```bash
git pull origin main
cd baileys-service
npm install
pm2 restart jarvis-baileys
```

### Dependency Updates
```bash
npm update
npm audit fix
```
