#!/bin/bash

# Variables
GITHUB_USERNAME="$1"
REPO_NAME="vibe-sessions"

if [ -z "$GITHUB_USERNAME" ]; then
  echo "Please provide your GitHub username as the first argument"
  echo "Usage: ./push_to_github.sh YOUR_GITHUB_USERNAME"
  exit 1
fi

# Configure Git remote
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

# Push to GitHub
echo "Pushing to GitHub repository: $GITHUB_USERNAME/$REPO_NAME"
git push -u origin main

echo "Done! Your code is now on GitHub at: https://github.com/$GITHUB_USERNAME/$REPO_NAME" 