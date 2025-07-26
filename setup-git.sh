#!/bin/bash

echo "Setting up git and creating commit..."

# Add all files
git add -A

# Create initial commit
git commit -m "Initial commit: WhatsApp audio to Todoist bot"

# Now push to the already created repo
git branch -M main
git remote add origin https://github.com/thalysguimaraes/audio2task.git
git push -u origin main

echo "Code pushed successfully!"
echo "View your repo at: https://github.com/thalysguimaraes/audio2task"