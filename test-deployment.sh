#!/bin/bash

echo "Testing Jarvis Bot Deployment"
echo "=============================="
echo

echo "1. Testing health endpoint..."
response=$(curl -s https://jarvis-bot.thalys.workers.dev/health)
echo "Response: $response"
echo

echo "2. Testing webhook endpoint with invalid request..."
response=$(curl -s -X POST https://jarvis-bot.thalys.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP Status: %{http_code}")
echo "$response"
echo

echo "3. Testing webhook with security token..."
response=$(curl -s -X POST https://jarvis-bot.thalys.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -H "X-Z-API-Security-Token: test-token" \
  -d '{"event": "message.received", "instance": {"id": "test"}, "data": {"message": {"fromMe": false}}}' \
  -w "\nHTTP Status: %{http_code}")
echo "$response"
echo

echo "Test complete!"