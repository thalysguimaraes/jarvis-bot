#!/bin/bash

# Script to set up Cloudflare Worker secrets
# Usage: ./scripts/setup-secrets.sh [staging|production]

ENV=${1:-production}
echo "Setting secrets for environment: $ENV"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Copy .env.example to .env and fill in your values."
    exit 1
fi

# Load environment variables from .env
set -a
source .env
set +a

# Function to set a secret
set_secret() {
    local key=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo "⚠️  Skipping $key (not set)"
    else
        echo "Setting $key..."
        echo "$value" | npx wrangler secret put "$key" --env "$ENV"
    fi
}

echo "🔐 Setting up Cloudflare Worker secrets..."

# Required secrets
set_secret "Z_API_INSTANCE_ID" "$Z_API_INSTANCE_ID"
set_secret "Z_API_INSTANCE_TOKEN" "$Z_API_INSTANCE_TOKEN"
set_secret "Z_API_SECURITY_TOKEN" "$Z_API_SECURITY_TOKEN"
set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
set_secret "TODOIST_API_TOKEN" "$TODOIST_API_TOKEN"
set_secret "GITHUB_TOKEN" "$GITHUB_TOKEN"
set_secret "GITHUB_OWNER" "$GITHUB_OWNER"
set_secret "GITHUB_REPO" "$GITHUB_REPO"
set_secret "BRAPI_TOKEN" "$BRAPI_TOKEN"
set_secret "PORTFOLIO_WHATSAPP_NUMBER" "$PORTFOLIO_WHATSAPP_NUMBER"
set_secret "WEBHOOK_SECRET" "$WEBHOOK_SECRET"

# Optional secrets
set_secret "ZAISEN_API_URL" "$ZAISEN_API_URL"
set_secret "ZAISEN_API_KEY" "$ZAISEN_API_KEY"
set_secret "PORTFOLIO_DATA" "$PORTFOLIO_DATA"
set_secret "FUND_PORTFOLIO_DATA" "$FUND_PORTFOLIO_DATA"

echo "✅ Secrets setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy to staging: npm run deploy:staging"
echo "2. Test the staging environment"
echo "3. Deploy to production: npm run deploy:production"