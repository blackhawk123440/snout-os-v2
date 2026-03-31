#!/bin/bash
# Verify and Fix Web Service Deployment

echo "=========================================="
echo "Web Service Deployment Verification"
echo "=========================================="
echo ""

# Check if service is responding
echo "1. Checking service response..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://snout-os-staging.onrender.com)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
    echo "   ✅ Service is responding (HTTP $HTTP_CODE)"
else
    echo "   ❌ Service not responding (HTTP $HTTP_CODE)"
fi

# Check API health endpoint
echo ""
echo "2. Checking API health endpoint..."
API_HEALTH=$(curl -s https://snout-os-staging.onrender.com/api/auth/health | python3 -c "import sys, json; data = json.load(sys.stdin); print('OK' if data.get('status') == 'ok' else 'FAIL')" 2>/dev/null)
if [ "$API_HEALTH" = "OK" ]; then
    echo "   ✅ API health endpoint working"
else
    echo "   ⚠️  API health endpoint may have issues"
fi

# Check current Render configuration
echo ""
echo "3. Current Render Configuration:"
echo "   Build Command: npm install && npm run build"
echo "   Start Command: next start"
echo "   Root Directory: . (repo root)"
echo ""

# Expected configuration
echo "4. Expected Configuration:"
echo "   Build Command: prisma generate --schema=enterprise-messaging-dashboard/apps/api/prisma/schema.prisma && next build"
echo "   Start Command: next start"
echo "   Root Directory: . (repo root)"
echo ""

echo "=========================================="
echo "ACTION REQUIRED"
echo "=========================================="
echo ""
echo "The build command needs to be updated in Render:"
echo ""
echo "1. Go to: https://dashboard.render.com"
echo "2. Click on: snout-os-staging service"
echo "3. Go to: Settings tab"
echo "4. Update Build Command to:"
echo "   prisma generate --schema=enterprise-messaging-dashboard/apps/api/prisma/schema.prisma && next build"
echo "5. Verify Start Command is: next start"
echo "6. Verify Root Directory is: . (empty/root)"
echo "7. Click: Save Changes (triggers redeploy)"
echo ""
echo "After redeploy, verify with:"
echo "   curl -I https://snout-os-staging.onrender.com"
echo ""
