#!/bin/bash

echo "Creating GitHub repository..."

# Create the repository
gh repo create audio2task \
  --public \
  --source=. \
  --description="WhatsApp bot that converts voice messages into Todoist tasks using Baileys" \
  --push

echo "Repository created and code pushed!"
echo "View your repo at: https://github.com/$(gh api user --jq .login)/audio2task"