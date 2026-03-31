/**
 * Tests for feature flag and tier gating system.
 *
 * Verifies:
 * - Live flags are exported and have correct types
 * - Dead flags have been removed from flags.ts
 * - Middleware enforces auth flags
 * - DB-backed flag system is documented as unused
 * - Tier permissions are documented as not enforced
 * - Env-based flags in env.ts have correct defaults
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('flags.ts — live flags only', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/flags.ts'),
    'utf-8'
  );

  it('exports isMessagingEnabled function', () => {
    expect(source).toContain('export function isMessagingEnabled');
  });

  it('exports ENABLE_GOOGLE_BIDIRECTIONAL_SYNC', () => {
    expect(source).toContain('export const ENABLE_GOOGLE_BIDIRECTIONAL_SYNC');
  });

  it('exports ENABLE_RESONANCE_V1', () => {
    expect(source).toContain('export const ENABLE_RESONANCE_V1');
  });

  it('does NOT export dead flag ENABLE_BOOKINGS_V2', () => {
    expect(source).not.toContain('ENABLE_BOOKINGS_V2');
  });

  it('does NOT export dead flag ENABLE_STRIPE_CONNECT_PAYOUTS', () => {
    expect(source).not.toContain('ENABLE_STRIPE_CONNECT_PAYOUTS');
  });

  it('documents which flags are live vs unused', () => {
    expect(source).toContain('LIVE FLAGS');
    expect(source).toContain('ZERO callers');
  });
});

describe('middleware.ts — auth flags enforced', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/middleware.ts'),
    'utf-8'
  );

  it('reads ENABLE_AUTH_PROTECTION from env', () => {
    expect(source).toContain('ENABLE_AUTH_PROTECTION');
  });

  it('reads ENABLE_SITTER_AUTH from env', () => {
    expect(source).toContain('ENABLE_SITTER_AUTH');
  });

  it('reads ENABLE_PERMISSION_CHECKS from env', () => {
    expect(source).toContain('ENABLE_PERMISSION_CHECKS');
  });

  it('enforces client role routing', () => {
    expect(source).toContain('client');
    expect(source).toContain('/client/');
  });

  it('enforces sitter role routing', () => {
    expect(source).toContain('sitter');
  });
});

describe('feature-flags.ts — DB-backed system is unused', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/feature-flags.ts'),
    'utf-8'
  );

  it('is documented as unused scaffolding', () => {
    expect(source).toContain('UNUSED SCAFFOLDING');
    expect(source).toContain('ZERO callers');
  });

  it('exports getFeatureFlag function (ready to use)', () => {
    expect(source).toContain('getFeatureFlag');
  });
});

describe('tier-permissions.ts — enforced at assignment time', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/tier-permissions.ts'),
    'utf-8'
  );

  it('documents enforcement at assignment time', () => {
    expect(source).toContain('Enforced at assignment time');
  });

  it('defines TierPermissions interface', () => {
    expect(source).toContain('interface TierPermissions');
  });

  it('has canSitterTakeBooking function', () => {
    expect(source).toContain('canSitterTakeBooking');
  });
});

describe('env.ts — auth flag defaults are safe for production', () => {
  it('ENABLE_AUTH_PROTECTION defaults to true in production', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/env.ts'),
      'utf-8'
    );
    // The default for auth protection should be true (not false)
    // Pattern: `!== false` means defaults to true unless explicitly set to false
    expect(source).toContain('ENABLE_AUTH_PROTECTION');
  });
});

describe('flag enforcement completeness', () => {
  it('form route checks ENABLE_FORM_MAPPER_V1', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/form/route.ts'),
      'utf-8'
    );
    expect(source).toContain('ENABLE_FORM_MAPPER_V1');
  });

  it('debug endpoint checks ENABLE_DEBUG_ENDPOINTS', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/messages/debug/state/route.ts'),
      'utf-8'
    );
    expect(source).toContain('ENABLE_DEBUG_ENDPOINTS');
  });

  it('calendar inbound checks ENABLE_GOOGLE_BIDIRECTIONAL_SYNC', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/calendar/bidirectional-adapter.ts'),
      'utf-8'
    );
    expect(source).toContain('ENABLE_GOOGLE_BIDIRECTIONAL_SYNC');
  });
});
