# Deployment Guide - Jarvis Bot v2.0

## Quick Deployment Steps

### 1. Prerequisites
- Ensure you have `wrangler` CLI installed: `npm install -g wrangler`
- Be logged into Cloudflare: `npx wrangler login`
- Have your `.dev.vars.complete` file with all credentials

### 2. Setup Secrets (First Time Only)

```bash
# Make the script executable
chmod +x scripts/setup-secrets-from-devvars.sh

# Set up secrets for production from .dev.vars.complete
npm run setup:secrets:devvars

# Or for staging environment
npm run setup:secrets:devvars:staging
```

**Note**: The script will skip any placeholder values (starting with "your-" or "TODO"). Make sure to add:
- `BRAPI_TOKEN` - Get from https://brapi.dev
- `PORTFOLIO_WHATSAPP_NUMBER` - Your WhatsApp number for portfolio reports

### 3. Test Locally

```bash
# Run the new architecture locally
npm run dev

# Test the health endpoint
curl http://localhost:8787/health

# Test the voice sync API
curl -H "Authorization: Bearer obs-voice-sync-2025-secure-api-key-v1" \
     http://localhost:8787/api/voice-notes/unprocessed
```

### 4. Deploy to Staging (Recommended First)

```bash
# Deploy to staging environment
npm run deploy:staging

# Monitor logs
npx wrangler tail --env staging
```

Test the staging deployment:
- Send a voice message to your WhatsApp
- Check if it's stored: `curl -H "Authorization: Bearer YOUR_API_KEY" https://jarvis-bot-staging.workers.dev/api/voice-notes/unprocessed`

### 5. Deploy to Production

```bash
# Deploy to production
npm run deploy:production

# Or simply (uses production by default)
npm run deploy

# Monitor production logs
npx wrangler tail --env production
```

### 6. Update Z-API Webhook

After deployment, update your Z-API webhook URL to point to the new worker:
1. Go to Z-API dashboard
2. Update webhook URL to: `https://jarvis-bot.workers.dev/webhook/zapi`
3. Save changes

## Rollback Option

If you need to rollback to the old architecture:

```bash
# Deploy old architecture
npm run deploy:old
```

## Architecture Comparison

| Feature | Old (index.ts) | New (index-new.ts) |
|---------|---------------|-------------------|
| Entry Point | `src/index.ts` | `src/index-new.ts` |
| Config | `wrangler.toml` | `wrangler-new.toml` |
| Architecture | Monolithic | Modular/Event-driven |
| Obsidian Sync | Git-based (removed) | API-based |
| Voice Notes Storage | GitHub | Cloudflare KV |
| Authentication | N/A | Bearer Token |

## New API Endpoints

The new deployment includes these voice sync API endpoints for Obsidian integration:

- `GET /api/voice-notes/unprocessed` - Get unsynced notes
- `GET /api/voice-notes/all` - Get all notes with pagination
- `GET /api/voice-notes/recent?hours=24` - Get recent notes
- `POST /api/voice-notes/{id}/processed` - Mark as processed
- `POST /api/voice-notes/{id}/synced` - Mark as synced to Obsidian

## Environment Variables

### Required
- `Z_API_INSTANCE_ID` - Z-API instance identifier
- `Z_API_INSTANCE_TOKEN` - Z-API authentication token
- `Z_API_SECURITY_TOKEN` - Z-API webhook security
- `OPENAI_API_KEY` - OpenAI API for transcription
- `TODOIST_API_TOKEN` - Todoist integration
- `OBSIDIAN_API_KEY` - Authentication for voice sync API
- `WEBHOOK_SECRET` - Webhook validation

### Optional but Recommended
- `BRAPI_TOKEN` - For portfolio tracking
- `PORTFOLIO_WHATSAPP_NUMBER` - For daily reports
- `ZAISEN_API_KEY` - For fund tracking
- `ZAISEN_API_URL` - Fund API endpoint

## Scheduled Tasks

The worker includes two scheduled tasks:
- **9 AM BRT (12:00 UTC)** - Daily portfolio report
- **6 PM BRT (21:00 UTC)** - Fund portfolio check

These are configured in `wrangler-new.toml` and will be automatically set up on deployment.

## Monitoring

### Check Deployment Status
```bash
# View worker details
npx wrangler deployments list

# Check KV storage
npx wrangler kv:key list --namespace-id=USER_CONFIGS
```

### View Logs
```bash
# Real-time logs
npx wrangler tail

# Filter logs
npx wrangler tail --filter "error"
```

### Test Voice Sync API
```bash
# Get unprocessed notes
curl -H "Authorization: Bearer YOUR_OBSIDIAN_API_KEY" \
     https://jarvis-bot.workers.dev/api/voice-notes/unprocessed

# Mark note as synced
curl -X POST -H "Authorization: Bearer YOUR_OBSIDIAN_API_KEY" \
     https://jarvis-bot.workers.dev/api/voice-notes/NOTE_ID/synced
```

## Troubleshooting

### Common Issues

1. **"Secrets not found" error**
   - Run `npm run setup:secrets:devvars` to set up secrets
   - Verify with: `npx wrangler secret list`

2. **Voice notes not appearing**
   - Check Z-API webhook is pointing to correct URL
   - Verify OBSIDIAN_API_KEY is set correctly
   - Check logs: `npx wrangler tail`

3. **Portfolio reports not sending**
   - Ensure BRAPI_TOKEN is valid
   - Check PORTFOLIO_WHATSAPP_NUMBER format (no + or spaces)
   - Verify scheduled triggers are enabled in Cloudflare dashboard

4. **API authentication failing**
   - Confirm OBSIDIAN_API_KEY matches in both worker and Obsidian plugin
   - Use Bearer token format: `Authorization: Bearer YOUR_KEY`

## Support

- Check logs: `npx wrangler tail`
- View KV data: Cloudflare dashboard → Workers → KV
- Test endpoints: Use curl or Postman with proper auth headers
- Debug locally: `npm run dev` with console.log statements