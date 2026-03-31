import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { GATE_THRESHOLDS, type GateName, type GateThreshold } from "./thresholds";
import { isAcceptedMessageSuccess } from "./result-classifier";
import {
  classifyStormOutcome,
  computeDuplicateMetrics,
  getHttpMockProfile,
} from "./gate-utils";

type Mode = "mock" | "live";
type Suite = "smoke" | "bookings" | "messages" | "reads" | "queues" | "full" | "live-ramp";
type RampStage = "low" | "medium" | "high";

interface RequestResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  accepted?: boolean;
  queued?: boolean;
  resourceId?: string;
  idempotencyKey?: string;
  retryCount?: number;
  deadLetter?: boolean;
  error?: string;
  timedOut?: boolean;
  auxiliary?: boolean;
}

interface ScenarioResult {
  gate: GateName;
  mode: Mode;
  operationCount: number;
  concurrency: number;
  durationMs: number;
  throughputRps: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  observedDuplicateCount: number;
  duplicateCount: number;
  duplicateRate: number;
  retryCount: number;
  deadLetterCount: number;
  timeoutCount: number;
  timeoutRate: number;
  statusCounts: Record<string, number>;
  failureCategory:
    | "none"
    | "config failure"
    | "auth/session collapse"
    | "DB/read bottleneck"
    | "messaging/provider bottleneck"
    | "worker/queue saturation";
  stage?: RampStage;
  latencies: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
  };
  pass: boolean;
  failures: string[];
  notes: string[];
}

interface RunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  mode: Mode;
  suite: Suite;
  baseUrl: string;
  thresholds: Record<GateName, GateThreshold>;
  results: ScenarioResult[];
  topBottlenecks: Array<{ gate: GateName; reason: string; severity: number }>;
  failingGates: GateName[];
  recommendations: string[];
  degradationTable?: Array<{
    gate: GateName;
    firstDegradationPoint: RampStage | "none";
    failureCategory:
      | "none"
      | "config failure"
      | "auth/session collapse"
      | "DB/read bottleneck"
      | "messaging/provider bottleneck"
      | "worker/queue saturation";
    details: string;
  }>;
  stageResults?: ScenarioResult[];
}

interface RunnerOptions {
  suite: Suite;
  mode: Mode;
  baseUrl: string;
  outputRoot: string;
  bookingsEndpoint: string;
  bookingListEndpoint: string;
  threadsEndpoint: string;
  threadMessagesPathTemplate: string;
  authSessionEndpoint: string;
  threadId: string;
  queueMode: "auto" | "direct-bullmq-connected" | "live-api-backed";
  e2eAuthKey: string;
  ownerCookie?: string;
  sitterCookie?: string;
  clientCookie?: string;
  requestTimeoutMs: number;
  cooldownMs: number;
  rampProfile: RampStage[];
  messageRecipientPool: string[];
}

const DEFAULTS = {
  baseUrl: process.env.LOAD_TEST_BASE_URL || "http://localhost:3000",
  outputRoot: process.env.LOAD_TEST_OUTPUT_DIR || "artifacts/load-tests",
  mode: (process.env.LOAD_TEST_MODE || "mock") as Mode,
  suite: "smoke" as Suite,
  bookingsEndpoint: process.env.LOAD_TEST_BOOKINGS_CREATE_ENDPOINT || "/api/form",
  bookingListEndpoint: process.env.LOAD_TEST_BOOKINGS_LIST_ENDPOINT || "/api/bookings",
  threadsEndpoint: process.env.LOAD_TEST_THREADS_ENDPOINT || "/api/messages/threads",
  threadMessagesPathTemplate:
    process.env.LOAD_TEST_THREAD_MESSAGES_ENDPOINT || "/api/messages/threads/{id}/messages",
  authSessionEndpoint: process.env.LOAD_TEST_AUTH_SESSION_ENDPOINT || "/api/auth/session",
  threadId: process.env.LOAD_TEST_THREAD_ID || "load-test-thread",
  queueMode: (process.env.LOAD_TEST_QUEUE_MODE as RunnerOptions["queueMode"]) || "auto",
  e2eAuthKey: process.env.E2E_AUTH_KEY || "test-e2e-key-change-in-production",
  requestTimeoutMs: Number(process.env.LOAD_TEST_REQUEST_TIMEOUT_MS || "20000"),
  cooldownMs: Number(process.env.LOAD_TEST_COOLDOWN_MS || "3000"),
  rampProfile: (process.env.LOAD_TEST_RAMP_PROFILE || "low,medium,high")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is RampStage => s === "low" || s === "medium" || s === "high"),
  messageRecipientPool: (() => {
    const raw = process.env.LOAD_TEST_MESSAGE_RECIPIENTS || process.env.LOAD_TEST_MESSAGE_RECIPIENT || "";
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length) return parsed;
    // Twilio-compatible E.164 defaults used only by load harness bootstrap.
    return ["+15005550006", "+14155552671"];
  })(),
};

const nowIso = () => new Date().toISOString();

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = args.findIndex((a) => a === name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const suite = (arg("--suite") || DEFAULTS.suite) as Suite;
  const mode = (arg("--mode") || DEFAULTS.mode) as Mode;
  const rampArg = (arg("--ramp-profile") || "").trim();
  const rampProfile = (rampArg
    ? rampArg.split(",").map((s) => s.trim().toLowerCase())
    : DEFAULTS.rampProfile
  ).filter((s): s is RampStage => s === "low" || s === "medium" || s === "high");
  return {
    suite,
    mode,
    baseUrl: arg("--base-url") || DEFAULTS.baseUrl,
    outputRoot: arg("--output-dir") || DEFAULTS.outputRoot,
    bookingsEndpoint: DEFAULTS.bookingsEndpoint,
    bookingListEndpoint: DEFAULTS.bookingListEndpoint,
    threadsEndpoint: DEFAULTS.threadsEndpoint,
    threadMessagesPathTemplate: DEFAULTS.threadMessagesPathTemplate,
    authSessionEndpoint: DEFAULTS.authSessionEndpoint,
    threadId: DEFAULTS.threadId,
    queueMode: (arg("--queue-mode") as RunnerOptions["queueMode"]) || DEFAULTS.queueMode,
    e2eAuthKey: process.env.E2E_AUTH_KEY || DEFAULTS.e2eAuthKey,
    ownerCookie: process.env.LOAD_TEST_OWNER_COOKIE,
    sitterCookie: process.env.LOAD_TEST_SITTER_COOKIE,
    clientCookie: process.env.LOAD_TEST_CLIENT_COOKIE,
    requestTimeoutMs: Number(arg("--request-timeout-ms") || DEFAULTS.requestTimeoutMs),
    cooldownMs: Number(arg("--cooldown-ms") || DEFAULTS.cooldownMs),
    rampProfile: rampProfile.length ? rampProfile : ["low", "medium", "high"],
    messageRecipientPool: DEFAULTS.messageRecipientPool,
  };
}

function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function seedHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicUnit(seed: string): number {
  const x = seedHash(seed);
  const y = Math.sin(x) * 10000;
  return y - Math.floor(y);
}

