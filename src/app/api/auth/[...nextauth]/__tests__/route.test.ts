import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mockCheckRateLimit = vi.fn();
const mockGetRateLimitIdentifier = vi.fn();
const mockHandlersGet = vi.fn();
const mockHandlersPost = vi.fn();

vi.mock("@/lib/auth", () => ({
  handlers: {
    GET: (...args: unknown[]) => mockHandlersGet(...args),
    POST: (...args: unknown[]) => mockHandlersPost(...args),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getRateLimitIdentifier: (...args: unknown[]) => mockGetRateLimitIdentifier(...args),
}));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

describe("/api/auth/[...nextauth] rate-limit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 100, resetAt: Date.now() / 1000 + 60 });
    mockGetRateLimitIdentifier.mockReturnValue("ip-1");
    mockHandlersGet.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    mockHandlersPost.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it("uses session-scoped limiter for /api/auth/session", async () => {
    const sessionToken = "session-token-abc123";
    const req = new Request("http://localhost/api/auth/session", {
      headers: { cookie: `next-auth.session-token=${sessionToken}` },
    });
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const expectedHash = createHash("sha256").update(sessionToken).digest("hex").slice(0, 32);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expectedHash,
      expect.objectContaining({ keyPrefix: "auth-session-check", limit: 3600, windowSec: 60 })
    );
  });

  it("uses mutation limiter for signin/callback-like auth routes", async () => {
    const req = new Request("http://localhost/api/auth/signin");
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockGetRateLimitIdentifier).toHaveBeenCalled();
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "ip-1",
      expect.objectContaining({ keyPrefix: "auth-mutation", limit: 80, windowSec: 60 })
    );
  });

  it("uses read limiter for non-session auth GET routes", async () => {
    const req = new Request("http://localhost/api/auth/providers");
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "ip-1",
      expect.objectContaining({ keyPrefix: "auth-read", limit: 240, windowSec: 60 })
    );
  });

  it("caches successful session responses briefly for same token", async () => {
    mockHandlersGet.mockResolvedValue(new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 }));
    const req = new Request("http://localhost/api/auth/session", {
      headers: { cookie: "next-auth.session-token=session-token-cache-1" },
    });

    const res1 = await GET(req as any);
    const res2 = await GET(req as any);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockHandlersGet).toHaveBeenCalledTimes(1);
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
  });

  it("serves stale session cache when limiter is exceeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    mockHandlersGet.mockResolvedValue(new Response(JSON.stringify({ user: { id: "u2" } }), { status: 200 }));
    const req = new Request("http://localhost/api/auth/session", {
      headers: { cookie: "next-auth.session-token=session-token-stale-1" },
    });
    const initial = await GET(req as any);
    expect(initial.status).toBe(200);
    vi.advanceTimersByTime(800);
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetAt: Date.now() / 1000 + 60, retryAfter: 30 });
    const response = await GET(req as any);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Snout-Session-Cache")).toBe("stale");
    vi.useRealTimers();
  });
});
