type RuntimeDiagnostics = {
  nodeVersion: string;
  platform: string;
  uptimeSec: number;
  pid: number;
  memoryMb: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  eventLoop: {
    activeHandles: number;
    activeRequests: number;
  };
  capacityConfig: {
    webConcurrency: number | null;
    uvThreadpoolSize: number | null;
    authTrafficLimitPerMin: number;
    authSessionCheckLimitPerMin: number;
    authSessionAnonLimitPerMin: number;
    authMutationLimitPerMin: number;
    authReadLimitPerMin: number;
    messageWorkerConcurrency: number;
  };
};

function parseNumberEnv(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMb(value: number): number {
  return Math.round((value / 1024 / 1024) * 10) / 10;
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const memory = process.memoryUsage();
  const proc = process as unknown as {
    _getActiveHandles?: () => unknown[];
    _getActiveRequests?: () => unknown[];
  };
  const activeHandles = typeof proc._getActiveHandles === "function" ? proc._getActiveHandles().length : 0;
  const activeRequests = typeof proc._getActiveRequests === "function" ? proc._getActiveRequests().length : 0;

  return {
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    memoryMb: {
      rss: toMb(memory.rss),
      heapUsed: toMb(memory.heapUsed),
      heapTotal: toMb(memory.heapTotal),
    },
    eventLoop: {
      activeHandles,
      activeRequests,
    },
    capacityConfig: {
      webConcurrency: parseNumberEnv(process.env.WEB_CONCURRENCY),
      uvThreadpoolSize: parseNumberEnv(process.env.UV_THREADPOOL_SIZE),
      authTrafficLimitPerMin: Number(process.env.AUTH_TRAFFIC_LIMIT_PER_MINUTE || "1800"),
      authSessionCheckLimitPerMin: Number(process.env.AUTH_SESSION_CHECK_LIMIT_PER_MINUTE || "3600"),
      authSessionAnonLimitPerMin: Number(process.env.AUTH_SESSION_ANON_LIMIT_PER_MINUTE || "240"),
      authMutationLimitPerMin: Number(process.env.AUTH_MUTATION_LIMIT_PER_MINUTE || "80"),
      authReadLimitPerMin: Number(process.env.AUTH_READ_LIMIT_PER_MINUTE || "240"),
      messageWorkerConcurrency: Number(process.env.MESSAGE_SEND_WORKER_CONCURRENCY || "24"),
    },
  };
}

export function getStagingInfraRecommendations() {
  return [
    "Increase staging web service to at least 2 instances or next Render plan tier to reduce 502 saturation under high concurrency.",
    "Keep message provider dispatch on separate worker service and pin worker concurrency independently from web concurrency.",
    "Tune WEB_CONCURRENCY and UV_THREADPOOL_SIZE explicitly so Node process parallelism is predictable under burst.",
    "Raise and segment auth/session limits for valid session checks; keep mutation limits strict.",
    "Confirm database connection pool sizing (Prisma + PostgreSQL max_connections) so web + worker pools do not contend.",
  ];
}
