/**
 * Offline action queue - persists actions when offline, replays when online.
 */

import { getOfflineDb, STORES, type QueuedAction } from './db';

const ACTION_TYPES = [
  'visit.checkin',
  'visit.checkout',
  'visit.note.save',
  'delight.create',
  'report-media.upload',
  'message.send',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function enqueueAction(
  type: ActionType | string,
  params: {
    orgId: string;
    sitterId: string;
    bookingId?: string;
    visitId?: string;
    payload: unknown;
  }
): Promise<string> {
  const id = generateId();
  const action: QueuedAction = {
    id,
    type,
    orgId: params.orgId,
    sitterId: params.sitterId,
    bookingId: params.bookingId,
    visitId: params.visitId,
    payload: params.payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };
  const db = await getOfflineDb();
  await db.put(STORES.actionQueue, action);
  return id;
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORES.actionQueue);
  return all.filter((a) => a.status === 'pending' || a.status === 'failed').sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export async function getQueuedCount(): Promise<number> {
  const pending = await getPendingActions();
  return pending.length;
}

export async function updateActionStatus(
  id: string,
  status: QueuedAction['status'],
  error?: string
): Promise<void> {
  const db = await getOfflineDb();
  const action = await db.get(STORES.actionQueue, id);
  if (!action) return;
  await db.put(STORES.actionQueue, {
    ...action,
    status,
    error,
    retryCount: status === 'failed' ? action.retryCount + 1 : action.retryCount,
  });
}

export async function removeAction(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete(STORES.actionQueue, id);
}

export async function getActionsForBooking(bookingId: string): Promise<QueuedAction[]> {
  const pending = await getPendingActions();
  return pending.filter((a) => a.bookingId === bookingId);
}
