/**
 * SSE endpoint auth tests - 401/403 when unauthenticated or forbidden.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { GET } from '@/app/api/realtime/messages/threads/[id]/route';
import { auth } from '@/lib/auth';

describe('SSE messages thread auth', () => {
  it('returns 401 when not authenticated', async () => {
    (auth as any).mockResolvedValue(null);

    const res = await GET(
      new Request('http://localhost/api/realtime/messages/threads/thread-1'),
      { params: Promise.resolve({ id: 'thread-1' }) }
    );

    expect(res.status).toBe(401);
  });
});
