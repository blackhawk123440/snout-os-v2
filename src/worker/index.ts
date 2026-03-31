import { initializeQueues, workerHealth } from "@/lib/queue";
import { initWorkerSentry } from "@/lib/worker-sentry";
import { getRuntimeEnvName, isRedisRequiredEnv } from "@/lib/runtime-env";

initWorkerSentry();

export async function startWorkers() {
  const redisUrl = process.env.REDIS_URL;
  const commitSha =
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    'unknown';
  if (isRedisRequiredEnv() && !redisUrl) {
    throw new Error(`REDIS_URL is required to start workers in ${getRuntimeEnvName()}`);
  }
  console.log("[Worker] Starting background workers...");
  console.log("[Worker] commitSha:", commitSha.slice(0, 7));
  console.log("[Worker] Redis:", redisUrl ? "connected" : "(missing)");
  console.log("[Worker] REDIS_URL:", redisUrl ? redisUrl.replace(/:[^:@]+@/, ":****@") : "(missing)");

  await initializeQueues();

  // Report initialization results
  const failed = Object.entries(workerHealth.workers)
    .filter(([, v]) => v.status === 'failed');
  const ok = Object.entries(workerHealth.workers)
    .filter(([, v]) => v.status === 'ok');

  console.log(`[Worker] Initialization complete: ${ok.length} ok, ${failed.length} failed`);
  if (failed.length > 0) {
    for (const [name, info] of failed) {
      console.error(`[Worker]   FAILED: ${name} — ${info.error}`);
    }
  }
}

if (typeof window === "undefined") {
  startWorkers();
}