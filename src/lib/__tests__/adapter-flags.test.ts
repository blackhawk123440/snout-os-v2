import { afterEach, describe, expect, it, vi } from "vitest";

describe("adapter feature flags", () => {
  const originalGoogleFlag = process.env.ENABLE_GOOGLE_BIDIRECTIONAL_SYNC;
  const originalGooglePublicFlag = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_BIDIRECTIONAL_SYNC;
  afterEach(() => {
    process.env.ENABLE_GOOGLE_BIDIRECTIONAL_SYNC = originalGoogleFlag;
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_BIDIRECTIONAL_SYNC = originalGooglePublicFlag;
    vi.resetModules();
  });

  it("default to off when env vars are unset", async () => {
    delete process.env.ENABLE_GOOGLE_BIDIRECTIONAL_SYNC;
    delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_BIDIRECTIONAL_SYNC;
    vi.resetModules();

    const flags = await import("@/lib/flags");
    expect(flags.ENABLE_GOOGLE_BIDIRECTIONAL_SYNC).toBe(false);
    // ENABLE_STRIPE_CONNECT_PAYOUTS was removed — dead flag (no callers)
  });
});
