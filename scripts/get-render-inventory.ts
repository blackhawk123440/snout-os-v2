#!/usr/bin/env tsx
/**
 * Render Service Inventory Helper
 * 
 * This script helps you gather the required Render service information.
 * Since we cannot access Render Dashboard directly, this provides a template
 * and instructions for manual collection.
 */

console.log(`
═══════════════════════════════════════════════════════════════
RENDER SERVICE INVENTORY - REQUIRED INFORMATION
═══════════════════════════════════════════════════════════════

Go to: https://dashboard.render.com
Select repo: blackhawk123440/snout-os

For EACH service, provide:
───────────────────────────────────────────────────────────────
1. Service name
2. Type (Web Service / Background Worker)
3. Root directory
4. Build command
5. Start command
6. Public URL (if applicable)

REQUIRED SERVICES:
───────────────────────────────────────────────────────────────

1. snout-os-web (Next.js UI)
   Expected:
   - Type: Web Service
   - Root: . (repo root)
   - Build: prisma generate --schema=prisma/schema.prisma && next build
   - Start: next start
   - URL: https://snout-os-staging.onrender.com ✅

2. snout-os-api (NestJS Backend) - NEEDS CREATION
   Required:
   - Type: Web Service
   - Root: enterprise-messaging-dashboard
   - Build: pnpm install && pnpm --filter @snoutos/shared build && pnpm --filter @snoutos/api build
   - Start: pnpm --filter @snoutos/api start:prod
   - URL: https://snout-os-api.onrender.com (to be created)

3. snout-os-worker (BullMQ Workers) - NEEDS CREATION
   Required:
   - Type: Background Worker
   - Root: enterprise-messaging-dashboard
   - Build: pnpm install && pnpm --filter @snoutos/shared build && pnpm --filter @snoutos/api build
   - Start: pnpm --filter @snoutos/api worker:prod
   - URL: N/A (background worker)

═══════════════════════════════════════════════════════════════
`);
