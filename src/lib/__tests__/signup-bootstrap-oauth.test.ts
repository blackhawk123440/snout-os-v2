/**
 * Vitest: OAuth state encoding/verification (expired callback, wrong-org callback).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  encodeOAuthState,
  decodeAndVerifyOAuthState,
} from '@/lib/signup-bootstrap';

describe('signup-bootstrap OAuth state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('encodeOAuthState includes orgId, userId, sitterId and expiry', () => {
    const state = encodeOAuthState({
      orgId: 'org-1',
      userId: 'user-1',
      sitterId: 'sitter-1',
    });
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    expect(decoded.orgId).toBe('org-1');
    expect(decoded.userId).toBe('user-1');
    expect(decoded.sitterId).toBe('sitter-1');
    expect(decoded.exp).toBeGreaterThan(Date.now());
  });

  it('decodeAndVerifyOAuthState returns sitterId when state matches and not expired', () => {
    const state = encodeOAuthState({
      orgId: 'org-1',
      userId: 'user-1',
      sitterId: 'sitter-1',
    });
    const verified = decodeAndVerifyOAuthState(state, { orgId: 'org-1', userId: 'user-1' });
    expect(verified).toEqual({ sitterId: 'sitter-1' });
  });

  it('expired callback: returns null when state is expired', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const state = encodeOAuthState({
      orgId: 'org-1',
      userId: 'user-1',
      sitterId: 'sitter-1',
    });
    vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
    const verified = decodeAndVerifyOAuthState(state, { orgId: 'org-1', userId: 'user-1' });
    expect(verified).toBeNull();
  });

  it('wrong-org callback: returns null when state.orgId does not match session', () => {
    const state = encodeOAuthState({
      orgId: 'org-other',
      userId: 'user-1',
      sitterId: 'sitter-1',
    });
    const verified = decodeAndVerifyOAuthState(state, { orgId: 'org-1', userId: 'user-1' });
    expect(verified).toBeNull();
  });

  it('wrong user callback: returns null when state.userId does not match session', () => {
    const state = encodeOAuthState({
      orgId: 'org-1',
      userId: 'user-other',
      sitterId: 'sitter-1',
    });
    const verified = decodeAndVerifyOAuthState(state, { orgId: 'org-1', userId: 'user-1' });
    expect(verified).toBeNull();
  });

  it('invalid state string: returns null', () => {
    expect(decodeAndVerifyOAuthState('not-valid-base64!!!', { orgId: 'org-1', userId: 'user-1' })).toBeNull();
    expect(decodeAndVerifyOAuthState(Buffer.from('{}').toString('base64'), { orgId: 'org-1', userId: 'user-1' })).toBeNull();
  });
});
