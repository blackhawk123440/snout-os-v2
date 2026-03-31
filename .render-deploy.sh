#!/usr/bin/env bash
# Render deploy hook — runs BEFORE the web service starts.
# This ensures database migrations are applied before new code serves requests.

set -euo pipefail

echo "=== Snout OS Deploy Hook ==="
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Verifying schema..."
node scripts/verify-schema.js

echo "=== Deploy hook complete ==="
