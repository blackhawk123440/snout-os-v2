/**
 * SSE sitter today auth tests - 401/403 when unauthenticated or not sitter.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

import { GET } from '@/app/api/realtime/sitter/today/route';
import { getRequestContext } from '@/lib/request-context';

describe('SSE sitter today auth', () => {
  it('returns 401 when getRequestContext throws', async () => {
    (getRequestContext as any).mockRejectedValue(new Error('Unauthorized'));

    const res = await GET(new Request('http://localhost/api/realtime/sitter/today'));

    expect(res.status).toBe(401);
  });
});
