import IORedis from "ioredis";

export type ProviderName = "twilio";

export interface ProviderPressureState {
  provider: ProviderName;
  orgId: string;
  mode: "normal" | "degraded";
  forcedQueuedOnly: boolean;
  transientFailureCount: number;
  recentFailureCodes: string[];
  windowStartedAt: string;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  degradedUntil: string | null;
  reason: string | null;
}

type MutableState = {
  provider: ProviderName;
  orgId: string;
  transientFailureCount: number;
  recentFailureCodes: string[];
  windowStartedAtMs: number;
  lastFailureAtMs: number | null;
  lastSuccessAtMs: number | null;
  degradedUntilMs: number | null;
  reason: string | null;
};

const WINDOW_MS = Number(process.env.MESSAGE_PROVIDER_PRESSURE_WINDOW_MS || "30000");
const FAILURE_THRESHOLD = Number(process.env.MESSAGE_PROVIDER_PRESSURE_FAILURE_THRESHOLD || "8");
const DEGRADE_DURATION_MS = Number(process.env.MESSAGE_PROVIDER_DEGRADE_DURATION_MS || "90000");
const MAX_RECENT_CODES = 10;
const REDIS_TTL_SEC = Number(process.env.MESSAGE_PROVIDER_PRESSURE_REDIS_TTL_SEC || "300");

const localState = new Map<string, MutableState>();
let redisClient: IORedis | null = null;

function redisEnabled(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  return !!process.env.REDIS_URL;
}

function getRedis(): IORedis | null {
  if (!redisEnabled()) return null;
  if (!redisClient) {
    redisClient = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
      lazyConnect: true,
    });
  }
  return redisClient;
}

function keyFor(provider: ProviderName, orgId: string): string {
  return `${provider}:${orgId}`;
}

function redisKeyFor(provider: ProviderName, orgId: string): string {
  return `messaging:provider-pressure:${provider}:${orgId}`;
}

function defaultState(provider: ProviderName, orgId: string): MutableState {
  return {
    provider,
    orgId,
    transientFailureCount: 0,
    recentFailureCodes: [],
    windowStartedAtMs: Date.now(),
    lastFailureAtMs: null,
    lastSuccessAtMs: null,
    degradedUntilMs: null,
    reason: null,
  };
}

function normalize(state: MutableState): ProviderPressureState {
  const now = Date.now();
  const degraded = !!state.degradedUntilMs && state.degradedUntilMs > now;
  return {
    provider: state.provider,
    orgId: state.orgId,
    mode: degraded ? "degraded" : "normal",
    forcedQueuedOnly: degraded,
    transientFailureCount: state.transientFailureCount,
    recentFailureCodes: state.recentFailureCodes.slice(0, MAX_RECENT_CODES),
    windowStartedAt: new Date(state.windowStartedAtMs).toISOString(),
    lastFailureAt: state.lastFailureAtMs ? new Date(state.lastFailureAtMs).toISOString() : null,
    lastSuccessAt: state.lastSuccessAtMs ? new Date(state.lastSuccessAtMs).toISOString() : null,
    degradedUntil: state.degradedUntilMs ? new Date(state.degradedUntilMs).toISOString() : null,
    reason: state.reason,
  };
}

