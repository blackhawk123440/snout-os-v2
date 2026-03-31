/**
 * Replay queued actions against API endpoints when online.
 * Uses exponential backoff for retries.
 */

import type { QueuedAction } from './db';
import { updateActionStatus, removeAction } from './action-queue';
import { getOfflineDb, STORES } from './db';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function replayCheckIn(action: QueuedAction): Promise<{ ok: boolean; error?: string }> {
  const payload = action.payload as { lat?: number; lng?: number };
  const res = await fetch(`/api/bookings/${action.bookingId}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true };
}

async function replayCheckOut(action: QueuedAction): Promise<{ ok: boolean; error?: string }> {
  const payload = action.payload as { lat?: number; lng?: number };
  const res = await fetch(`/api/bookings/${action.bookingId}/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true };
}

async function replayDelightCreate(action: QueuedAction): Promise<{ ok: boolean; error?: string }> {
  const payload = action.payload as {
    report?: string;
    tone?: string;
    mediaUrls?: string[];
    photoIds?: string[];
  };
  let mediaUrls: string[] = payload.mediaUrls || [];

  // If photoIds present, upload blobs from pending-photos first, then use returned URLs
  const photoIds = payload.photoIds || [];
  if (photoIds.length > 0 && action.bookingId) {
    const db = await getOfflineDb();
    const formData = new FormData();
    formData.set('bookingId', action.bookingId);
    let hasFiles = false;
    for (const photoId of photoIds) {
      const photo = (await db.get(STORES.pendingPhotos, photoId)) as
        | { blob?: Blob; mimeType?: string }
        | undefined;
      if (photo?.blob) {
        const file = new File([photo.blob], `photo-${photoId}.jpg`, {
          type: photo.mimeType || 'image/jpeg',
        });
        formData.append('files', file);
        hasFiles = true;
      }
    }
    if (hasFiles) {
      const uploadRes = await fetch('/api/upload/report-media', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) return { ok: false, error: uploadData.error || uploadRes.statusText };
      mediaUrls = uploadData.urls || [];
      for (const photoId of photoIds) {
        await db.delete(STORES.pendingPhotos, photoId);
      }
    }
  }

  const res = await fetch(`/api/bookings/${action.bookingId}/daily-delight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report: payload.report,
      tone: payload.tone,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true };
}

async function replayReportMediaUpload(action: QueuedAction): Promise<{ ok: boolean; error?: string }> {
  const payload = action.payload as { photoIds?: string[] };
  const photoIds = payload?.photoIds || [];
  if (photoIds.length === 0) return { ok: true };
  const db = await getOfflineDb();
  const formData = new FormData();
  formData.set('bookingId', action.bookingId!);
  let hasFiles = false;
  for (const photoId of photoIds) {
    const photo = await db.get(STORES.pendingPhotos, photoId) as { blob?: Blob; mimeType?: string } | undefined;
    if (photo?.blob) {
      const file = new File([photo.blob], `photo-${photoId}.jpg`, { type: photo.mimeType || 'image/jpeg' });
      formData.append('files', file);
      hasFiles = true;
    }
  }
  if (!hasFiles) return { ok: true };
  const res = await fetch('/api/upload/report-media', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  for (const photoId of photoIds) {
    await db.delete(STORES.pendingPhotos, photoId);
  }
  return { ok: true };
}

async function replayMessageSend(action: QueuedAction): Promise<{ ok: boolean; error?: string }> {
  const payload = action.payload as { threadId?: string; body?: string };
  if (!payload?.threadId || !payload?.body) {
    return { ok: false, error: 'Missing threadId/body for queued message' };
  }
  const res = await fetch(`/api/sitter/threads/${payload.threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: payload.body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true };
}

const REPLAY_HANDLERS: Record<string, (a: QueuedAction) => Promise<{ ok: boolean; error?: string }>> = {
  'visit.checkin': replayCheckIn,
  'visit.checkout': replayCheckOut,
  'delight.create': replayDelightCreate,
  'report-media.upload': replayReportMediaUpload,
  'message.send': replayMessageSend,
};

export async function replayAction(action: QueuedAction): Promise<boolean> {
  const handler = REPLAY_HANDLERS[action.type];
  if (!handler) {
    await updateActionStatus(action.id, 'failed', `Unknown action type: ${action.type}`);
    return false;
  }
  if (!action.bookingId && action.type !== 'report-media.upload' && action.type !== 'message.send') {
    await updateActionStatus(action.id, 'failed', 'Missing bookingId');
    return false;
  }
  await updateActionStatus(action.id, 'syncing');
  try {
    const result = await handler(action);
    if (result.ok) {
      await removeAction(action.id);
      return true;
    }
    await updateActionStatus(action.id, 'failed', result.error);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateActionStatus(action.id, 'failed', msg);
    return false;
  }
}

export async function processQueue(
  onProgress?: (processed: number, failed: number) => void
): Promise<{ processed: number; failed: number }> {
  const { getPendingActions } = await import('./action-queue');
  const pending = await getPendingActions();
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const action = pending[i];
    const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, action.retryCount), 60000);
    if (action.retryCount > 0) {
      await delay(backoff);
    }
    const success = await replayAction(action);
    if (success) processed++;
    else failed++;
    onProgress?.(processed, failed);
  }
  return { processed, failed };
}
