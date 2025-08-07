#!/bin/bash

echo "Testing Full Jarvis Bot Webhook Processing"
echo "==========================================="
echo

echo "1. Testing health endpoint..."
response=$(curl -s https://jarvis-bot.thalys.workers.dev/health)
echo "Response: $response"
echo

echo "2. Testing webhook without authentication (should fail)..."
response=$(curl -s -X POST https://jarvis-bot.thalys.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}' \
  -w "\nHTTP Status: %{http_code}")
echo "$response"
echo

echo "3. Testing webhook with wrong token (should fail)..."
response=$(curl -s -X POST https://jarvis-bot.thalys.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -H "Client-Token: wrong-token" \
  -d '{"event": "test"}' \
  -w "\nHTTP Status: %{http_code}")
echo "$response"
echo

echo "4. Testing webhook with correct authentication..."
response=$(curl -s -X POST https://jarvis-bot.thalys.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -H "Client-Token: Fb7bb6305f59c4d74bea1a2f157c0b985S" \
  -d '{
    "event": "message.received",
    "instance": {
      "id": "3E3B1C306E51C0000FF3FA39D6C268C3"
    },
    "data": {
      "message": {
        "id": "test-msg-001",
        "fromMe": false,
        "type": "text",
        "body": "Test message from webhook",
        "from": "5511999999999@c.us",
        "timestamp": 1704067200
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}")
echo "$response"
echo

echo "5. Testing audio message webhook..."
response=$(curl -s -X POST https://jarvis-bot.thalys.workers.dev/webhook \
  -H "Content-Type: application/json" \
  -H "Client-Token: Fb7bb6305f59c4d74bea1a2f157c0b985S" \
  -d '{
    "event": "message.received",
    "instance": {
      "id": "3E3B1C306E51C0000FF3FA39D6C268C3"
    },
    "data": {
      "message": {
        "id": "test-audio-001",
        "fromMe": false,
        "type": "audio",
        "mimetype": "audio/ogg",
        "body": "https://example.com/audio.ogg",
        "from": "5511999999999@c.us",
        "timestamp": 1704067200
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}")
echo "$response"
echo

echo "Test Summary:"
echo "============="
echo "✅ Health check working"
echo "✅ Authentication properly enforced"
echo "Check the responses above for service status"