/**
 * Feature Completion Gate — Canonical contract for "implemented"
 *
 * Each feature gets a row. Status + definitionOfDone define what "done" means.
 *
 * IMPORTANT: Routes listed here must be REAL pages, not redirect shells.
 * Redirect-only routes (e.g., /calendar → /bookings?view=calendar) are
 * URL compatibility shims and should NOT be listed as features.
 *
 * DoD: "UI+API+RBAC+E2E" = surface-complete + API contract + permissions + tests
 */

export type Portal = 'owner' | 'sitter' | 'client';
export type FeatureStatus = 'live' | 'beta' | 'coming_soon';

export interface FeatureEntry {
  portal: Portal;
  slug: string;
  routes: string[];
  apis: string[];
  tests: {
    snapshot?: string;
    smoke?: string;
    contract?: string;
    e2e?: string;
  };
  status: FeatureStatus;
  definitionOfDone: string;
}

/** Canonical feature set — single source of truth */
export const FEATURE_MATRIX: FeatureEntry[] = [
  // ─── Owner: Ops & Dispatch ─────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.dashboard',
    routes: ['/dashboard'],
    apis: ['/api/ops/command-center/attention'],
    tests: { snapshot: 'owner-dashboard' },
    status: 'live',
    definitionOfDone: 'KPIs, needs-attention queue, ops overview',
  },
  {
    portal: 'owner',
    slug: 'owner.bookings',
    routes: ['/bookings', '/bookings/new', '/bookings/[id]'],
    apis: ['/api/bookings', '/api/bookings/[id]'],
    tests: { snapshot: 'owner-bookings' },
    status: 'live',
    definitionOfDone: 'List + detail + create + calendar view tab',
  },
  {
    portal: 'owner',
    slug: 'owner.clients',
    routes: ['/clients', '/clients/[id]'],
    apis: ['/api/clients', '/api/clients/[id]'],
    tests: { snapshot: 'owner-clients' },
    status: 'live',
    definitionOfDone: 'List + profile + pets + waitlist tab',
  },
  {
    portal: 'owner',
    slug: 'owner.sitters',
    routes: ['/sitters', '/sitters/[id]'],
    apis: ['/api/sitters', '/api/sitters/[id]'],
    tests: { snapshot: 'owner-sitters' },
    status: 'live',
    definitionOfDone: 'List + profile + tiers + payroll tab + growth tab + rankings tab',
  },
  // ─── Owner: Comms ────────────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.messaging',
    routes: ['/messaging'],
    apis: ['/api/messages/threads', '/api/messages/threads/[id]', '/api/messages/send'],
    tests: { snapshot: 'owner-messaging' },
    status: 'live',
    definitionOfDone: 'Inbox + thread view + sitters tab',
  },
  // ─── Owner: Money ────────────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.money',
    routes: ['/money'],
    apis: ['/api/payments', '/api/ops/finance/summary', '/api/ops/finance/annual-summary', '/api/analytics/kpis'],
    tests: { snapshot: 'owner-money' },
    status: 'live',
    definitionOfDone: 'Payments tab + Finance tab + Reports tab + Analytics tab',
  },
  // ─── Owner: Settings ─────────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.settings',
    routes: ['/settings'],
    apis: ['/api/settings/business', '/api/automations'],
    tests: { snapshot: 'owner-settings' },
    status: 'live',
    definitionOfDone: 'Business settings, branding, automations, templates, integrations, numbers, bundles, reviews, digest',
  },
  {
    portal: 'owner',
    slug: 'owner.automations',
    routes: ['/settings/automations', '/settings/automations/history'],
    apis: ['/api/automations', '/api/automations/settings', '/api/automations/ledger'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Settings toggles + execution history',
  },
  // ─── Owner: Numbers ──────────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.numbers',
    routes: ['/numbers'],
    apis: ['/api/numbers', '/api/numbers/[id]/release-from-twilio'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Inventory + buy/import/quarantine/release/assign actions',
  },
  // ─── Owner: Ops Tools ────────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.ops',
    routes: ['/ops/diagnostics', '/ops/failures', '/ops/payouts', '/ops/ai'],
    apis: ['/api/ops/failures', '/api/ops/payouts'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Queue failures + payout ops + AI governance + calendar repair',
  },
  {
    portal: 'owner',
    slug: 'owner.exceptions',
    routes: ['/exceptions'],
    apis: [],
    tests: {},
    status: 'live',
    definitionOfDone: 'Exception queue viewer with filters',
  },
  // ─── Owner: Setup ────────────────────────────────────────────────────
  {
    portal: 'owner',
    slug: 'owner.setup',
    routes: ['/setup'],
    apis: ['/api/setup/readiness'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Provider connection + readiness checks',
  },
  // ─── Sitter ──────────────────────────────────────────────────────────
  {
    portal: 'sitter',
    slug: 'sitter.dashboard',
    routes: ['/sitter/dashboard'],
    apis: ['/api/sitter/dashboard'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Today overview + upcoming jobs',
  },
  {
    portal: 'sitter',
    slug: 'sitter.today',
    routes: ['/sitter/today'],
    apis: ['/api/sitter/today'],
    tests: { snapshot: 'today' },
    status: 'live',
    definitionOfDone: 'Active jobs + check-in/out',
  },
  {
    portal: 'sitter',
    slug: 'sitter.jobs',
    routes: ['/sitter/bookings'],
    apis: ['/api/sitter/bookings'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Active/upcoming/completed',
  },
  {
    portal: 'sitter',
    slug: 'sitter.inbox',
    routes: ['/sitter/inbox'],
    apis: ['/api/sitter/threads', '/api/messages/send'],
    tests: { snapshot: 'inbox' },
    status: 'live',
    definitionOfDone: 'Thread list + composer + offline queue + window enforcement',
  },
  {
    portal: 'sitter',
    slug: 'sitter.availability',
    routes: ['/sitter/availability'],
    apis: ['/api/sitter/availability'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Toggle + time blocks',
  },
  {
    portal: 'sitter',
    slug: 'sitter.earnings',
    routes: ['/sitter/earnings'],
    apis: ['/api/sitter/earnings', '/api/sitter/transfers'],
    tests: { snapshot: 'earnings' },
    status: 'live',
    definitionOfDone: 'Earnings breakdown + payout transfers + tips',
  },
  {
    portal: 'sitter',
    slug: 'sitter.performance',
    routes: ['/sitter/performance'],
    apis: ['/api/sitter/performance'],
    tests: {},
    status: 'live',
    definitionOfDone: 'SRS score breakdown + tier display + level-up tips',
  },
  {
    portal: 'sitter',
    slug: 'sitter.reports',
    routes: ['/sitter/reports'],
    apis: ['/api/bookings/[id]/daily-delight'],
    tests: {},
    status: 'beta',
    definitionOfDone: 'Report submission + history',
  },
  {
    portal: 'sitter',
    slug: 'sitter.calendar',
    routes: ['/sitter/calendar'],
    apis: ['/api/sitter/calendar'],
    tests: { snapshot: 'calendar' },
    status: 'live',
    definitionOfDone: 'Schedule view + Google Calendar sync',
  },
  {
    portal: 'sitter',
    slug: 'sitter.profile',
    routes: ['/sitter/profile'],
    apis: ['/api/sitter/me'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Profile settings + Stripe connect',
  },
  {
    portal: 'sitter',
    slug: 'sitter.onboard',
    routes: ['/sitter/onboard'],
    apis: ['/api/sitter/onboard/validate', '/api/sitter/onboard/set-password'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Multi-step onboarding (password + profile + availability + Stripe)',
  },
  {
    portal: 'sitter',
    slug: 'sitter.training',
    routes: ['/sitter/training'],
    apis: [],
    tests: {},
    status: 'beta',
    definitionOfDone: 'Training modules (client-side only — no backend verification)',
  },
  // ─── Client ──────────────────────────────────────────────────────────
  {
    portal: 'client',
    slug: 'client.home',
    routes: ['/client/home'],
    apis: ['/api/client/home'],
    tests: { snapshot: 'client-home' },
    status: 'live',
    definitionOfDone: 'Upcoming visits + latest report',
  },
  {
    portal: 'client',
    slug: 'client.bookings',
    routes: ['/client/bookings', '/client/bookings/new', '/client/bookings/[id]'],
    apis: ['/api/client/bookings'],
    tests: { snapshot: 'client-bookings' },
    status: 'live',
    definitionOfDone: 'List + detail + create (via form) + cancel',
  },
  {
    portal: 'client',
    slug: 'client.pets',
    routes: ['/client/pets', '/client/pets/new', '/client/pets/[id]'],
    apis: ['/api/client/pets'],
    tests: { snapshot: 'client-pets' },
    status: 'live',
    definitionOfDone: 'CRUD + health timeline',
  },
  {
    portal: 'client',
    slug: 'client.reports',
    routes: ['/client/reports'],
    apis: ['/api/client/reports'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Feed + detail',
  },
  {
    portal: 'client',
    slug: 'client.messages',
    routes: ['/client/messages', '/client/messages/[id]'],
    apis: ['/api/client/messages'],
    tests: { snapshot: 'client-messages' },
    status: 'live',
    definitionOfDone: 'Threads + composer',
  },
  {
    portal: 'client',
    slug: 'client.billing',
    routes: ['/client/billing'],
    apis: ['/api/client/billing'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Invoices + payment links + loyalty display + bundles',
  },
  {
    portal: 'client',
    slug: 'client.recurring',
    routes: ['/client/recurring'],
    apis: ['/api/client/recurring-schedules'],
    tests: {},
    status: 'live',
    definitionOfDone: 'Recurring schedule management',
  },
  {
    portal: 'client',
    slug: 'client.profile',
    routes: ['/client/profile'],
    apis: ['/api/client/me'],
    tests: { snapshot: 'client-profile' },
    status: 'live',
    definitionOfDone: 'Profile settings',
  },
  {
    portal: 'client',
    slug: 'client.loyalty',
    routes: [],
    apis: ['/api/client/billing', '/api/client/referral'],
    tests: {},
    status: 'beta',
    definitionOfDone: 'Points earned on booking completion, displayed in billing. Referral codes generated. Redemption engine implemented but no UI redeem button yet.',
  },
];

/** Route path → page file path (Next.js app router) */
export function routeToPagePath(route: string): string {
  const base = route.replace(/^\/+/, '');
  if (!base) return 'src/app/page.tsx';
  return `src/app/${base}/page.tsx`;
}

/** API path → route file path */
export function apiToRoutePath(api: string): string {
  const base = api.replace(/^\/api\/?/, '');
  if (!base) return 'src/app/api/route.ts';
  return `src/app/api/${base}/route.ts`;
}
