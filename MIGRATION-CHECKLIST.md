# Migration Checklist - New Architecture Deployment

## Pre-Deployment Steps

### 1. Local Environment Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all required environment variables in `.env`
- [ ] Verify all API keys are valid and active

### 2. GitHub Repository Setup
- [ ] Add all secrets to GitHub Actions (Settings → Secrets and variables → Actions):
  - [ ] `Z_API_INSTANCE_ID`
  - [ ] `Z_API_INSTANCE_TOKEN`
  - [ ] `Z_API_SECURITY_TOKEN`
  - [ ] `OPENAI_API_KEY`
  - [ ] `TODOIST_API_TOKEN`
  - [ ] `OBSIDIAN_API_KEY` (for voice sync API authentication)
  - [ ] `BRAPI_TOKEN`
  - [ ] `PORTFOLIO_WHATSAPP_NUMBER`
  - [ ] `WEBHOOK_SECRET`
  - [ ] `CLOUDFLARE_API_TOKEN`
  - [ ] `CLOUDFLARE_ACCOUNT_ID`
  - [ ] `ZAISEN_API_URL` (optional)
  - [ ] `ZAISEN_API_KEY` (optional)
  - [ ] `SNYK_TOKEN` (optional, for security scanning)

### 3. Cloudflare Setup
- [ ] Make setup script executable: `chmod +x scripts/setup-secrets.sh`
- [ ] Run secret setup for staging: `npm run setup:secrets:staging`
- [ ] Run secret setup for production: `npm run setup:secrets`

### 4. Local Testing
- [ ] Run all tests: `npm run test:run`
- [ ] Test new architecture locally: `npm run dev`
- [ ] Verify health endpoint: `curl http://localhost:8787/health`
- [ ] Test webhook endpoint manually

## Deployment Process

### Phase 1: Staging Deployment
- [ ] Create a `develop` branch: `git checkout -b develop`
- [ ] Push to trigger staging deployment: `git push origin develop`
- [ ] Monitor GitHub Actions for successful deployment
- [ ] Test staging environment endpoints
- [ ] Verify scheduled tasks in Cloudflare dashboard
- [ ] Test WhatsApp integration with test number

### Phase 2: Production Deployment (After Staging Validation)
- [ ] Merge develop to main: `git checkout main && git merge develop`
- [ ] Push to trigger production deployment: `git push origin main`
- [ ] Monitor GitHub Actions for successful deployment
- [ ] Verify deployment: Check health endpoint
- [ ] Update Z-API webhook URL to point to new production endpoint

## Post-Deployment Verification

### Functional Tests
- [ ] Send a voice message to WhatsApp bot
- [ ] Verify task creation in Todoist
- [ ] Check note creation in Obsidian/GitHub
- [ ] Test portfolio report generation
- [ ] Test fund management commands (if enabled)

### Monitoring Setup
- [ ] Check Cloudflare Workers analytics
- [ ] Verify KV namespace is being used correctly
- [ ] Monitor error logs in Cloudflare dashboard
- [ ] Set up alerts for failures (optional)

## Rollback Plan

If issues occur:
1. **Immediate Rollback**: 
   ```bash
   npm run deploy:old  # Deploy old architecture
   ```

2. **GitHub Actions Rollback**:
   - The pipeline automatically rolls back on production failure
   - Manual rollback: Revert the merge commit and push

3. **Keep Old Architecture Available**:
   - Old entry point: `src/index.ts` (unchanged)
   - Old config: `wrangler.toml` (unchanged)
   - Can switch back anytime with: `npm run deploy:old`

## Important URLs

- **Staging**: `https://jarvis-bot-staging.workers.dev`
- **Production**: `https://jarvis-bot.workers.dev`
- **Health Check**: `/health`
- **Z-API Webhook**: `/webhook/zapi`
- **Portfolio Report Trigger**: `POST /api/portfolio/report`
- **Voice Sync API**: 
  - `GET /api/voice-notes/unprocessed` - Get unsynced notes
  - `GET /api/voice-notes/recent` - Get recent notes
  - `POST /api/voice-notes/{id}/synced` - Mark as synced

## Notes

- The new architecture (`index-new.ts`) runs alongside the old one
- Both can be deployed independently
- Scheduled tasks timing:
  - Daily portfolio: 9 AM BRT (12:00 UTC)
  - Fund check: 6 PM BRT (21:00 UTC)
- All modules are lazy-loaded for better cold start performance
- Event-driven architecture allows easy feature toggling

## Troubleshooting

### Common Issues

1. **Environment validation fails**
   - Check all required secrets are set
   - Verify secret values don't have extra spaces/quotes

2. **Module initialization fails**
   - Check service dependencies are registered
   - Verify API keys are valid

3. **Scheduled tasks not running**
   - Check cron expressions in `wrangler-new.toml`
   - Verify triggers are enabled in Cloudflare dashboard

4. **WhatsApp messages not received**
   - Update Z-API webhook URL to new endpoint
   - Check Z-API security token matches

## Support

- Check logs: `npx wrangler tail --env production`
- View KV data: Cloudflare dashboard → Workers → KV
- Debug locally: `npm run dev` with breakpoints