/**
 * Feature Flags
 *
 * Centralized feature flag checking for client and server components.
 * Checks both NEXT_PUBLIC_* (client-accessible) and server-only env vars.
 *
 * LIVE FLAGS (actually enforced somewhere):
 * - isMessagingEnabled()           — UI gating for messaging inbox
 * - ENABLE_GOOGLE_BIDIRECTIONAL_SYNC — Calendar inbound adapter + scheduled poll
 * - ENABLE_RESONANCE_V1           — Calendar resonance signals UI
 *
 * Auth/permission flags are in src/lib/env.ts (ENABLE_AUTH_PROTECTION, etc.)
 * and enforced in src/middleware.ts.
 *
 * The FeatureFlag Prisma model + src/lib/feature-flags.ts exist but have
 * ZERO callers in the codebase. The DB-backed flag system is unused scaffolding.
 */

/**
 * Check if messaging V1 is enabled.
 * Used by: InboxView component, DiagnosticsPanel.
 */
export function isMessagingEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ENABLE_MESSAGING_V1 === 'true';
  }
  return (
    process.env.NEXT_PUBLIC_ENABLE_MESSAGING_V1 === 'true' ||
    process.env.ENABLE_MESSAGING_V1 === 'true'
  );
}

/**
 * Enable calendar resonance signals on calendar view.
 * Used by: CalendarViewContent component.
 */
export const ENABLE_RESONANCE_V1 =
  process.env.NEXT_PUBLIC_ENABLE_RESONANCE_V1 === 'true' ||
  process.env.ENABLE_RESONANCE_V1 === 'true';

/**
 * Enable inbound Google Calendar → Snout reconciliation adapter.
 * Off by default. When enabled, polls Google Calendar every 15 min.
 * Used by: bidirectional-adapter.ts, calendar-queue.ts.
 */
export const ENABLE_GOOGLE_BIDIRECTIONAL_SYNC =
  process.env.NEXT_PUBLIC_ENABLE_GOOGLE_BIDIRECTIONAL_SYNC === 'true' ||
  process.env.ENABLE_GOOGLE_BIDIRECTIONAL_SYNC === 'true';
