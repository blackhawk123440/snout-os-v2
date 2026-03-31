/**
 * Page smoke: /reports and /analytics modules load and export default component.
 * Range selector state is driven by React state (tested implicitly via load).
 */

import { describe, it, expect } from 'vitest';

describe('Reports page', () => {
  it('loads without error', async () => {
    const mod = await import('@/app/reports/page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

describe('Analytics page', () => {
  it('loads without error', async () => {
    const mod = await import('@/app/analytics/page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
