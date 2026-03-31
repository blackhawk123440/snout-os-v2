import { describe, expect, it } from 'vitest';
import { OWNER_SIDEBAR_SECTIONS } from '@/components/layout/OwnerAppShell';

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
    const hrefs = collectHrefs();
    expect(hrefs).toContain('/ops/failures');
  });
});
