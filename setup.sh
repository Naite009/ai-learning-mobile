#!/bin/bash

echo "🚀 Setting up AI Learning Mobile App..."

# Update system
sudo apt-get update

# Install Node.js (LTS version)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📱 Installing app dependencies..."
npm install

# Install Expo CLI globally
echo "🔧 Installing Expo CLI..."
npm install -g @expo/cli

# Install EAS CLI (for building)
echo "🏗️ Installing EAS CLI..."
npm install -g @expo/eas-cli

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the app:"
echo "  npx expo start --tunnel"
echo ""
echo "Then scan the QR code with Expo Go on your phone!"
echo ""
