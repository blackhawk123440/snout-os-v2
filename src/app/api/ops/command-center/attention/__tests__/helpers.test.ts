import { describe, expect, it } from 'vitest';
import {
  dedupeAttentionItems,
  detectSitterOverlaps,
  sortAttentionItems,
  type AttentionItem,
} from '@/app/api/ops/command-center/attention/helpers';

describe('detectSitterOverlaps', () => {
  it('detects overlapping bookings for same sitter', () => {
    const overlaps = detectSitterOverlaps([
      {
        id: 'b1',
        sitterId: 's1',
        startAt: '2026-03-04T10:00:00.000Z',
        endAt: '2026-03-04T11:00:00.000Z',
      },
      {
        id: 'b2',
        sitterId: 's1',
        startAt: '2026-03-04T10:30:00.000Z',
        endAt: '2026-03-04T11:30:00.000Z',
      },
      {
        id: 'b3',
        sitterId: 's2',
        startAt: '2026-03-04T10:30:00.000Z',
        endAt: '2026-03-04T11:30:00.000Z',
      },
    ]);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatchObject({
      sitterId: 's1',
      bookingAId: 'b1',
      bookingBId: 'b2',
    });
  });

  it('returns empty array when no overlap exists', () => {
    const overlaps = detectSitterOverlaps([
      {
        id: 'b1',
        sitterId: 's1',
        startAt: '2026-03-04T10:00:00.000Z',
        endAt: '2026-03-04T11:00:00.000Z',
      },
      {
        id: 'b2',
        sitterId: 's1',
        startAt: '2026-03-04T11:00:00.000Z',
        endAt: '2026-03-04T12:00:00.000Z',
      },
    ]);
    expect(overlaps).toEqual([]);
  });
});

describe('attention helpers', () => {
  it('deduplicates by itemKey and keeps highest severity', () => {
    const items: AttentionItem[] = [
      {
        id: 'automation_failure:b1',
        itemKey: 'automation_failure:b1',
        type: 'automation_failure',
        category: 'alerts',
        entityId: 'b1',
        title: 'A',
        subtitle: 'a',
        severity: 'medium',
        dueAt: null,
        createdAt: '2026-03-04T10:00:00.000Z',
        primaryActionHref: '/ops/automation-failures',
        primaryActionLabel: 'Retry',
      },
      {
        id: 'automation_failure:b1',
        itemKey: 'automation_failure:b1',
        type: 'automation_failure',
        category: 'alerts',
        entityId: 'b1',
        title: 'B',
        subtitle: 'b',
        severity: 'high',
        dueAt: null,
        createdAt: '2026-03-04T09:00:00.000Z',
        primaryActionHref: '/ops/automation-failures',
        primaryActionLabel: 'Retry',
      },
    ];
    const deduped = dedupeAttentionItems(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].severity).toBe('high');
  });

  it('sorts severity desc, then dueAt asc, then createdAt desc', () => {
    const items: AttentionItem[] = [
      {
        id: 'a',
        itemKey: 'a',
        type: 'automation_failure',
        category: 'alerts',
        entityId: '1',
        title: 'A',
        subtitle: '',
        severity: 'medium',
        dueAt: '2026-03-05T10:00:00.000Z',
        createdAt: '2026-03-04T10:00:00.000Z',
        primaryActionHref: '/ops/automation-failures',
        primaryActionLabel: 'Retry',
      },
      {
        id: 'b',
        itemKey: 'b',
        type: 'coverage_gap',
        category: 'staffing',
        entityId: '2',
        title: 'B',
        subtitle: '',
        severity: 'high',
        dueAt: '2026-03-05T09:00:00.000Z',
        createdAt: '2026-03-04T09:00:00.000Z',
        primaryActionHref: '/bookings',
        primaryActionLabel: 'Assign',
      },
      {
        id: 'c',
        itemKey: 'c',
        type: 'coverage_gap',
        category: 'staffing',
        entityId: '3',
        title: 'C',
        subtitle: '',
        severity: 'high',
        dueAt: '2026-03-05T09:00:00.000Z',
        createdAt: '2026-03-04T11:00:00.000Z',
        primaryActionHref: '/bookings',
        primaryActionLabel: 'Assign',
      },
    ];
    const sorted = sortAttentionItems(items);
    expect(sorted.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
});