function shouldUseApiBackedQueueMode(options: RunnerOptions): boolean {
  if (options.mode !== "live") return false;
  if (options.queueMode === "live-api-backed") return true;
  if (options.queueMode === "direct-bullmq-connected") return false;
  return !process.env.REDIS_URL;
}

function parseCookieFromSetCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  // Preserve full cookie token even when Expires contains commas.
  const token = setCookie.split(";")[0]?.trim();
  return token || null;
}

async function apiFetch(
  options: RunnerOptions,
  pathname: string,
  init: { method?: "GET" | "POST"; cookie?: string; body?: unknown; extraHeaders?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; latencyMs: number; json: any; setCookie: string | null }> {
  const start = performance.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.extraHeaders || {}),
  };
  if (init.cookie) headers.Cookie = init.cookie;
  const res = await fetch(new URL(pathname, options.baseUrl), {
    method: init.method || "GET",
    headers,
    body: init.method === "POST" ? JSON.stringify(init.body ?? {}) : undefined,
  });
  const latencyMs = performance.now() - start;
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, latencyMs, json, setCookie: res.headers.get("set-cookie") };
}

async function ensureLiveSessions(options: RunnerOptions): Promise<void> {
  if (options.mode !== "live") return;
  const roles: Array<"owner" | "sitter" | "client"> = ["owner", "sitter", "client"];
  for (const role of roles) {
    const current = role === "owner" ? options.ownerCookie : role === "sitter" ? options.sitterCookie : options.clientCookie;
    if (current) continue;
    const login = await apiFetch(options, "/api/ops/e2e-login", {
      method: "POST",
      extraHeaders: { "x-e2e-key": options.e2eAuthKey },
      body: { role },
    });
    if (!login.ok) {
      throw new Error(`Failed e2e-login for ${role}: ${login.status} ${(login.json?.error as string) || ""}`.trim());
    }
    const cookie = parseCookieFromSetCookie(login.setCookie);
    if (!cookie) throw new Error(`Missing set-cookie for role ${role}`);
    if (role === "owner") options.ownerCookie = cookie;
    if (role === "sitter") options.sitterCookie = cookie;
    if (role === "client") options.clientCookie = cookie;
  }
}

async function ensureThreadForMessaging(options: RunnerOptions): Promise<void> {
  if (options.mode !== "live") return;
  if (process.env.LOAD_TEST_THREAD_ID) {
    options.threadId = process.env.LOAD_TEST_THREAD_ID;
    return;
  }

  // Reuse an existing thread first to avoid creating noise fixtures.
  const listRes = await apiFetch(options, `${options.threadsEndpoint}?pageSize=1`, {
    method: "GET",
    cookie: options.ownerCookie,
  });
  const first = Array.isArray(listRes.json?.items) ? listRes.json.items[0] : null;
  if (first?.id) {
    options.threadId = String(first.id);
    return;
  }

  const recipients = options.messageRecipientPool.filter(isE164);
  if (!recipients.length) {
    throw new Error(
      "No valid E.164 recipients configured for messaging load bootstrap. Set LOAD_TEST_MESSAGE_RECIPIENTS."
    );
  }

  for (const recipient of recipients) {
    const createRes = await apiFetch(options, options.threadsEndpoint, {
      method: "POST",
      cookie: options.ownerCookie,
      body: {
        phoneNumber: recipient,
        initialMessage: `loadtest bootstrap ${new Date().toISOString()}`,
      },
    });
    if (createRes.ok && createRes.json?.threadId) {
      options.threadId = String(createRes.json.threadId);
      return;
    }
  }

  throw new Error(
    `Unable to discover or create a thread for live messaging scenarios using recipient pool: ${recipients.join(", ")}`
  );
}

async function verifyCrossOrgAndRoleBoundary(options: RunnerOptions): Promise<void> {
  if (options.mode !== "live") return;
  const checks = await Promise.all([
    apiFetch(options, "/api/ops/metrics", { method: "GET", cookie: options.clientCookie }),
    apiFetch(options, "/api/ops/metrics", { method: "GET", cookie: options.sitterCookie }),
  ]);
  const invalid = checks.find((c) => c.status !== 403 && c.status !== 401);
  if (invalid) {
    throw new Error(`Cross-role boundary check failed: expected 401/403, got ${invalid.status}`);
  }
}

function evaluateThreshold(result: ScenarioResult, threshold: GateThreshold): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (result.latencies.p50 > threshold.p50Ms) failures.push(`p50 ${result.latencies.p50.toFixed(1)}ms > ${threshold.p50Ms}ms`);
  if (result.latencies.p95 > threshold.p95Ms) failures.push(`p95 ${result.latencies.p95.toFixed(1)}ms > ${threshold.p95Ms}ms`);
  if (result.latencies.p99 > threshold.p99Ms) failures.push(`p99 ${result.latencies.p99.toFixed(1)}ms > ${threshold.p99Ms}ms`);
  if (result.errorRate > threshold.maxErrorRate) {
    failures.push(`errorRate ${(result.errorRate * 100).toFixed(2)}% > ${(threshold.maxErrorRate * 100).toFixed(2)}%`);
  }
  if (typeof threshold.maxDuplicateRate === "number" && result.duplicateRate > threshold.maxDuplicateRate) {
    failures.push(
      `duplicateRate ${(result.duplicateRate * 100).toFixed(2)}% > ${(threshold.maxDuplicateRate * 100).toFixed(2)}%`
    );
  }
  if (typeof threshold.minThroughputRps === "number" && result.throughputRps < threshold.minThroughputRps) {
    failures.push(`throughput ${result.throughputRps.toFixed(2)} rps < ${threshold.minThroughputRps} rps`);
  }
  if (typeof threshold.minQueueDrainPerSec === "number" && result.throughputRps < threshold.minQueueDrainPerSec) {
    failures.push(`queue drain ${result.throughputRps.toFixed(2)} jobs/s < ${threshold.minQueueDrainPerSec} jobs/s`);
  }
  if (typeof threshold.maxDeadLetterCount === "number" && result.deadLetterCount > threshold.maxDeadLetterCount) {
    failures.push(`dead letters ${result.deadLetterCount} > ${threshold.maxDeadLetterCount}`);
  }
  if (typeof threshold.maxRetryCount === "number" && result.retryCount > threshold.maxRetryCount) {
    failures.push(`retry count ${result.retryCount} > ${threshold.maxRetryCount}`);
  }
  return { pass: failures.length === 0, failures };
}

const mockIdempotencyStore = new Map<string, string>();

