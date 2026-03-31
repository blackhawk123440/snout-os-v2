#!/bin/bash
# Quick setup script for Render services
# Usage: RENDER_API_KEY=your_key bash scripts/render-quick-setup.sh

set -e

if [ -z "$RENDER_API_KEY" ]; then
  echo "❌ RENDER_API_KEY environment variable is required"
  exit 1
fi

export RENDER_API_KEY

echo "🚀 Render Quick Setup"
echo "===================="
echo ""

# List services
echo "📋 Listing services..."
pnpm tsx scripts/render-automation.ts list-services

echo ""
echo "🔧 Setting up API service..."
pnpm tsx scripts/render-automation.ts setup-api

echo ""
echo "🔧 Setting up Web service..."
pnpm tsx scripts/render-automation.ts setup-web

echo ""
echo "✅ Setup complete!"
echo ""
echo "⚠️  Next steps:"
echo "   1. Set DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY on API service"
echo "   2. Set NEXTAUTH_URL, NEXTAUTH_SECRET on Web service"
echo "   3. Run database migrations in Render shell"
echo "   4. Run database seed in Render shell"
