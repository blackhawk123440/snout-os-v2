/**
 * Rate limiting utility for Next.js route handlers.
 * Uses Redis when REDIS_URL is set; otherwise in-memory fallback.
 * In-memory: single-instance only, resets on restart. Use Redis for production.
 */

import { isBuildPhase } from '@/lib/runtime-phase';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  /** Unique key prefix (e.g. "form", "auth", "messages") */
  keyPrefix: string;
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  windowSec: number;
}

const REDIS_URL = process.env.REDIS_URL;
let redisClientPromise: Promise<any> | null = null;

// In-memory store: Map<key, { count, resetAt }>
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getMemoryKey(identifier: string, config: RateLimitConfig): string {
  const window = Math.floor(Date.now() / 1000 / config.windowSec) * config.windowSec;
  return `${config.keyPrefix}:${identifier}:${window}`;
}

async function checkMemory(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now() / 1000;
  const key = getMemoryKey(identifier, config);
  const entry = memoryStore.get(key);

  if (!entry) {
    const resetAt = Math.ceil(now / config.windowSec) * config.windowSec;
    memoryStore.set(key, { count: 1, resetAt });
    // Prune old entries periodically
    if (memoryStore.size > 1000) {
      for (const [k, v] of memoryStore) {
        if (v.resetAt < now) memoryStore.delete(k);
      }
    }
    return { success: true, remaining: config.limit - 1, resetAt };
  }

  if (entry.resetAt < now) {
    const resetAt = Math.ceil(now / config.windowSec) * config.windowSec;
    memoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: config.limit - 1, resetAt };
  }

  entry.count += 1;
  if (entry.count > config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil(entry.resetAt - now),
    };
  }
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

async function checkRedis(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  try {
    if (isBuildPhase) {
      return checkMemory(identifier, config);
    }
    if (!redisClientPromise) {
      redisClientPromise = import('ioredis').then(({ default: Redis }) =>
        new Redis(REDIS_URL!, {
          maxRetriesPerRequest: null,
          enableAutoPipelining: true,
          lazyConnect: true,
          enableOfflineQueue: false,
        })
      );
    }
    const redis = await redisClientPromise;
    if (redis.status === 'wait') {
      await redis.connect().catch(() => {});
    }
    const key = `${config.keyPrefix}:${identifier}`;
    const now = Date.now() / 1000;
    const windowStart = Math.floor(now / config.windowSec) * config.windowSec;
    const fullKey = `${key}:${windowStart}`;

    const count = await redis.incr(fullKey);
    if (count === 1) {
      await redis.expire(fullKey, config.windowSec * 2);
    }

    const resetAt = windowStart + config.windowSec;
    const remaining = Math.max(0, config.limit - count);
    const success = count <= config.limit;

    return {
      success,
      remaining,
      resetAt,
      retryAfter: success ? undefined : Math.ceil(resetAt - now),
    };
  } catch (err) {
    console.warn('[rate-limit] Redis failed, falling back to memory:', err);
    redisClientPromise = null;
    return checkMemory(identifier, config);
  }
}

/**
 * Check rate limit for an identifier (IP, userId, etc.).
 * @param identifier - Unique identifier (e.g. IP address)
 * @param config - Rate limit config
 * @returns Result with success, remaining, resetAt, retryAfter
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (REDIS_URL) {
    return checkRedis(identifier, config);
  }
  return checkMemory(identifier, config);
}

/**
 * Get identifier from request (IP or x-forwarded-for).
 */
export function getRateLimitIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Create a 429 response with Retry-After header.
 */
export function rateLimitResponse(retryAfter?: number): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Retry-After': String(retryAfter ?? 60),
  };
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfter: retryAfter ?? 60 }),
    { status: 429, headers }
  );
}
