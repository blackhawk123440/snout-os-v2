/**
 * Event bus for real-time updates.
 * Uses Redis pub/sub in production; in-memory fallback for local dev.
 */

import { isBuildPhase } from '@/lib/runtime-phase';

const REDIS_URL = process.env.NODE_ENV === "test" ? "" : process.env.REDIS_URL;

type Handler = (payload: unknown) => void;

// In-memory: Map<channel, Set<handler>>
const memorySubs = new Map<string, Set<Handler>>();

function memoryPublish(channel: string, payload: unknown): void {
  const handlers = memorySubs.get(channel);
  if (handlers) {
    handlers.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error('[realtime] Memory handler error:', e);
      }
    });
  }
}

function memorySubscribe(channel: string, handler: Handler): () => void {
  let handlers = memorySubs.get(channel);
  if (!handlers) {
    handlers = new Set();
    memorySubs.set(channel, handlers);
  }
  handlers.add(handler);
  return () => {
    handlers!.delete(handler);
    if (handlers!.size === 0) memorySubs.delete(channel);
  };
}

let redisClient: import('ioredis').default | null = null;
let redisSub: import('ioredis').default | null = null;

async function getRedisClient(): Promise<import('ioredis').default> {
  if (redisClient) return redisClient;
  const Redis = (await import('ioredis')).default;
  redisClient = new Redis(REDIS_URL!, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: !isBuildPhase,
  });
  return redisClient;
}

async function getRedisSub(): Promise<import('ioredis').default> {
  if (redisSub) return redisSub;
  const Redis = (await import('ioredis')).default;
  redisSub = new Redis(REDIS_URL!, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: !isBuildPhase,
  });
  return redisSub;
}

/**
 * Publish an event to a channel. Fire-and-forget; never throws.
 */
export async function publish(channel: string, payload: unknown): Promise<void> {
  try {
    if (REDIS_URL) {
      const client = await getRedisClient();
      await client.publish(channel, JSON.stringify(payload));
    } else {
      memoryPublish(channel, payload);
    }
  } catch (e) {
    console.warn('[realtime] Publish failed, falling back to memory:', e);
    memoryPublish(channel, payload);
  }
}

/**
 * Subscribe to a channel. Returns unsubscribe function.
 */
export async function subscribe(
  channel: string,
  handler: Handler
): Promise<() => void> {
  if (REDIS_URL) {
    const sub = await getRedisSub();
    const listener = (_ch: string, message: string) => {
      try {
        const payload = JSON.parse(message);
        handler(payload);
      } catch (e) {
        console.error('[realtime] Redis message parse error:', e);
      }
    };
    await sub.subscribe(channel);
    sub.on('message', listener);
    return async () => {
      sub.off('message', listener);
      await sub.unsubscribe(channel);
    };
  }
  return Promise.resolve(memorySubscribe(channel, handler));
}

/** Channel helpers */
export const channels = {
  messagesThread: (orgId: string, threadId: string) =>
    `org:${orgId}:messages:thread:${threadId}`,
  sitterToday: (orgId: string, sitterId: string) =>
    `org:${orgId}:sitter:${sitterId}:today`,
  opsFailures: (orgId: string) => `org:${orgId}:ops:failures`,
  ownerOps: (orgId: string) => `org:${orgId}:owner:ops`,
  /** Client-specific booking/visit updates (check-in, status change, report posted) */
  clientBooking: (orgId: string, clientId: string) =>
    `org:${orgId}:client:${clientId}:bookings`,
  /** Owner dispatch board updates (assignment, callout, conflict) */
  ownerDispatch: (orgId: string) => `org:${orgId}:owner:dispatch`,
} as const;
