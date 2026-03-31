/**
 * IndexedDB offline store for sitter Today + visit details.
 * Uses idb for a simple Promise-based API.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'snout-offline';
const DB_VERSION = 1;

export const STORES = {
  todayVisits: 'today-visits',
  visitDetails: 'visit-details',
  actionQueue: 'action-queue',
  pendingPhotos: 'pending-photos',
} as const;

export interface TodayVisitRecord {
  date: string; // YYYY-MM-DD
  fetchedAt: string; // ISO
  payload: unknown;
}

export interface VisitDetailRecord {
  bookingId: string;
  fetchedAt: string;
  payload: unknown;
}

export interface QueuedAction {
  id: string;
  type: string;
  orgId: string;
  sitterId: string;
  bookingId?: string;
  visitId?: string;
  payload: unknown;
  createdAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
  retryCount: number;
}

export interface PendingPhoto {
  id: string;
  bookingId: string;
  blob: Blob;
  createdAt: string;
  mimeType: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('Offline DB is only available in the browser');
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORES.todayVisits)) {
          const todayStore = db.createObjectStore(STORES.todayVisits, { keyPath: 'date' });
          todayStore.createIndex('fetchedAt', 'fetchedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.visitDetails)) {
          const detailStore = db.createObjectStore(STORES.visitDetails, { keyPath: 'bookingId' });
          detailStore.createIndex('fetchedAt', 'fetchedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.actionQueue)) {
          const queueStore = db.createObjectStore(STORES.actionQueue, { keyPath: 'id' });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.pendingPhotos)) {
          db.createObjectStore(STORES.pendingPhotos, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTodayVisits(date: string, payload: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.put(STORES.todayVisits, {
    date,
    fetchedAt: new Date().toISOString(),
    payload,
  });
}

export async function getTodayVisits(date: string): Promise<unknown | null> {
  const db = await getOfflineDb();
  const record = await db.get(STORES.todayVisits, date);
  return record?.payload ?? null;
}

export async function saveVisitDetail(bookingId: string, payload: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.put(STORES.visitDetails, {
    bookingId,
    fetchedAt: new Date().toISOString(),
    payload,
  });
}

export async function getVisitDetail(bookingId: string): Promise<unknown | null> {
  const db = await getOfflineDb();
  const record = await db.get(STORES.visitDetails, bookingId);
  return record?.payload ?? null;
}

function generatePhotoId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function addPendingPhoto(
  bookingId: string,
  blob: Blob,
  mimeType: string
): Promise<string> {
  const id = generatePhotoId();
  const db = await getOfflineDb();
  await db.put(STORES.pendingPhotos, {
    id,
    bookingId,
    blob,
    mimeType,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function removePendingPhoto(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete(STORES.pendingPhotos, id);
}

export async function getPendingPhotosForBooking(bookingId: string): Promise<PendingPhoto[]> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORES.pendingPhotos);
  return all.filter((p) => p.bookingId === bookingId) as PendingPhoto[];
}

export async function getPendingPhotosCount(): Promise<number> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORES.pendingPhotos);
  return all.length;
}