async function mockRequest(pathname: string, opIndex: number, method: "GET" | "POST", idempotencyKey?: string): Promise<RequestResult> {
  const profile = getHttpMockProfile(pathname, method);
  const jitter = deterministicUnit(`${pathname}:${method}:${opIndex}:jitter`) * profile.baselineMs * profile.jitterFactor;
  const tailChance = deterministicUnit(`${pathname}:${method}:${opIndex}:tail`);
  const tailPenalty = tailChance > 0.985 ? 250 + deterministicUnit(`${pathname}:${opIndex}:tail2`) * 350 : 0;
  const latencyMs = profile.baselineMs + jitter + tailPenalty;
  await new Promise((resolve) => setTimeout(resolve, latencyMs));

  const errBase = profile.errorRate;
  const failRoll = deterministicUnit(`${pathname}:${method}:${opIndex}:err`);
  if (failRoll < errBase) {
    return { ok: false, status: 500, latencyMs, error: "mock_transient_error", idempotencyKey };
  }

  if (pathname.includes("/api/form") && idempotencyKey) {
    if (!mockIdempotencyStore.has(idempotencyKey)) {
      mockIdempotencyStore.set(idempotencyKey, `bk_mock_${seedHash(idempotencyKey).toString(16)}`);
    }
    return { ok: true, status: 200, latencyMs, resourceId: mockIdempotencyStore.get(idempotencyKey)!, idempotencyKey };
  }

  if (pathname.includes("/messages") && method === "POST") {
    return {
      ok: true,
      status: 202,
      latencyMs,
      accepted: true,
      queued: true,
      resourceId: `msg_${seedHash(`${pathname}:${opIndex}`)}`,
      idempotencyKey,
    };
  }

  return { ok: true, status: 200, latencyMs, idempotencyKey };
}

