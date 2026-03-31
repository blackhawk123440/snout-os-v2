export type RequestMethod = "GET" | "POST";

export interface RequestResultLike {
  ok: boolean;
  status: number;
  latencyMs: number;
  resourceId?: string;
  idempotencyKey?: string;
  retryCount?: number;
  deadLetter?: boolean;
  error?: string;
}

export interface DuplicateMetrics {
  observedDuplicateCount: number;
  unexpectedDuplicateCount: number;
  duplicateRate: number;
}

export interface DuplicateMetricsOptions {
  allowIdempotentReplayDuplicates?: boolean;
}

export interface HttpMockProfile {
  baselineMs: number;
  jitterFactor: number;
  errorRate: number;
}

export type RetryClassification = "success" | "retryable_transient" | "non_retryable_permanent";

export interface StormOutcome {
  classification: RetryClassification;
  retryAttempts: number;
  deadLetter: boolean;
}

export function computeDuplicateMetrics(
  responses: RequestResultLike[],
  options: DuplicateMetricsOptions = {}
): DuplicateMetrics {
  const ids = responses
    .filter((r) => r.ok && r.resourceId)
    .map((r) => ({ resourceId: r.resourceId as string, idempotencyKey: r.idempotencyKey ?? null }));

  const observedDuplicateCount = Math.max(0, ids.length - new Set(ids.map((v) => v.resourceId)).size);
  const groups = new Map<string, Set<string>>();
  for (const item of ids) {
    if (!groups.has(item.resourceId)) groups.set(item.resourceId, new Set());
    groups.get(item.resourceId)!.add(item.idempotencyKey ?? "__none__");
  }
  let unexpectedDuplicateCount = 0;
  for (const keySet of groups.values()) {
    if (keySet.size <= 1) continue;
    if (options.allowIdempotentReplayDuplicates && !keySet.has("__none__")) {
      unexpectedDuplicateCount += keySet.size - 1;
      continue;
    }
    unexpectedDuplicateCount += keySet.size - 1;
  }
  const duplicateRate = ids.length > 0 ? unexpectedDuplicateCount / ids.length : 0;
  return { observedDuplicateCount, unexpectedDuplicateCount, duplicateRate };
}

export function getHttpMockProfile(pathname: string, method: RequestMethod): HttpMockProfile {
  if (pathname.includes("/api/form") && method === "POST") {
    return { baselineMs: 95, jitterFactor: 0.85, errorRate: 0.01 };
  }
  if (pathname.includes("/api/messages/threads/") && pathname.includes("/messages") && method === "GET") {
    return { baselineMs: 78, jitterFactor: 0.5, errorRate: 0.006 };
  }
  if (pathname.includes("/api/messages") && method === "POST") {
    return { baselineMs: 70, jitterFactor: 0.75, errorRate: 0.012 };
  }
  if (pathname.includes("/api/bookings") && method === "GET") {
    return { baselineMs: 62, jitterFactor: 0.55, errorRate: 0.005 };
  }
  if (pathname.includes("/api/auth/session") && method === "GET") {
    return { baselineMs: 60, jitterFactor: 0.8, errorRate: 0.005 };
  }
  return { baselineMs: 75, jitterFactor: 0.8, errorRate: 0.005 };
}

export function classifyStormOutcome(failRoll: number, maxAttempts = 4): StormOutcome {
  if (failRoll < 0.015) {
    // Permanent failure should not amplify retries.
    return {
      classification: "non_retryable_permanent",
      retryAttempts: 0,
      deadLetter: true,
    };
  }
  if (failRoll < 0.19) {
    // Retryable transient failure with bounded backoff.
    const retryAttempts = failRoll < 0.06 ? Math.min(2, maxAttempts - 1) : 1;
    return {
      classification: "retryable_transient",
      retryAttempts,
      deadLetter: false,
    };
  }
  return {
    classification: "success",
    retryAttempts: 0,
    deadLetter: false,
  };
}

