# Cloudflare Deployment Cleanup Instructions

## Problem
Multiple deployments are causing duplicate scheduled tasks:
- `jarvis-bot` (base deployment)
- `jarvis-bot-staging` (auto-deployed from develop branch - REMOVED)
- `jarvis-bot-production` (auto-deployed from main branch - CONFLICTS)

This results in duplicate portfolio reports being sent.

## Solution: Single Production Deployment

### Step 1: Delete Redundant Workers in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages
3. **Delete these workers:**
   - `jarvis-bot-staging` (if exists)
   - `jarvis-bot-production` (if exists)
4. **Keep only:** `jarvis-bot` (this will be the single production deployment)

### Step 2: Verify Current Deployment

After the cleanup, only one worker should remain:
- **Name:** `jarvis-bot`
- **Scheduled Tasks:** 
  - `0 12 * * 1-5` (9 AM BRT, Mon-Fri)
  - `0 21 * * 1-5` (6 PM BRT, Mon-Fri)
- **Environment:** Production (no suffix)

### Step 3: Update GitHub Secrets (if needed)

Ensure GitHub secrets point to the correct Cloudflare account/zone where `jarvis-bot` is deployed.

### Step 4: Test Deployment

After cleanup, push to main branch to verify:
1. GitHub Actions deploys to `jarvis-bot` worker
2. No duplicate messages are sent
3. Messages include "v2.1" identifier

## Expected Results

✅ Single portfolio report at 9 AM BRT (weekdays only)
✅ Single fund check at 6 PM BRT (weekdays only)  
✅ No weekend messages
✅ Modern message format with version identifier
✅ No duplicate/conflicting deployments

## Rollback Plan

If issues occur, the original `wrangler-old.toml` configuration can be restored from git history, but the multiple environment approach should be avoided to prevent duplicate scheduled tasks.