async function maybeLoadFromRedis(provider: ProviderName, orgId: string): Promise<MutableState | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    if (redis.status === "wait") {
      await redis.connect().catch(() => {});
    }
    const raw = await redis.get(redisKeyFor(provider, orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MutableState;
    if (!parsed || parsed.orgId !== orgId || parsed.provider !== provider) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function persistState(state: MutableState): Promise<void> {
  localState.set(keyFor(state.provider, state.orgId), state);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(redisKeyFor(state.provider, state.orgId), JSON.stringify(state), "EX", Math.max(30, REDIS_TTL_SEC));
  } catch {
    // Best effort only.
  }
}

async function getMutableState(provider: ProviderName, orgId: string): Promise<MutableState> {
  const key = keyFor(provider, orgId);
  const existing = localState.get(key);
  if (existing) return existing;
  const loaded = await maybeLoadFromRedis(provider, orgId);
  if (loaded) {
    localState.set(key, loaded);
    return loaded;
  }
  const created = defaultState(provider, orgId);
  localState.set(key, created);
  return created;
}

function rollWindowIfNeeded(state: MutableState, nowMs: number): void {
  if (nowMs - state.windowStartedAtMs <= WINDOW_MS) return;
  state.windowStartedAtMs = nowMs;
  state.transientFailureCount = 0;
  state.recentFailureCodes = [];
}

function maybeRecoverFromDegraded(state: MutableState, nowMs: number): void {
  if (state.degradedUntilMs && state.degradedUntilMs <= nowMs) {
    state.degradedUntilMs = null;
    state.reason = null;
  }
}

export async function getProviderPressureState(params: {
  provider: ProviderName;
  orgId: string;
}): Promise<ProviderPressureState> {
  const state = await getMutableState(params.provider, params.orgId);
  maybeRecoverFromDegraded(state, Date.now());
  return normalize(state);
}

export async function recordProviderTransientFailure(params: {
  provider: ProviderName;
  orgId: string;
  code: string;
  message?: string | null;
}): Promise<ProviderPressureState> {
  const nowMs = Date.now();
  const state = await getMutableState(params.provider, params.orgId);
  rollWindowIfNeeded(state, nowMs);
  maybeRecoverFromDegraded(state, nowMs);
  state.transientFailureCount += 1;
  state.lastFailureAtMs = nowMs;
  state.recentFailureCodes = [params.code, ...state.recentFailureCodes].slice(0, MAX_RECENT_CODES);

  if (state.transientFailureCount >= FAILURE_THRESHOLD) {
    state.degradedUntilMs = nowMs + Math.max(15_000, DEGRADE_DURATION_MS);
    state.reason = `transient failure burst (${state.transientFailureCount}/${FAILURE_THRESHOLD})`;
  }

  await persistState(state);
  return normalize(state);
}

export async function recordProviderSendSuccess(params: {
  provider: ProviderName;
  orgId: string;
}): Promise<ProviderPressureState> {
  const nowMs = Date.now();
  const state = await getMutableState(params.provider, params.orgId);
  maybeRecoverFromDegraded(state, nowMs);
  rollWindowIfNeeded(state, nowMs);
  state.lastSuccessAtMs = nowMs;
  state.transientFailureCount = Math.max(0, state.transientFailureCount - 1);
  if (state.transientFailureCount === 0 && !state.degradedUntilMs) {
    state.reason = null;
    state.recentFailureCodes = [];
  }
  await persistState(state);
  return normalize(state);
}

export async function forceProviderDegradedMode(params: {
  provider: ProviderName;
  orgId: string;
  reason: string;
  durationMs?: number;
}): Promise<ProviderPressureState> {
  const nowMs = Date.now();
  const state = await getMutableState(params.provider, params.orgId);
  state.degradedUntilMs = nowMs + Math.max(10_000, params.durationMs ?? DEGRADE_DURATION_MS);
  state.reason = params.reason;
  state.lastFailureAtMs = nowMs;
  await persistState(state);
  return normalize(state);
}

export async function clearProviderDegradedMode(params: {
  provider: ProviderName;
  orgId: string;
}): Promise<ProviderPressureState> {
  const state = await getMutableState(params.provider, params.orgId);
  state.degradedUntilMs = null;
  state.reason = null;
  state.transientFailureCount = 0;
  state.recentFailureCodes = [];
  state.windowStartedAtMs = Date.now();
  await persistState(state);
  return normalize(state);
}

export async function shouldForceQueuedOnly(params: {
  provider: ProviderName;
  orgId: string;
}): Promise<boolean> {
  const state = await getProviderPressureState(params);
  return state.forcedQueuedOnly;
}

export function resetProviderPressureStateForTests(): void {
  localState.clear();
}
