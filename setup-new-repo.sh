#!/bin/bash

# Script to set up pose-analytics-motion-tracker as a new repository

echo "🚀 Setting up Pose Analytics Motion Tracker repository..."

# Create a new GitHub repository using gh CLI
echo "📦 Creating GitHub repository..."
gh repo create pose-analytics-motion-tracker \
  --public \
  --description "Real-time motion analytics system with YOLOv8 pose detection, speed tracking, and acceleration analysis" \
  --clone=false

# Add the new remote
echo "🔗 Adding GitHub remote..."
git remote add motion-tracker https://github.com/$(gh api user --jq .login)/pose-analytics-motion-tracker.git

# Push to the new repository
echo "📤 Pushing code to new repository..."
git push motion-tracker main

echo "✅ Repository created successfully!"
echo "🌐 Visit: https://github.com/$(gh api user --jq .login)/pose-analytics-motion-tracker"

# Optional: Set up GitHub Pages for demo
echo "📄 Would you like to set up GitHub Pages for a live demo? (y/n)"
read -r response
if [[ "$response" == "y" ]]; then
  gh repo edit pose-analytics-motion-tracker --enable-pages
  echo "✅ GitHub Pages enabled!"
fi