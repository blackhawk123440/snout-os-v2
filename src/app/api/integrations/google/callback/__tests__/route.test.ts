import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    NEXT_PUBLIC_APP_URL: 'https://app.snout.test',
  },
}));

vi.mock('@/lib/signup-bootstrap', () => ({
  decodeAndVerifyOAuthState: vi.fn(),
  logOAuthCallbackRejection: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        getToken = vi.fn().mockResolvedValue({
          tokens: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expiry_date: Date.UTC(2026, 3, 1),
          },
        });
      },
    },
  },
}));

import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';
import { decodeAndVerifyOAuthState } from '@/lib/signup-bootstrap';
import { GET } from '@/app/api/integrations/google/callback/route';

describe('/api/integrations/google/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (decodeAndVerifyOAuthState as any).mockReturnValue({ sitterId: 'sitter-1' });
    (getScopedDb as any).mockReturnValue({
      sitter: {
        findFirst: vi.fn().mockResolvedValue({ id: 'sitter-1' }),
        update: vi.fn().mockResolvedValue({ id: 'sitter-1' }),
      },
    });
  });

  it('redirects sitter users back to sitter calendar on success', async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'sitter',
        orgId: 'org-1',
        sitterId: 'sitter-1',
      },
    });

    const response = await GET(
      new NextRequest('https://app.snout.test/api/integrations/google/callback?code=abc&state=valid-state')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sitter/calendar?google=connected&sitterId=sitter-1');
  });

  it('redirects owner users to canonical integrations settings on success', async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: 'user-2',
        role: 'owner',
        orgId: 'org-1',
      },
    });

    const response = await GET(
      new NextRequest('https://app.snout.test/api/integrations/google/callback?code=abc&state=valid-state')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/settings?section=integrations&google=connected&sitterId=sitter-1');
  });

  it('redirects to an error state when a sitter tries to connect another sitter calendar', async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'sitter',
        orgId: 'org-1',
        sitterId: 'different-sitter',
      },
    });

    const response = await GET(
      new NextRequest('https://app.snout.test/api/integrations/google/callback?code=abc&state=valid-state')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sitter/calendar?google=forbidden');
  });
});
