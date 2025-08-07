#!/bin/bash

# Script to set your portfolio data in Cloudflare Workers

echo "========================================="
echo "     Portfolio Configuration Helper      "
echo "========================================="
echo ""

# Check if portfolio-example.json exists
if [ -f "portfolio-example.json" ]; then
    echo "📋 Example portfolio format (portfolio-example.json):"
    echo ""
    cat portfolio-example.json
    echo ""
    echo "========================================="
fi

echo ""
echo "Please enter your portfolio data in JSON format."
echo "Format: [{\"ticker\":\"SYMBOL\",\"shares\":NUMBER,\"avgPrice\":PRICE}, ...]"
echo ""
echo "Common Brazilian stocks:"
echo "  - PETR4, VALE3, BBDC4, ITUB4, ABEV3, WEGE3, BBAS3"
echo "  - AAPL34, GOOGL34, MSFT34, AMZO34 (BDRs)"
echo ""
echo "Example:"
echo '[{"ticker":"PETR4","shares":100,"avgPrice":35.50}]'
echo ""
echo "You can also paste the content from portfolio-example.json and modify it."
echo ""
echo "Enter your portfolio (single line, or type 'file' to use a file):"
read -r portfolio_input

if [ "$portfolio_input" = "file" ]; then
    echo "Enter the path to your JSON file:"
    read -r file_path
    if [ -f "$file_path" ]; then
        # Read file and minify JSON
        portfolio_input=$(cat "$file_path" | jq -c '.')
        echo "✅ Loaded portfolio from file"
    else
        echo "❌ File not found: $file_path"
        exit 1
    fi
fi

# Validate JSON
echo "$portfolio_input" | jq empty 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Invalid JSON format. Please check your data."
    exit 1
fi

# Show summary
echo ""
echo "📊 Portfolio Summary:"
echo "$portfolio_input" | jq -r '.[] | "  - \(.ticker): \(.shares) shares @ R$ \(.avgPrice)"'
echo ""

# Confirm before setting
echo "Do you want to set this as your portfolio? (y/n)"
read -r confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Cancelled"
    exit 0
fi

# Set the secret
echo ""
echo "Setting PORTFOLIO_DATA secret..."
echo "$portfolio_input" | npx wrangler secret put PORTFOLIO_DATA

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Portfolio data set successfully!"
    echo ""
    echo "You can now test it by running:"
    echo "  curl https://jarvis-bot.thalys.workers.dev/api/portfolio/send-direct"
    echo ""
    echo "Your portfolio report will be sent to WhatsApp number: $PORTFOLIO_WHATSAPP_NUMBER"
else
    echo "❌ Failed to set portfolio data"
    exit 1
fi