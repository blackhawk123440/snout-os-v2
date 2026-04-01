import IORedis from 'ioredis';
import { isBuildPhase } from '@/lib/runtime-phase';

export function createRedisConnection(url?: string) {
  return new IORedis(url || process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: !isBuildPhase,
  });
}
