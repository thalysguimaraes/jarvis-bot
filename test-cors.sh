#!/bin/bash

# Test CORS functionality for Jarvis Bot Worker

echo "Testing CORS for Jarvis Bot Worker"
echo "===================================="
echo ""

# Test health endpoint with OPTIONS (preflight)
echo "1. Testing /health endpoint (OPTIONS preflight):"
curl -X OPTIONS \
  https://jarvis-bot.thalys.workers.dev/health \
  -H "Origin: app://obsidian.md" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i 2>/dev/null | grep -E "^(HTTP|Access-Control)"

echo ""
echo "2. Testing /health endpoint (GET with Origin):"
curl -X GET \
  https://jarvis-bot.thalys.workers.dev/health \
  -H "Origin: app://obsidian.md" \
  -i 2>/dev/null | grep -E "^(HTTP|Access-Control|{)"

echo ""
echo "3. Testing /api/voice-notes/unprocessed (OPTIONS preflight):"
curl -X OPTIONS \
  https://jarvis-bot.thalys.workers.dev/api/voice-notes/unprocessed \
  -H "Origin: app://obsidian.md" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -i 2>/dev/null | grep -E "^(HTTP|Access-Control)"

echo ""
echo "4. Testing /api/voice-notes/unprocessed (GET with auth - should fail without key):"
curl -X GET \
  https://jarvis-bot.thalys.workers.dev/api/voice-notes/unprocessed \
  -H "Origin: app://obsidian.md" \
  -H "Authorization: Bearer test-key" \
  -i 2>/dev/null | grep -E "^(HTTP|Access-Control|Unauthorized)"

echo ""
echo "Done! Check if Access-Control headers are present in all responses."