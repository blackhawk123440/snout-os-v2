import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

describe('POST /api/twilio/inbound', () => {
  it('returns 410 with canonical webhook path', async () => {
    const req = new NextRequest('https://example.com/api/twilio/inbound', {
      method: 'POST',
      body: 'From=%2B15550001111&To=%2B15550002222&Body=hello',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    const res = await POST(req);
    const payload = await res.json();
    expect(res.status).toBe(410);
    expect(payload.canonicalPath).toBe('/api/messages/webhook/twilio');
  });
});
