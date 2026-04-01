import { describe, expect, it } from 'vitest';
import { OWNER_SIDEBAR_SECTIONS, OWNER_SUPPORT_SECTION } from '@/components/layout/OwnerAppShell';

function collectHrefs() {
  const hrefs: string[] = [];
  for (const section of OWNER_SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      hrefs.push(item.href);
      if (item.children) {
        for (const child of item.children) {
          hrefs.push(child.href);
        }
      }
    }
  }
  return hrefs;
}

describe('OwnerAppShell navigation', () => {
  it('exposes queue failures for ops/admin users', () => {
    const hrefs = [
      ...collectHrefs(),
      ...OWNER_SUPPORT_SECTION.items.flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) ?? [])]),
    ];
    expect(hrefs).toContain('/ops/failures');
  });

  it('keeps the lean core owner routes in primary navigation', () => {
    const hrefs = collectHrefs();
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/bookings');
    expect(hrefs).toContain('/calendar');
    expect(hrefs).toContain('/clients');
    expect(hrefs).toContain('/sitters');
    expect(hrefs).toContain('/messaging');
    expect(hrefs).toContain('/money');
    expect(hrefs).toContain('/settings');
  });
});
