/**
 * NextAuth API Route (Gate B Phase 1)
 *
 * This route provides NextAuth endpoints but does not enforce authentication
 * until feature flags are enabled.
 * Rate limited to mitigate credential stuffing / brute force.
 */

import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { createHash } from "node:crypto";

type AuthLimiterClass = "session-check" | "auth-mutation" | "auth-read";

type SessionCacheEntry = {
  expiresAtMs: number;
  status: number;
  bodyText: string;
  contentType: string;
};

const SESSION_CACHE_TTL_MS = Number(process.env.AUTH_SESSION_CACHE_TTL_MS || "750");
const SESSION_CACHE_STALE_TTL_MS = Number(process.env.AUTH_SESSION_CACHE_STALE_TTL_MS || "5000");
const AUTH_SESSION_CHECK_LIMIT_PER_MINUTE = Number(process.env.AUTH_SESSION_CHECK_LIMIT_PER_MINUTE || "3600");
const AUTH_SESSION_ANON_LIMIT_PER_MINUTE = Number(process.env.AUTH_SESSION_ANON_LIMIT_PER_MINUTE || "240");
const AUTH_MUTATION_LIMIT_PER_MINUTE = Number(process.env.AUTH_MUTATION_LIMIT_PER_MINUTE || "80");
const AUTH_READ_LIMIT_PER_MINUTE = Number(process.env.AUTH_READ_LIMIT_PER_MINUTE || "240");
const sessionResponseCache = new Map<string, SessionCacheEntry>();
const sessionInFlight = new Map<string, Promise<Response>>();

function getSessionTokenIdentifier(request: NextRequest): { identifier: string; hasSessionToken: boolean } {
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenPair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find(
      (part) =>
        part.startsWith("__Secure-next-auth.session-token=") ||
        part.startsWith("next-auth.session-token=")
    );
  if (!tokenPair) return { identifier: getRateLimitIdentifier(request), hasSessionToken: false };
  const value = tokenPair.split("=")[1] || "";
  if (!value) return { identifier: getRateLimitIdentifier(request), hasSessionToken: false };
  const digest = createHash("sha256").update(value).digest("hex");
  return { identifier: digest.slice(0, 32), hasSessionToken: true };
}

function classifyAuthLimiter(request: NextRequest): AuthLimiterClass {
  const pathname = (request.nextUrl ?? new URL(request.url)).pathname;
  const method = request.method.toUpperCase();
  if (pathname.endsWith("/session") && method === "GET") {
    return "session-check";
  }
  if (method !== "GET") {
    return "auth-mutation";
  }
  if (
    pathname.includes("/signin") ||
    pathname.includes("/callback") ||
    pathname.includes("/signout")
  ) {
    return "auth-mutation";
  }
  return "auth-read";
}

function getAuthRateLimitConfig(request: NextRequest) {
  const limiterClass = classifyAuthLimiter(request);
  if (limiterClass === "session-check") {
    const sessionToken = getSessionTokenIdentifier(request);
    return {
      limiterClass,
      identifier: sessionToken.identifier,
      config: {
        keyPrefix: sessionToken.hasSessionToken ? "auth-session-check" : "auth-session-anon",
        limit: sessionToken.hasSessionToken
          ? Math.max(600, AUTH_SESSION_CHECK_LIMIT_PER_MINUTE)
          : Math.max(120, AUTH_SESSION_ANON_LIMIT_PER_MINUTE),
        windowSec: 60,
      },
    };
  }
  if (limiterClass === "auth-mutation") {
    return {
      limiterClass,
      identifier: getRateLimitIdentifier(request),
      config: { keyPrefix: "auth-mutation", limit: Math.max(40, AUTH_MUTATION_LIMIT_PER_MINUTE), windowSec: 60 },
    };
  }
  return {
    limiterClass,
    identifier: getRateLimitIdentifier(request),
    config: { keyPrefix: "auth-read", limit: Math.max(120, AUTH_READ_LIMIT_PER_MINUTE), windowSec: 60 },
  };
}

function readSessionCache(cacheKey: string, allowStale = false): Response | null {
  if (!cacheKey || SESSION_CACHE_TTL_MS <= 0) return null;
  const cached = sessionResponseCache.get(cacheKey);
  if (!cached) return null;
  const now = Date.now();
  const staleDeadline = cached.expiresAtMs + SESSION_CACHE_STALE_TTL_MS;
  if (!allowStale && cached.expiresAtMs <= now) {
    if (staleDeadline <= now) {
      sessionResponseCache.delete(cacheKey);
    }
    return null;
  }
  if (allowStale && staleDeadline <= now) {
    sessionResponseCache.delete(cacheKey);
    return null;
  }
  return new Response(cached.bodyText, {
    status: cached.status,
    headers: {
      "Content-Type": cached.contentType,
      "X-Snout-Session-Cache": allowStale ? "stale" : "hit",
    },
  });
}

async function writeSessionCache(cacheKey: string, response: Response): Promise<Response> {
  if (!cacheKey || SESSION_CACHE_TTL_MS <= 0) return response;
  if (response.status !== 200) return response;
  const contentType = response.headers.get("Content-Type") || "application/json";
  const bodyText = await response.text();
  sessionResponseCache.set(cacheKey, {
    expiresAtMs: Date.now() + SESSION_CACHE_TTL_MS,
    status: response.status,
    bodyText,
    contentType,
  });
  if (sessionResponseCache.size > 5000) {
    // Opportunistically trim stale entries under burst traffic.
    const now = Date.now();
    for (const [key, value] of sessionResponseCache.entries()) {
      if (value.expiresAtMs <= now) sessionResponseCache.delete(key);
    }
  }
  return new Response(bodyText, {
    status: response.status,
    headers: response.headers,
  });
}

export async function GET(request: NextRequest) {
  const { identifier, config, limiterClass } = getAuthRateLimitConfig(request);
  if (limiterClass === "session-check") {
    const cacheKey = `session:${identifier}`;
    const cached = readSessionCache(cacheKey);
    if (cached) return cached;
    const inFlight = sessionInFlight.get(cacheKey);
    if (inFlight) {
      const inflightResponse = await inFlight;
      return inflightResponse.clone();
    }
    const rl = await checkRateLimit(identifier, config);
    if (!rl.success) {
      const stale = readSessionCache(cacheKey, true);
      if (stale) return stale;
      return NextResponse.json(
        { error: "Too many requests", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }
    const requestPromise = (async () => {
      const response = await handlers.GET(request);
      return writeSessionCache(cacheKey, response);
    })();
    sessionInFlight.set(cacheKey, requestPromise);
    try {
      const response = await requestPromise;
      return response.clone();
    } finally {
      sessionInFlight.delete(cacheKey);
    }
  }
  const rl = await checkRateLimit(identifier, config);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const { identifier, config } = getAuthRateLimitConfig(request);
  const rl = await checkRateLimit(identifier, config);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  return handlers.POST(request);
}

