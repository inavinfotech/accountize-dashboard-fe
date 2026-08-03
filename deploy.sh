#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Accountify Dashboard deployment process..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Go to the dashboard directory
cd "$SCRIPT_DIR"

# Build the project
echo "🛠️ Building the production bundle..."
npm run build

# Deploy to Firebase
echo "⚡ Deploying to Firebase Hosting..."
firebase deploy --only hosting:accountify-dashboard

echo "🎉 Dashboard deployment successful!"
