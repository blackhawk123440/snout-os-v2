# Snout OS

Multi-tenant vertical SaaS for in-home pet care businesses. Manages bookings, sitter operations, client communication, payments, and automation across three role-specific portals: Owner (operations/oversight), Sitter (daily work/execution), and Client (booking/trust).

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 18
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL via Prisma 5 ORM
- **Auth:** NextAuth v5 (JWT sessions, credentials provider)
- **Payments:** Stripe (Connect for sitter payouts)
- **Messaging:** Twilio + OpenPhone (masked numbers, thread routing)
- **Queue:** BullMQ + Redis (background jobs, automations)
- **AI:** OpenAI (report generation, smart replies)
- **CSS:** Tailwind CSS with semantic design tokens
- **PWA:** Serwist (offline support, service worker)
- **Testing:** Vitest (unit), Playwright (E2E), axe-core (accessibility)
- **Monitoring:** Sentry (error tracking)

## Local Development

```bash
pnpm install
cp .env.example .env          # Fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
pnpm prisma db push           # Apply schema to database
pnpm prisma db seed           # Seed development data
pnpm dev                      # Start dev server at http://localhost:3000
```

Other commands:

```bash
pnpm run build                # Production build
pnpm run typecheck            # TypeScript check (no emit)
pnpm run test                 # Unit tests (Vitest)
pnpm run test:ui              # E2E tests (Playwright)
pnpm run worker               # Background job worker
pnpm prisma studio            # Database GUI
```

## Architecture

```
src/
  app/                        # Next.js App Router
    api/                      # API routes (~250 endpoints)
      client/                 # Client portal APIs
      sitter/                 # Sitter portal APIs
      bookings/               # Owner booking management
      ops/                    # Operations & diagnostics
      settings/               # Org configuration
      messages/               # Messaging system
    client/                   # Client portal pages
    sitter/                   # Sitter portal pages
    dashboard/                # Owner dashboard
    bookings/                 # Owner bookings UI
    settings/                 # Owner settings UI
  lib/                        # Shared business logic
    tenancy/                  # Multi-tenant org scoping (getScopedDb)
    messaging/                # SMS/thread routing engine
    automations/              # Trigger-condition-action engine
    resonance/                # Sitter rating system (SRS)
    pricing/                  # Rate calculation engine
    payments/                 # Stripe integration
  components/                 # React components
    ui/                       # Design system primitives
    app/                      # Shared app components
    sitter/                   # Sitter portal components
    layout/                   # Shell, nav, page wrappers
  hooks/                      # Custom React hooks
prisma/
  schema.prisma               # Database schema (96 models)
tests/
  e2e/                        # Playwright end-to-end tests
scripts/                      # Build, deploy, and utility scripts
docs/                         # Documentation and internal notes
```

## Key Systems

**Multi-Tenancy:** All tenant data is org-scoped via `getScopedDb()` — a Prisma client proxy that mechanically injects `orgId` into every query. Cross-org data access is impossible at the database layer.

**Auth & RBAC:** JWT sessions via NextAuth v5. Role-based access control via `requireRole()` / `requireAnyRole()`. Three roles: owner, sitter, client. Middleware enforces route-level access.

**Messaging:** Supports Twilio and OpenPhone providers. Client-sitter communication is masked (clients never see sitter phone numbers). Thread routing, assignment windows, and anti-poaching detection are built in.

**Automations:** Rule-based automation engine with triggers (time, event), conditions (AND/OR logic), and actions (SMS, email, status changes). Execution tracked in event ledger.

**Sitter Rating System (Resonance):** Multi-factor scoring system (responsiveness, acceptance rate, completion, timeliness, conduct). Drives tier assignment and compensation.

## Environment Variables

See `.env.example` for the full list. Required:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — JWT encryption key (min 32 chars)
- `NEXTAUTH_URL` — App base URL
- `STRIPE_SECRET_KEY` — Stripe API key
- `REDIS_URL` — Redis connection for BullMQ

## Deployment

Deployed on Render. See `render.yaml` for service configuration. Build: `pnpm prisma generate && pnpm next build`. The worker process runs separately via `pnpm worker`.
