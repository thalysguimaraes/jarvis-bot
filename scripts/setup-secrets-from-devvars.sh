#!/bin/bash

# Script to set up Cloudflare Worker secrets from .dev.vars
# Usage: ./scripts/setup-secrets-from-devvars.sh

echo "Setting up Cloudflare Worker secrets..."

# Check if .dev.vars file exists
if [ ! -f .dev.vars ]; then
    echo "❌ .dev.vars file not found."
    echo "Please ensure your .dev.vars file exists with all required variables."
    exit 1
fi

# Function to extract value from .dev.vars
get_var() {
    local key=$1
    grep "^${key}=" .dev.vars | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

# Function to set a secret
set_secret() {
    local key=$1
    local value=$2
    
    if [ -z "$value" ] || [ "$value" = "your-"* ] || [ "$value" = "TODO"* ]; then
        echo "⚠️  Skipping $key (not configured or placeholder value)"
    else
        echo "Setting $key..."
        echo "$value" | npx wrangler secret put "$key"
    fi
}

echo "🔐 Setting up Cloudflare Worker secrets from .dev.vars..."

# Required secrets
set_secret "Z_API_INSTANCE_ID" "$(get_var Z_API_INSTANCE_ID)"
set_secret "Z_API_INSTANCE_TOKEN" "$(get_var Z_API_INSTANCE_TOKEN)"
set_secret "Z_API_SECURITY_TOKEN" "$(get_var Z_API_SECURITY_TOKEN)"
set_secret "OPENAI_API_KEY" "$(get_var OPENAI_API_KEY)"
set_secret "TODOIST_API_TOKEN" "$(get_var TODOIST_API_TOKEN)"
set_secret "OBSIDIAN_API_KEY" "$(get_var OBSIDIAN_API_KEY)"
set_secret "BRAPI_TOKEN" "$(get_var BRAPI_TOKEN)"
set_secret "PORTFOLIO_WHATSAPP_NUMBER" "$(get_var PORTFOLIO_WHATSAPP_NUMBER)"
set_secret "WEBHOOK_SECRET" "$(get_var WEBHOOK_SECRET)"

# Optional secrets
set_secret "ZAISEN_API_URL" "$(get_var ZAISEN_API_URL)"
set_secret "ZAISEN_API_KEY" "$(get_var ZAISEN_API_KEY)"
set_secret "PORTFOLIO_DATA" "$(get_var PORTFOLIO_DATA)"
set_secret "FUND_PORTFOLIO_DATA" "$(get_var FUND_PORTFOLIO_DATA)"

# GitHub Discovery secrets (optional)
set_secret "GITHUB_DISCOVERY_ENABLED" "$(get_var GITHUB_DISCOVERY_ENABLED)"
set_secret "GITHUB_DISCOVERY_WHATSAPP_NUMBER" "$(get_var GITHUB_DISCOVERY_WHATSAPP_NUMBER)"
set_secret "TWITTER_USERNAME" "$(get_var TWITTER_USERNAME)"
set_secret "TWITTER_PASSWORD" "$(get_var TWITTER_PASSWORD)"
set_secret "GITHUB_SCRAPER_API_URL" "$(get_var GITHUB_SCRAPER_API_URL)"
set_secret "GITHUB_SCRAPER_API_KEY" "$(get_var GITHUB_SCRAPER_API_KEY)"

echo "✅ Secrets setup complete!"
echo ""
echo "⚠️  Important: Check for any skipped variables above and add them to .dev.vars"
echo ""
echo "Missing required variables that need to be added:"
echo "1. OBSIDIAN_API_KEY - Your API key for Obsidian plugin authentication"
echo "2. BRAPI_TOKEN - Get from https://brapi.dev"
echo "3. PORTFOLIO_WHATSAPP_NUMBER - WhatsApp number for reports"
echo ""
echo "Next steps:"
echo "1. Add missing variables to .dev.vars"
echo "2. Re-run this script: npm run setup:secrets"
echo "3. Deploy: npm run deploy"
echo "4. Test: curl https://jarvis-bot.thalys.workers.dev/health"