async function liveRequest(
  options: RunnerOptions,
  pathname: string,
  opIndex: number,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  idempotencyKey?: string,
  cookie?: string
): Promise<RequestResult> {
  const target = new URL(pathname, options.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (cookie) headers.Cookie = cookie;
  if (process.env.LOAD_TEST_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.LOAD_TEST_AUTH_TOKEN}`;

  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);
  try {
    const res = await fetch(target, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = performance.now() - start;
    const payload = await res.json().catch(() => ({}));
    const resourceId =
      (payload as any)?.booking?.id ||
      (payload as any)?.messageId ||
      (payload as any)?.threadId ||
      (payload as any)?.id;
    const accepted = Boolean((payload as any)?.accepted);
    const queued = Boolean((payload as any)?.queued);
    const ok = isAcceptedMessageSuccess(pathname, method, res.status, res.ok, { accepted, queued });
    return {
      ok,
      status: res.status,
      latencyMs,
      accepted,
      queued,
      resourceId: typeof resourceId === "string" ? resourceId : undefined,
      idempotencyKey,
      error: ok ? undefined : String((payload as any)?.error || `http_${res.status}`),
    };
  } catch (error) {
    clearTimeout(timeout);
    const latencyMs = performance.now() - start;
    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
    return {
      ok: false,
      status: 0,
      latencyMs,
      idempotencyKey,
      error: isTimeout ? `timeout_after_${options.requestTimeoutMs}ms` : error instanceof Error ? error.message : "unknown_fetch_error",
      timedOut: isTimeout,
    };
  }
}

async function sendRequest(
  options: RunnerOptions,
  pathname: string,
  opIndex: number,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  idempotencyKey?: string,
  cookie?: string
): Promise<RequestResult> {
  if (options.mode === "mock") {
    return mockRequest(pathname, opIndex, method, idempotencyKey);
  }
  return liveRequest(options, pathname, opIndex, method, body, idempotencyKey, cookie);
}

async function runConcurrent(total: number, concurrency: number, task: (index: number) => Promise<RequestResult>) {
  const results: RequestResult[] = new Array(total);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(total, concurrency) }, async () => {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= total) return;
      results[i] = await task(i);
    }
  });
  await Promise.all(workers);
  return results;
}

function classifyFailureCategory(gate: GateName, responses: RequestResult[], pass: boolean): ScenarioResult["failureCategory"] {
  if (pass) return "none";
  const status403 = responses.filter((r) => r.status === 403).length;
  const status401 = responses.filter((r) => r.status === 401).length;
  const authRatio = responses.length > 0 ? (status401 + status403) / responses.length : 0;
  if (gate === "bookings_create_1000" && status403 > 0) return "config failure";
  if (gate === "session_validation_burst" && authRatio > 0.4) return "auth/session collapse";
  if (gate === "session_validation_burst") return "auth/session collapse";
  if (gate === "messages_send_2000") return "messaging/provider bottleneck";
  if (gate === "bookings_reads_paginated" || gate === "thread_reads") return "DB/read bottleneck";
  if (gate === "queue_backlog_drain" || gate === "queue_retry_failure_storm") return "worker/queue saturation";
  return "DB/read bottleneck";
}

function buildMetrics(
  gate: GateName,
  mode: Mode,
  operationCount: number,
  concurrency: number,
  durationMs: number,
  responses: RequestResult[],
  notes: string[] = [],
  options: { allowIdempotentReplayDuplicates?: boolean } = {}
): ScenarioResult {
  const primaryResponses = responses.filter((r) => !r.auxiliary);
  const latencies = primaryResponses.map((r) => r.latencyMs);
  const successCount = primaryResponses.filter((r) => r.ok).length;
  const explicitErrors = primaryResponses.filter((r) => !r.ok).length;
  const missingResponses = Math.max(0, operationCount - primaryResponses.length);
  const errorCount = explicitErrors + missingResponses;
  const errorRate = operationCount > 0 ? errorCount / operationCount : 0;
  const duplicateMetrics = computeDuplicateMetrics(primaryResponses, {
    allowIdempotentReplayDuplicates: options.allowIdempotentReplayDuplicates,
  });
  const retryCount = responses.reduce((sum, r) => sum + (r.retryCount ?? 0), 0);
  const deadLetterCount = responses.reduce((sum, r) => sum + (r.deadLetter ? 1 : 0), 0);
  const timeoutCount = primaryResponses.filter((r) => r.timedOut).length;
  const statusCounts = primaryResponses.reduce<Record<string, number>>((acc, r) => {
    const key = String(r.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const threshold = GATE_THRESHOLDS[gate];
  const base: ScenarioResult = {
    gate,
    mode,
    operationCount,
    concurrency,
    durationMs,
    throughputRps: operationCount / Math.max(durationMs / 1000, 0.001),
    successCount,
    errorCount,
    errorRate,
    observedDuplicateCount: duplicateMetrics.observedDuplicateCount,
    duplicateCount: duplicateMetrics.unexpectedDuplicateCount,
    duplicateRate: duplicateMetrics.duplicateRate,
    retryCount,
    deadLetterCount,
    timeoutCount,
    timeoutRate: operationCount > 0 ? timeoutCount / operationCount : 0,
    statusCounts,
    failureCategory: "none",
    latencies: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Math.max(...latencies) : 0,
      min: latencies.length ? Math.min(...latencies) : 0,
    },
    pass: true,
    failures: [],
    notes,
  };
  const evalResult = evaluateThreshold(base, threshold);
  base.pass = evalResult.pass;
  base.failures = evalResult.failures;
  base.failureCategory = classifyFailureCategory(gate, primaryResponses, base.pass);
  return base;
}

function bookingPayload(index: number) {
  const day = (index % 20) + 1;
  const date = `2026-04-${String(day).padStart(2, "0")}`;
  return {
    firstName: `Load${index}`,
    lastName: "Test",
    phone: `+1415555${String(1000 + (index % 9000)).padStart(4, "0")}`,
    email: `load+${index}@example.com`,
    service: "Dog Walking",
    startAt: `${date}T09:00:00.000Z`,
    endAt: `${date}T09:30:00.000Z`,
    address: "123 Load Test Ave",
  };
}

interface GateTuning {
  operationCount?: number;
  concurrency?: number;
  stage?: RampStage;
  tag?: string;
  notes?: string[];
}

function applyTuning(defaultOps: number, defaultConcurrency: number, tuning?: GateTuning) {
  return {
    operationCount: tuning?.operationCount ?? defaultOps,
    concurrency: tuning?.concurrency ?? defaultConcurrency,
  };
}

async function checkBookingsConfig(options: RunnerOptions): Promise<{ blocked: boolean; reason?: string }> {
  if (options.mode !== "live") return { blocked: false };
  const probe = await sendRequest(
    options,
    options.bookingsEndpoint,
    0,
    "POST",
    {
      ...bookingPayload(0),
      email: `load-probe-${Date.now()}@example.com`,
    },
    `load-config-probe-${Date.now()}`,
    options.ownerCookie
  );
  if (probe.status === 403 && probe.error?.toLowerCase().includes("public booking is disabled")) {
    return { blocked: true, reason: probe.error };
  }
  return { blocked: false };
}

async function scenarioBookingsCreate(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const tuned = applyTuning(smoke ? 200 : 1000, smoke ? 200 : 1000, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const uniqueKeyCount = Math.floor(operationCount * 0.9);
  const keys = Array.from({ length: uniqueKeyCount }, (_, i) => `load-bk-${i}`);
  const start = performance.now();
  const responses = await runConcurrent(operationCount, concurrency, async (i) => {
    const idempotencyKey = keys[i % uniqueKeyCount];
    const tag = tuning?.tag ? `${tuning.tag}-` : "";
    return sendRequest(
      options,
      options.bookingsEndpoint,
      i,
      "POST",
      {
        ...bookingPayload(i % uniqueKeyCount),
        email: `${tag}load+${i}@example.com`,
      },
      idempotencyKey
    );
  });
  const durationMs = performance.now() - start;
  const result = buildMetrics(
    "bookings_create_1000",
    options.mode,
    operationCount,
    concurrency,
    durationMs,
    responses,
    [
      "10% replay traffic with repeated idempotency keys",
      "Duplicate metric ignores expected same-key replay collisions",
      ...(tuning?.notes || []),
    ],
    { allowIdempotentReplayDuplicates: true }
  );
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

async function scenarioMessagesSend(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const tuned = applyTuning(smoke ? 350 : 2000, smoke ? 350 : 2000, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const path = options.threadMessagesPathTemplate.replace("{id}", options.threadId);
  const start = performance.now();
  const responses = await runConcurrent(operationCount, concurrency, async (i) =>
    sendRequest(
      options,
      path,
      i,
      "POST",
      { body: `${tuning?.tag || "load"} message ${i}` },
      undefined,
      options.ownerCookie
    )
  );
  const durationMs = performance.now() - start;
  const result = buildMetrics(
    "messages_send_2000",
    options.mode,
    operationCount,
    concurrency,
    durationMs,
    responses,
    tuning?.notes || []
  );
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

async function scenarioBookingReads(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const tuned = applyTuning(smoke ? 400 : 1800, smoke ? 120 : 600, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const start = performance.now();
  const responses = await runConcurrent(operationCount, concurrency, async (i) => {
    const page = (i % 20) + 1;
    const url = `${options.bookingListEndpoint}?page=${page}&pageSize=50&sort=startAt&sortDir=asc&status=pending,confirmed`;
    return sendRequest(options, url, i, "GET", undefined, undefined, options.ownerCookie);
  });
  const durationMs = performance.now() - start;
  const result = buildMetrics(
    "bookings_reads_paginated",
    options.mode,
    operationCount,
    concurrency,
    durationMs,
    responses,
    tuning?.notes || []
  );
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

async function scenarioThreadReads(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const tuned = applyTuning(smoke ? 350 : 1500, smoke ? 120 : 500, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const start = performance.now();
  const responses = await runConcurrent(operationCount, concurrency, async (i) => {
    const page = (i % 10) + 1;
    const path = options.threadMessagesPathTemplate.replace("{id}", options.threadId);
    const url = `${path}?page=${page}&pageSize=50`;
    return sendRequest(options, url, i, "GET", undefined, undefined, options.ownerCookie);
  });
  const durationMs = performance.now() - start;
  const result = buildMetrics("thread_reads", options.mode, operationCount, concurrency, durationMs, responses, tuning?.notes || []);
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

async function scenarioSessionBurst(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const tuned = applyTuning(smoke ? 300 : 1200, smoke ? 300 : 1200, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const cookies = [
    options.ownerCookie || "",
    options.sitterCookie || "",
    options.clientCookie || "",
  ];
  const start = performance.now();
  const responses = await runConcurrent(operationCount, concurrency, async (i) =>
    sendRequest(options, options.authSessionEndpoint, i, "GET", undefined, undefined, cookies[i % cookies.length] || undefined)
  );
  const durationMs = performance.now() - start;
  const result = buildMetrics(
    "session_validation_burst",
    options.mode,
    operationCount,
    concurrency,
    durationMs,
    responses,
    ["Requests are spread across owner/sitter/client session cookies when provided", ...(tuning?.notes || [])]
  );
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

async function queueBacklogMock(jobCount: number, workerConcurrency: number): Promise<RequestResult[]> {
  const results: RequestResult[] = new Array(jobCount);
  let cursor = 0;
  const workers = Array.from({ length: workerConcurrency }, async () => {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= jobCount) return;
      const latencyMs = 3 + deterministicUnit(`queue:backlog:${i}`) * 12;
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
      results[i] = { ok: true, status: 200, latencyMs };
    }
  });
  await Promise.all(workers);
  return results;
}

async function queueFailureStormMock(jobCount: number, workerConcurrency: number): Promise<RequestResult[]> {
  const results: RequestResult[] = new Array(jobCount);
  let cursor = 0;
  const workers = Array.from({ length: workerConcurrency }, async () => {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= jobCount) return;
      const failRoll = deterministicUnit(`queue:storm:fail:${i}`);
      const outcome = classifyStormOutcome(failRoll, 4);
      let totalLatency = 0;
      for (let attempt = 0; attempt <= outcome.retryAttempts; attempt += 1) {
        const attemptLatency = 4 + deterministicUnit(`queue:storm:${i}:${attempt}`) * 14;
        totalLatency += attemptLatency;
        await new Promise((resolve) => setTimeout(resolve, attemptLatency));
      }
      if (outcome.deadLetter) {
        results[i] = {
          ok: false,
          status: 500,
          latencyMs: totalLatency,
          retryCount: outcome.retryAttempts,
          deadLetter: true,
          error: outcome.classification,
        };
      } else {
        results[i] = {
          ok: true,
          status: 200,
          latencyMs: totalLatency,
          retryCount: outcome.retryAttempts,
        };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function resolveAnySitterId(options: RunnerOptions): Promise<string> {
  const list = await apiFetch(options, "/api/sitters?page=1&pageSize=5", {
    method: "GET",
    cookie: options.ownerCookie,
  });
  if (!list.ok || !Array.isArray(list.json?.items) || list.json.items.length === 0) {
    throw new Error(`Unable to resolve sitterId for queue scenarios (${list.status})`);
  }
  const sitterId = list.json.items[0]?.id;
  if (!sitterId) throw new Error("No sitter id available in /api/sitters response");
  return String(sitterId);
}

async function pollReconcileRunCompletion(
  options: RunnerOptions,
  sinceIso: string,
  expectedMin: number
): Promise<{ completed: number; runs: Array<{ status: string; createdAt: string }> }> {
  const timeoutMs = 120_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const runsRes = await apiFetch(options, "/api/ops/finance/reconcile/runs?limit=100", {
      method: "GET",
      cookie: options.ownerCookie,
    });
    const runs = (Array.isArray(runsRes.json?.runs) ? runsRes.json.runs : []).filter(
      (r: any) => new Date(String(r.createdAt)).getTime() >= new Date(sinceIso).getTime()
    );
    const completed = runs.filter((r: any) => {
      const s = String(r.status || "").toLowerCase();
      return s && s !== "queued" && s !== "pending" && s !== "processing" && s !== "running";
    }).length;
    if (completed >= expectedMin) {
      return { completed, runs: runs.map((r: any) => ({ status: String(r.status), createdAt: String(r.createdAt) })) };
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const runsRes = await apiFetch(options, "/api/ops/finance/reconcile/runs?limit=100", {
    method: "GET",
    cookie: options.ownerCookie,
  });
  const runs = (Array.isArray(runsRes.json?.runs) ? runsRes.json.runs : []).filter(
    (r: any) => new Date(String(r.createdAt)).getTime() >= new Date(sinceIso).getTime()
  );
  const completed = runs.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s && s !== "queued" && s !== "pending" && s !== "processing" && s !== "running";
  }).length;
  return { completed, runs: runs.map((r: any) => ({ status: String(r.status), createdAt: String(r.createdAt) })) };
}

async function queueBacklogLiveApiBacked(jobCount: number, options: RunnerOptions): Promise<RequestResult[]> {
  const responses: RequestResult[] = [];
  const sinceIso = new Date().toISOString();
  for (let i = 0; i < jobCount; i += 1) {
    const start = new Date(Date.now() - (i % 2 === 0 ? 3 : 7) * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const res = await apiFetch(options, "/api/ops/finance/reconcile", {
      method: "POST",
      cookie: options.ownerCookie,
      body: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
    responses.push({
      ok: res.ok,
      status: res.status,
      latencyMs: res.latencyMs,
      resourceId: typeof res.json?.jobId === "string" ? String(res.json.jobId) : undefined,
      error: res.ok ? undefined : String(res.json?.error || `http_${res.status}`),
    });
  }
  const successful = responses.filter((r) => r.ok).length;
  const completion = await pollReconcileRunCompletion(options, sinceIso, Math.max(1, Math.floor(successful * 0.9)));
  const completed = completion.completed;
  const shortfall = Math.max(0, successful - completed);
  if (shortfall > 0) {
    responses.push({
      ok: false,
      status: 500,
      latencyMs: 0,
      retryCount: shortfall,
      deadLetter: false,
      error: "reconcile_runs_not_drained_within_timeout",
      auxiliary: true,
    });
  }
  return responses;
}

async function queueFailureStormLiveApiBacked(jobCount: number, options: RunnerOptions): Promise<RequestResult[]> {
  const baselineFail = await apiFetch(options, "/api/ops/automation-failures?tab=fail&limit=100", {
    method: "GET",
    cookie: options.ownerCookie,
  });
  const baselineDead = await apiFetch(options, "/api/ops/automation-failures?tab=dead&limit=100", {
    method: "GET",
    cookie: options.ownerCookie,
  });
  const failBefore = Number(baselineFail.json?.count || 0);
  const deadBefore = Number(baselineDead.json?.count || 0);

  const seedRunId = `loadstorm-${Date.now()}`;
  const seedA = await apiFetch(options, "/api/ops/command-center/seed-fixtures", {
    method: "POST",
    cookie: options.ownerCookie,
    extraHeaders: { "x-e2e-key": options.e2eAuthKey },
    body: { runId: `${seedRunId}-a` },
  });
  // Keep inside the documented seed rate limit (2/min).
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const seedB = await apiFetch(options, "/api/ops/command-center/seed-fixtures", {
    method: "POST",
    cookie: options.ownerCookie,
    extraHeaders: { "x-e2e-key": options.e2eAuthKey },
    body: { runId: `${seedRunId}-b` },
  });

  const retries: RequestResult[] = [];
  const failList = await apiFetch(options, "/api/ops/automation-failures?tab=fail&limit=100", {
    method: "GET",
    cookie: options.ownerCookie,
  });
  const candidates = (Array.isArray(failList.json?.items) ? failList.json.items : [])
    .filter((item: any) => {
      const runId = item?.metadata?.runId;
      return typeof runId === "string" && runId.startsWith(seedRunId);
    })
    .map((item: any) => String(item.id))
    .slice(0, jobCount);

  for (const eventLogId of candidates) {
    const retry = await apiFetch(options, `/api/ops/automation-failures/${eventLogId}/retry`, {
      method: "POST",
      cookie: options.ownerCookie,
    });
    retries.push({
      ok: retry.ok,
      status: retry.status,
      latencyMs: retry.latencyMs,
      retryCount: retry.ok ? 1 : 0,
      error: retry.ok ? undefined : String(retry.json?.error || `http_${retry.status}`),
    });
  }

  // Poll for queue-produced fail/dead deltas.
  let failAfter = failBefore;
  let deadAfter = deadBefore;
  const startPoll = Date.now();
  while (Date.now() - startPoll < 90_000) {
    const f = await apiFetch(options, "/api/ops/automation-failures?tab=fail&limit=100", {
      method: "GET",
      cookie: options.ownerCookie,
    });
    const d = await apiFetch(options, "/api/ops/automation-failures?tab=dead&limit=100", {
      method: "GET",
      cookie: options.ownerCookie,
    });
    failAfter = Number(f.json?.count || failAfter);
    deadAfter = Number(d.json?.count || deadAfter);
    if (failAfter >= failBefore && deadAfter >= deadBefore) {
      // one stabilized read is enough for this API-backed fallback.
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const failDelta = Math.max(0, failAfter - failBefore);
  const deadDelta = Math.max(0, deadAfter - deadBefore);
  retries.push({
    ok: true,
    status: 200,
    latencyMs: 1,
    retryCount: failDelta + deadDelta,
    deadLetter: deadDelta > 0,
    auxiliary: true,
  });
  retries.push({
    ok: seedA.ok && seedB.ok,
    status: seedA.ok && seedB.ok ? 200 : 500,
    latencyMs: seedA.latencyMs + seedB.latencyMs,
    error: seedA.ok && seedB.ok ? undefined : "seed_fixtures_failed_for_queue_storm",
    auxiliary: true,
  });

  return retries;
}

async function queueBacklogLive(jobCount: number, workerConcurrency: number): Promise<RequestResult[]> {
  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  const queueName = `loadtest-backlog-${Date.now()}`;
  const queue = new Queue(queueName, { connection: redis });
  const results: RequestResult[] = [];
  const startTimes = new Map<string, number>();
  let completed = 0;
  const worker = new Worker(
    queueName,
    async (job) => {
      const latency = 2 + deterministicUnit(`live-queue:${job.id}`) * 8;
      await new Promise((resolve) => setTimeout(resolve, latency));
      return { ok: true };
    },
    { connection: redis, concurrency: workerConcurrency }
  );
  worker.on("completed", (job) => {
    completed += 1;
    const start = startTimes.get(String(job.id)) ?? performance.now();
    results.push({ ok: true, status: 200, latencyMs: performance.now() - start });
  });
  await Promise.all(
    Array.from({ length: jobCount }, async (_, i) => {
      const id = `jb-${i}`;
      startTimes.set(id, performance.now());
      await queue.add("drain", { i }, { jobId: id, removeOnComplete: true, removeOnFail: true });
    })
  );
  while (completed < jobCount) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await worker.close();
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  await redis.quit();
  return results;
}

async function queueFailureStormLive(jobCount: number, workerConcurrency: number): Promise<RequestResult[]> {
  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  const queueName = `loadtest-storm-${Date.now()}`;
  const queue = new Queue(queueName, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 25 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
  const results: RequestResult[] = [];
  const startTimes = new Map<string, number>();
  let done = 0;
  const worker = new Worker(
    queueName,
    async (job) => {
      const roll = deterministicUnit(`live-storm:${job.id}`);
      const outcome = classifyStormOutcome(roll, 3);
      const attemptNo = job.attemptsMade + 1;
      if (outcome.classification === "non_retryable_permanent") {
        const error = new Error("simulated_permanent_failure");
        (error as Error & { cause?: string }).cause = "permanent";
        throw error;
      }
      if (outcome.classification === "retryable_transient" && attemptNo <= outcome.retryAttempts) {
        const error = new Error("simulated_retryable_failure");
        (error as Error & { cause?: string }).cause = "retryable";
        throw error;
      }
      return { ok: true };
    },
    { connection: redis, concurrency: workerConcurrency }
  );
  worker.on("completed", (job) => {
    done += 1;
    const start = startTimes.get(String(job.id)) ?? performance.now();
    results.push({
      ok: true,
      status: 200,
      latencyMs: performance.now() - start,
      retryCount: job.attemptsMade,
    });
  });
  worker.on("failed", (job) => {
    if (!job) return;
    if (job.attemptsMade >= 3) {
      done += 1;
      const start = startTimes.get(String(job.id)) ?? performance.now();
      results.push({
        ok: false,
        status: 500,
        latencyMs: performance.now() - start,
        retryCount: Math.max(0, job.attemptsMade - 1),
        deadLetter: true,
        error: "dead_lettered",
      });
    }
  });
  await Promise.all(
    Array.from({ length: jobCount }, async (_, i) => {
      const id = `storm-${i}`;
      startTimes.set(id, performance.now());
      await queue.add("storm", { i }, { jobId: id });
    })
  );
  while (done < jobCount) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await worker.close();
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  await redis.quit();
  return results;
}

async function scenarioQueueBacklogDrain(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const defaults = {
    operationCount: shouldUseApiBackedQueueMode(options) ? (smoke ? 10 : 40) : smoke ? 2000 : 10000,
    concurrency: smoke ? 40 : 120,
  };
  const tuned = applyTuning(defaults.operationCount, defaults.concurrency, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const start = performance.now();
  const responses = shouldUseApiBackedQueueMode(options)
    ? await queueBacklogLiveApiBacked(operationCount, options)
    : options.mode === "live"
      ? await queueBacklogLive(operationCount, concurrency)
      : await queueBacklogMock(operationCount, concurrency);
  const durationMs = performance.now() - start;
  const result = buildMetrics(
    "queue_backlog_drain",
    options.mode,
    operationCount,
    concurrency,
    durationMs,
    responses,
    [
      shouldUseApiBackedQueueMode(options) ? "queue gate mode: live-api-backed" : "queue gate mode: direct-bullmq-connected",
      ...(tuning?.notes || []),
    ]
  );
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

async function scenarioQueueRetryStorm(options: RunnerOptions, smoke = false, tuning?: GateTuning): Promise<ScenarioResult> {
  const defaults = {
    operationCount: shouldUseApiBackedQueueMode(options) ? (smoke ? 6 : 18) : smoke ? 1000 : 6000,
    concurrency: smoke ? 30 : 100,
  };
  const tuned = applyTuning(defaults.operationCount, defaults.concurrency, tuning);
  const operationCount = tuned.operationCount;
  const concurrency = tuned.concurrency;
  const start = performance.now();
  const responses = shouldUseApiBackedQueueMode(options)
    ? await queueFailureStormLiveApiBacked(operationCount, options)
    : options.mode === "live"
      ? await queueFailureStormLive(operationCount, concurrency)
      : await queueFailureStormMock(operationCount, concurrency);
  const durationMs = performance.now() - start;
  const result = buildMetrics(
    "queue_retry_failure_storm",
    options.mode,
    operationCount,
    concurrency,
    durationMs,
    responses,
    [
      shouldUseApiBackedQueueMode(options) ? "queue gate mode: live-api-backed" : "queue gate mode: direct-bullmq-connected",
      "Uses bounded retry profile with retryable transient vs non-retryable permanent classification",
      "Storm simulation avoids retry amplification loops",
      ...(tuning?.notes || []),
    ]
  );
  if (tuning?.stage) result.stage = tuning.stage;
  return result;
}

function summarizeBottlenecks(results: ScenarioResult[]) {
  const ranked = results
    .map((r) => {
      const severity = r.latencies.p95 + r.errorRate * 5000 + r.deadLetterCount * 2 + r.duplicateCount * 10;
      const reason = r.failures.length
        ? `failed gate: ${r.failures.join("; ")}`
        : `high p95 ${r.latencies.p95.toFixed(1)}ms, throughput ${r.throughputRps.toFixed(1)} rps`;
      return { gate: r.gate, reason, severity };
    })
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5);
  return ranked;
}

function buildRecommendations(results: ScenarioResult[]): string[] {
  const recs: string[] = [];
  const failing = results.filter((r) => !r.pass);
  if (failing.some((r) => r.gate === "bookings_create_1000")) {
    recs.push("Bookings create path: add/create composite indexes for dominant search filters and review idempotency table write contention.");
  }
  if (failing.some((r) => r.gate === "messages_send_2000")) {
    recs.push("Messaging send path: batch outbound provider writes and decouple sync delivery state updates from request path.");
  }
  if (failing.some((r) => r.gate === "bookings_reads_paginated" || r.gate === "thread_reads")) {
    recs.push("Read-heavy list endpoints: verify query plans for sort+filter indexes and enforce narrower includes to avoid row bloat.");
  }
  if (failing.some((r) => r.gate === "queue_backlog_drain" || r.gate === "queue_retry_failure_storm")) {
    recs.push("Queue throughput: raise worker concurrency by queue class, tune retry backoff, and isolate storm-prone jobs into separate queues.");
  }
  if (failing.some((r) => r.gate === "session_validation_burst")) {
    recs.push("Session validation burst: add short-lived cache for session decode/DB lookups and pre-warm auth dependencies.");
  }
  if (recs.length === 0) {
    recs.push("No gate failures in this pass. Next step: run same suite in live staging with production-like auth+data volume.");
  }
  return recs;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RAMP_STAGE_SCALE: Record<RampStage, { opScale: number; concScale: number }> = {
  low: { opScale: 0.35, concScale: 0.35 },
  medium: { opScale: 0.65, concScale: 0.65 },
  high: { opScale: 1, concScale: 1 },
};

function scaleForStage(baseOps: number, baseConcurrency: number, stage: RampStage): GateTuning {
  const cfg = RAMP_STAGE_SCALE[stage];
  return {
    operationCount: Math.max(1, Math.floor(baseOps * cfg.opScale)),
    concurrency: Math.max(1, Math.floor(baseConcurrency * cfg.concScale)),
    stage,
    notes: [`ramp stage: ${stage}`],
    tag: `ramp-${stage}-${Date.now()}`,
  };
}

function buildConfigBlockedResult(stage: RampStage, message: string): ScenarioResult {
  return {
    gate: "bookings_create_1000",
    mode: "live",
    operationCount: 0,
    concurrency: 0,
    durationMs: 0,
    throughputRps: 0,
    successCount: 0,
    errorCount: 0,
    errorRate: 0,
    observedDuplicateCount: 0,
    duplicateCount: 0,
    duplicateRate: 0,
    retryCount: 0,
    deadLetterCount: 0,
    timeoutCount: 0,
    timeoutRate: 0,
    statusCounts: {},
    failureCategory: "config failure",
    stage,
    latencies: { p50: 0, p95: 0, p99: 0, max: 0, min: 0 },
    pass: false,
    failures: [`CONFIG-BLOCKED: ${message}`],
    notes: ["bookings_create_1000 marked CONFIG-BLOCKED, not performance-failed"],
  };
}

function deriveDegradationTable(stageResults: ScenarioResult[]): RunSummary["degradationTable"] {
  const stageOrder: Record<RampStage, number> = { low: 1, medium: 2, high: 3 };
  const gates = Array.from(new Set(stageResults.map((r) => r.gate)));
  return gates.map((gate) => {
    const ordered = stageResults
      .filter((r) => r.gate === gate)
      .sort((a, b) => stageOrder[(a.stage || "low") as RampStage] - stageOrder[(b.stage || "low") as RampStage]);
    const degraded = ordered.find((r) => !r.pass || r.timeoutRate > 0.05);
    return {
      gate,
      firstDegradationPoint: degraded?.stage || "none",
      failureCategory: degraded?.failureCategory || "none",
      details: degraded?.failures?.join("; ") || "No degradation observed",
    };
  });
}

function summarizeRampBottlenecks(stageResults: ScenarioResult[]) {
  const highStage = stageResults.filter((r) => r.stage === "high" && r.failureCategory !== "config failure");
  return summarizeBottlenecks(highStage.length ? highStage : stageResults.filter((r) => r.failureCategory !== "config failure"));
}

async function runLiveRamp(options: RunnerOptions): Promise<{ results: ScenarioResult[]; stageResults: ScenarioResult[] }> {
  const stages = options.rampProfile;
  const stageResults: ScenarioResult[] = [];
  const configProbe = await checkBookingsConfig(options);

  for (const stage of stages) {
    const bookingsTuning = scaleForStage(200, 200, stage);
    const messagesTuning = scaleForStage(350, 350, stage);
    const bookingReadsTuning = scaleForStage(400, 120, stage);
    const threadReadsTuning = scaleForStage(350, 120, stage);
    const sessionTuning = scaleForStage(300, 300, stage);
    const queueBacklogTuning = scaleForStage(10, 40, stage);
    const queueStormTuning = scaleForStage(6, 30, stage);

    const gateRuns: Array<() => Promise<ScenarioResult>> = [
      () =>
        configProbe.blocked
          ? Promise.resolve(buildConfigBlockedResult(stage, configProbe.reason || "staging /api/form gate blocked"))
          : scenarioBookingsCreate(options, true, bookingsTuning),
      () => scenarioMessagesSend(options, true, messagesTuning),
      () => scenarioBookingReads(options, true, bookingReadsTuning),
      () => scenarioThreadReads(options, true, threadReadsTuning),
      () => scenarioQueueBacklogDrain(options, true, queueBacklogTuning),
      () => scenarioQueueRetryStorm(options, true, queueStormTuning),
      () => scenarioSessionBurst(options, true, sessionTuning),
    ];

    for (const gateRun of gateRuns) {
      const result = await gateRun();
      stageResults.push(result);
      console.log(
        `[load][${stage}] ${result.gate} => ${result.pass ? "PASS" : "FAIL"} | p95=${result.latencies.p95.toFixed(
          1
        )}ms | err=${(result.errorRate * 100).toFixed(2)}% | timeout=${(result.timeoutRate * 100).toFixed(2)}% | throughput=${result.throughputRps.toFixed(2)}`
      );
      await sleep(options.cooldownMs);
    }
  }

  const finalByGate = new Map<GateName, ScenarioResult>();
  for (const gate of ["bookings_create_1000", "messages_send_2000", "bookings_reads_paginated", "thread_reads", "queue_backlog_drain", "queue_retry_failure_storm", "session_validation_burst"] as GateName[]) {
    const high = stageResults.find((r) => r.gate === gate && r.stage === "high");
    const medium = stageResults.find((r) => r.gate === gate && r.stage === "medium");
    const low = stageResults.find((r) => r.gate === gate && r.stage === "low");
    const selected = high || medium || low;
    if (selected) finalByGate.set(gate, selected);
  }
  return { results: Array.from(finalByGate.values()), stageResults };
}

function formatReport(summary: RunSummary): string {
  const lines: string[] = [];
  lines.push("# Load-Test Gates Benchmark Report");
  lines.push("");
  lines.push(`- Run ID: \`${summary.runId}\``);
  lines.push(`- Mode: \`${summary.mode}\``);
  lines.push(`- Suite: \`${summary.suite}\``);
  lines.push(`- Base URL: \`${summary.baseUrl}\``);
  lines.push(`- Started: \`${summary.startedAt}\``);
  lines.push(`- Completed: \`${summary.completedAt}\``);
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push("| Gate | Pass | Stage | Ops | Concurrency | Throughput rps | p50 | p95 | p99 | Error % | Timeout % | Duplicates | Retries | Dead letters | Category |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const r of summary.results) {
    lines.push(
      `| ${r.gate} | ${r.pass ? "PASS" : "FAIL"} | ${r.stage || "-"} | ${r.operationCount} | ${r.concurrency} | ${r.throughputRps.toFixed(
        2
      )} | ${r.latencies.p50.toFixed(1)} | ${r.latencies.p95.toFixed(1)} | ${r.latencies.p99.toFixed(1)} | ${(
        r.errorRate * 100
      ).toFixed(2)} | ${(r.timeoutRate * 100).toFixed(2)} | ${r.duplicateCount} (obs:${r.observedDuplicateCount}) | ${r.retryCount} | ${r.deadLetterCount} | ${r.failureCategory} |`
    );
    if (r.failures.length) {
      lines.push(`- Failures for \`${r.gate}\`: ${r.failures.join("; ")}`);
    }
  }

  if (summary.stageResults?.length) {
    lines.push("");
    lines.push("## Stage-by-Stage Degradation");
    lines.push("");
    lines.push("| Gate | Stage | Pass | p50 | p95 | p99 | Error % | Timeout % | Retries | Dead letters | Category |");
    lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
    for (const r of summary.stageResults) {
      lines.push(
        `| ${r.gate} | ${r.stage || "-"} | ${r.pass ? "PASS" : "FAIL"} | ${r.latencies.p50.toFixed(1)} | ${r.latencies.p95.toFixed(
          1
        )} | ${r.latencies.p99.toFixed(1)} | ${(r.errorRate * 100).toFixed(2)} | ${(r.timeoutRate * 100).toFixed(2)} | ${r.retryCount} | ${r.deadLetterCount} | ${r.failureCategory} |`
      );
    }
  }

  if (summary.degradationTable?.length) {
    lines.push("");
    lines.push("## First Degradation Point");
    lines.push("");
    lines.push("| Gate | First degradation | Category | Details |");
    lines.push("|---|---|---|---|");
    for (const d of summary.degradationTable) {
      lines.push(`| ${d.gate} | ${d.firstDegradationPoint} | ${d.failureCategory} | ${d.details} |`);
    }
  }
  lines.push("");
  lines.push("## Top 5 Bottlenecks");
  lines.push("");
  summary.topBottlenecks.forEach((b, i) => {
    lines.push(`${i + 1}. \`${b.gate}\` - ${b.reason}`);
  });
  lines.push("");
  lines.push("## Recommended Fixes");
  lines.push("");
  summary.recommendations.forEach((r, i) => {
    lines.push(`${i + 1}. ${r}`);
  });
  lines.push("");
  if (summary.failingGates.length) {
    lines.push("## Failing Gates");
    lines.push("");
    summary.failingGates.forEach((g) => lines.push(`- \`${g}\``));
  } else {
    lines.push("## Failing Gates");
    lines.push("");
    lines.push("- None");
  }
  return lines.join("\n");
}

