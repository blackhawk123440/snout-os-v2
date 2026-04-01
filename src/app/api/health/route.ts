import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRedisConnection } from "@/lib/health-checks";
import { getRuntimeEnvName, isRedisRequiredEnv } from "@/lib/runtime-env";
import { getRuntimeDiagnostics, getStagingInfraRecommendations } from "@/lib/runtime-diagnostics";
import { isBuildPhase } from "@/lib/runtime-phase";

function getVersion(): string {
  return (
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.GIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    "unknown"
  );
}

function getBuildTime(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    process.env.BUILD_TIME ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET() {
  const version = getVersion();
  let dbStatus: "ok" | "error" = "ok";
  let redisStatus: "ok" | "degraded" | "error" = "ok";
  const envName = getRuntimeEnvName();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  const redisRequired = !isBuildPhase && isRedisRequiredEnv();
  try {
    const redis = await checkRedisConnection();
    redisStatus = redis.connected ? "ok" : redisRequired ? "error" : "degraded";
  } catch {
    redisStatus = redisRequired ? "error" : "degraded";
  }

  // Worker health: check for stale jobs as a proxy for worker liveness.
  // Cron scheduling records (daily-summary, reconciliation, etc.) are written once during
  // worker startup and never transition — BullMQ uses a different job ID for each actual
  // execution. These are excluded from the stale count. Code-side fix: scheduling functions
  // no longer write QueueJobRecords. This exclusion handles records from prior runs.
  const CRON_SCHEDULE_JOB_NAMES = [
    "process-daily-summary",
    "process-pricing-reconciliation",
    "reminder-dispatcher",
    "calendar:inboundPoll",
    "release-pool-numbers",
  ];
  let workerStatus: "ok" | "degraded" | "unknown" = "unknown";
  let staleJobCount = 0;
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    staleJobCount = await prisma.queueJobRecord.count({
      where: {
        status: "QUEUED",
        createdAt: { lt: tenMinAgo },
        jobName: { notIn: CRON_SCHEDULE_JOB_NAMES },
      },
    });
    workerStatus = staleJobCount > 0 ? "degraded" : "ok";
  } catch {
    workerStatus = "unknown";
  }

  const status =
    dbStatus === "error"
      ? "error"
      : redisStatus === "error"
        ? "degraded"
        : workerStatus === "degraded"
          ? "degraded"
          : "ok";

  const commitSha =
    typeof version === "string" && version !== "unknown"
      ? String(version).slice(0, 7)
      : version;
  const buildTime = getBuildTime();
  const runtimeDiagnostics = getRuntimeDiagnostics();

  // Return 503 when critical services are down (DB is always critical)
  const httpStatus = dbStatus === "error" ? 503 : status === "error" ? 503 : 200;

  return NextResponse.json({
    status,
    db: dbStatus,
    redis: redisStatus,
    workers: {
      status: workerStatus,
      staleJobCount,
    },
    version,
    commitSha,
    buildTime: buildTime ?? new Date().toISOString(),
    envName,
    runtimeDiagnostics,
    infraRecommendations: envName === "staging" ? getStagingInfraRecommendations() : undefined,
    timestamp: new Date().toISOString(),
  }, { status: httpStatus });
}

export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
