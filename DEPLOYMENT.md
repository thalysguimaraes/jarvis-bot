# JarvisBot Deployment Guide

Complete guide for deploying JarvisBot v2 with modular architecture.

## Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- Z-API account with WhatsApp Business number
- OpenAI API account
- Wrangler CLI: `npm install -g wrangler`

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/jarvis-bot.git
cd jarvis-bot
npm install
```

### 2. Setup Credentials

Copy and configure environment:
```bash
cp .dev.vars.example .dev.vars
nano .dev.vars  # Edit with your credentials
```

Required credentials:
```env
# Z-API WhatsApp
Z_API_INSTANCE_ID=your-instance-id
Z_API_INSTANCE_TOKEN=your-instance-token
Z_API_CLIENT_TOKEN=your-client-token

# OpenAI
OPENAI_API_KEY=sk-your-api-key

# Security
WEBHOOK_SECRET=your-random-secret
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

## Step 4: Deploy to Cloudflare

1. Login to Cloudflare:
```bash
npx wrangler login
```

2. Deploy the worker:
```bash
npm run deploy
```

3. Note your worker URL (e.g., `https://jarvis-bot.your-subdomain.workers.dev`)

## Step 5: Configure Z-API Webhook

1. In your Z-API dashboard, go to Webhook settings
2. Set webhook URL to: `https://your-worker.workers.dev/webhook`
3. Enable webhook for message events
4. Test the connection (Z-API usually provides a test feature)

## Step 6: Test Your Setup

### 1. Test Worker Health
```bash
curl https://your-worker.workers.dev/health
# Should return: OK
```

### 2. Test Worker Status
```bash
curl https://your-worker.workers.dev/status
# Should return JSON with service status
```

### 3. Test Voice Commands
Send audio messages to your WhatsApp Business number:
- "Comprar leite amanhã" (creates task)
- "Tive uma ideia interessante" (creates note)
- "Meu portfolio" (portfolio report, if configured)

## API Keys and Tokens Setup

### OpenAI API Key
1. Go to https://platform.openai.com/
2. Create account and add billing information
3. Go to API Keys section
4. Create new secret key starting with `sk-`

### Z-API Setup
1. Create account at https://z-api.io/
2. Choose a plan (starts around $15/month)
3. Create WhatsApp Business instance
4. Connect your WhatsApp Business phone number
5. Get Instance ID, Token, and Security Token from dashboard

### Todoist API Token (Optional)
1. Go to https://todoist.com/prefs/integrations
2. Scroll to API token section
3. Copy your personal API token

### GitHub Personal Access Token (Optional)
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` for private repos or `public_repo` for public repos
4. Copy the generated token

### BRAPI Token (Optional)
1. Go to https://brapi.dev/
2. Register for free account
3. Get your API token from dashboard

## Configuration Details

### Portfolio Configuration

Edit your stock portfolio in JSON format:

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

## Testing and Monitoring

### Health Checks
```bash
# Basic health check
curl https://your-worker.workers.dev/health

# Detailed status
curl https://your-worker.workers.dev/status

# Test configuration
curl https://your-worker.workers.dev/test-config
```

### Monitor Logs
```bash
# Real-time worker logs
npx wrangler tail

# Filter for errors only
npx wrangler tail --format=pretty --grep=ERROR
```

### Test Specific Features
```bash
# Test portfolio (if configured)
curl -X POST https://your-worker.workers.dev/test-portfolio

# Test fund tracking (if configured)  
curl -X POST https://your-worker.workers.dev/test-fund-portfolio
```

## Troubleshooting

### Common Issues

**Webhook Not Receiving Messages**
- Check Z-API webhook URL is exactly: `https://your-worker.workers.dev/webhook`
- Verify webhook is enabled for message events in Z-API
- Check security token matches `WEBHOOK_SECRET`
- Monitor logs: `npx wrangler tail`

**Messages Processing But No Response**
- Check OpenAI API key is valid and has credits
- Verify audio format is supported (most formats work)
- Check worker execution time (max 10 seconds on free tier)
- Look for errors in worker logs

**Portfolio Not Working**
- Verify BRAPI_TOKEN is valid
- Check ticker symbols are in correct format (AAPL34, VALE3, etc.)
- Ensure PORTFOLIO_DATA is valid JSON
- Check API rate limits (BRAPI: 1000 requests/day free)

**Tasks Not Creating in Todoist**
- Verify TODOIST_API_TOKEN is correct
- Check if Todoist account has reached project limits
- Monitor worker logs for API errors

**Notes Not Saving to Obsidian**
- Verify GitHub token has correct repository permissions
- Check repository exists and is accessible
- Ensure GITHUB_OWNER and GITHUB_REPO are correct

### Debug Steps

1. **Check Worker Deployment**
   ```bash
   curl https://your-worker.workers.dev/health
   ```

2. **Verify Configuration**
   ```bash
   curl https://your-worker.workers.dev/test-config
   ```

3. **Monitor Real-time Logs**
   ```bash
   npx wrangler tail
   ```

4. **Test Z-API Connection**
   - Send test message from Z-API dashboard
   - Check if webhook receives the message

5. **Check Environment Variables**
   - Ensure all required variables are set
   - Verify there are no extra spaces or quotes

## Security Considerations

### Environment Variables
- Never commit `.dev.vars` to Git
- Use Cloudflare Worker secrets for production
- Rotate API keys periodically

### Z-API Security
- Use strong security token for webhook authentication
- Monitor unusual API usage in Z-API dashboard
- Only enable required webhook events

### API Rate Limits
- OpenAI: Standard rate limits based on tier
- Z-API: Based on your plan (usually generous)
- BRAPI: 1000 requests/day (free tier)
- Todoist: 450 requests per 15 minutes

## Scaling Considerations

### Free Tier Limits
- Cloudflare Workers: 100k requests/day
- Usually sufficient for personal use
- Monitor usage in Cloudflare dashboard

### If You Hit Limits
- Upgrade Cloudflare Workers plan ($5/month)
- Optimize request frequency
- Cache responses where possible

## Backup and Recovery

### Important Data to Backup
- `.dev.vars` configuration (without committing to Git)
- Portfolio configuration
- Cloudflare Worker secrets
- Z-API instance settings

### Recovery Process
1. Redeploy worker: `npm run deploy`
2. Reconfigure Z-API webhook URL
3. Test functionality with simple voice message
4. Verify all integrations work

## Cost Summary

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| Z-API | $15-30 | WhatsApp Business API |
| Cloudflare Workers | Free | 100k requests/day |
| OpenAI API | ~$1-5 | Pay per use, ~$0.006/min audio |
| **Total** | **$16-35** | For typical personal use |

## Updates and Maintenance

### Regular Updates
```bash
git pull origin main
npm install
npm run deploy
```

### Monitor Performance
- Check Cloudflare Worker analytics
- Monitor Z-API usage dashboard
- Track OpenAI API costs
- Review worker logs for errors

### Maintenance Tasks
- Update dependencies: `npm update`
- Check for security updates: `npm audit`
- Review and rotate API keys quarterly
- Monitor and optimize API usage