async function run() {
  const options = parseArgs();
  await ensureLiveSessions(options);
  await ensureThreadForMessaging(options);
  await verifyCrossOrgAndRoleBoundary(options);
  const startedAt = nowIso();
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.resolve(options.outputRoot, runId);
  await fs.mkdir(outputDir, { recursive: true });

  const smoke = options.suite === "smoke";
  let results: ScenarioResult[] = [];
  let stageResults: ScenarioResult[] | undefined;

  if (options.suite === "live-ramp") {
    const ramp = await runLiveRamp(options);
    results = ramp.results;
    stageResults = ramp.stageResults;
    for (const r of stageResults) {
      await fs.writeFile(
        path.join(outputDir, `${r.gate}.${r.stage || "stage"}.json`),
        JSON.stringify(r, null, 2),
        "utf8"
      );
    }
  } else {
    const scenarios: Array<() => Promise<ScenarioResult>> = [];
    if (options.suite === "bookings" || options.suite === "full" || options.suite === "smoke") {
      scenarios.push(() => scenarioBookingsCreate(options, smoke));
    }
    if (options.suite === "messages" || options.suite === "full" || options.suite === "smoke") {
      scenarios.push(() => scenarioMessagesSend(options, smoke));
    }
    if (options.suite === "reads" || options.suite === "full" || options.suite === "smoke") {
      scenarios.push(() => scenarioBookingReads(options, smoke));
      scenarios.push(() => scenarioThreadReads(options, smoke));
    }
    if (options.suite === "queues" || options.suite === "full" || options.suite === "smoke") {
      scenarios.push(() => scenarioQueueBacklogDrain(options, smoke));
      scenarios.push(() => scenarioQueueRetryStorm(options, smoke));
    }
    if (options.suite === "full" || options.suite === "smoke") {
      scenarios.push(() => scenarioSessionBurst(options, smoke));
    }

    for (const scenario of scenarios) {
      // Run sequentially so each gate has isolated results.
      // This makes artifacts reproducible and easier to compare over time.
      const result = await scenario();
      results.push(result);
      await fs.writeFile(
        path.join(outputDir, `${result.gate}.json`),
        JSON.stringify(result, null, 2),
        "utf8"
      );
      // Minimal console telemetry for CI readability.
      console.log(
        `[load] ${result.gate} => ${result.pass ? "PASS" : "FAIL"} | p95=${result.latencies.p95.toFixed(
          1
        )}ms | err=${(result.errorRate * 100).toFixed(2)}% | timeout=${(result.timeoutRate * 100).toFixed(
          2
        )}% | throughput=${result.throughputRps.toFixed(2)}`
      );
    }
  }

  const topBottlenecks = options.suite === "live-ramp" ? summarizeRampBottlenecks(stageResults || results) : summarizeBottlenecks(results);
  const failingGates = results.filter((r) => !r.pass).map((r) => r.gate);
  const summary: RunSummary = {
    runId,
    startedAt,
    completedAt: nowIso(),
    mode: options.mode,
    suite: options.suite,
    baseUrl: options.baseUrl,
    thresholds: GATE_THRESHOLDS,
    results,
    topBottlenecks,
    failingGates,
    recommendations: buildRecommendations(results),
    stageResults,
    degradationTable: stageResults?.length ? deriveDegradationTable(stageResults) : undefined,
  };

  const summaryPath = path.join(outputDir, "summary.json");
  const reportPath = path.join(outputDir, "benchmark-report.md");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  await fs.writeFile(reportPath, formatReport(summary), "utf8");

  const latestDir = path.resolve(options.outputRoot, "latest");
  await fs.mkdir(latestDir, { recursive: true });
  await fs.writeFile(path.join(latestDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await fs.writeFile(path.join(latestDir, "benchmark-report.md"), formatReport(summary), "utf8");

  console.log(`[load] artifacts: ${outputDir}`);
  console.log(`[load] report: ${reportPath}`);
  if (failingGates.length > 0) {
    console.log(`[load] failing gates: ${failingGates.join(", ")}`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("[load] failed to execute benchmark suite", error);
  process.exitCode = 1;
});

