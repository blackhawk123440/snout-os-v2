export interface StaffingBookingLike {
  id: string;
  sitterId: string | null;
  startAt: string | Date;
  endAt: string | Date;
}

export interface OverlapPair {
  sitterId: string;
  bookingAId: string;
  bookingBId: string;
  overlapStart: string;
}

export type AttentionSeverity = 'high' | 'medium' | 'low';
export type AttentionAction = 'Fix' | 'Assign' | 'Retry' | 'Open';
export type AttentionCategory = 'alerts' | 'staffing';

export interface AttentionItem {
  id: string;
  itemKey: string;
  type: string;
  category: AttentionCategory;
  entityId: string;
  actionEntityId?: string | null;
  actionMeta?: Record<string, unknown> | null;
  title: string;
  subtitle: string;
  severity: AttentionSeverity;
  dueAt: string | null;
  createdAt: string;
  primaryActionHref: string;
  primaryActionLabel: AttentionAction;
}

export function detectSitterOverlaps(bookings: StaffingBookingLike[]): OverlapPair[] {
  const bySitter = new Map<string, StaffingBookingLike[]>();
  for (const booking of bookings) {
    if (!booking.sitterId) continue;
    const list = bySitter.get(booking.sitterId) ?? [];
    list.push(booking);
    bySitter.set(booking.sitterId, list);
  }

  const overlaps: OverlapPair[] = [];
  for (const [sitterId, sitterBookings] of bySitter.entries()) {
    const sorted = [...sitterBookings].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (new Date(current.endAt).getTime() > new Date(next.startAt).getTime()) {
        overlaps.push({
          sitterId,
          bookingAId: current.id,
          bookingBId: next.id,
          overlapStart: new Date(next.startAt).toISOString(),
        });
      }
    }
  }

  return overlaps;
}

function severityRank(severity: AttentionSeverity): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

export function dedupeAttentionItems(items: AttentionItem[]): AttentionItem[] {
  const deduped = new Map<string, AttentionItem>();
  for (const item of items) {
    const existing = deduped.get(item.itemKey);
    if (!existing) {
      deduped.set(item.itemKey, item);
      continue;
    }

    const itemSeverity = severityRank(item.severity);
    const existingSeverity = severityRank(existing.severity);
    if (itemSeverity > existingSeverity) {
      deduped.set(item.itemKey, item);
      continue;
    }
    if (itemSeverity === existingSeverity) {
      if (new Date(item.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        deduped.set(item.itemKey, item);
      }
    }
  }
  return Array.from(deduped.values());
}

export function sortAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;

    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
