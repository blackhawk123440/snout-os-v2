import { describe, it, expect, beforeEach } from "vitest";
import {
  clearProviderDegradedMode,
  forceProviderDegradedMode,
  getProviderPressureState,
  recordProviderTransientFailure,
  resetProviderPressureStateForTests,
  shouldForceQueuedOnly,
} from "@/lib/messaging/provider-pressure";

describe("provider pressure circuit", () => {
  beforeEach(() => {
    resetProviderPressureStateForTests();
  });

  it("opens degraded mode after transient failure burst", async () => {
    const orgId = "org-burst";
    for (let i = 0; i < 10; i += 1) {
      await recordProviderTransientFailure({
        provider: "twilio",
        orgId,
        code: "429",
        message: "rate limited",
      });
    }
    const state = await getProviderPressureState({ provider: "twilio", orgId });
    expect(state.mode).toBe("degraded");
    expect(state.forcedQueuedOnly).toBe(true);
    expect(state.recentFailureCodes[0]).toBe("429");
  });

  it("supports explicit queued-only forcing and clearing", async () => {
    const orgId = "org-force";
    await forceProviderDegradedMode({
      provider: "twilio",
      orgId,
      reason: "manual pressure override",
      durationMs: 120_000,
    });
    expect(await shouldForceQueuedOnly({ provider: "twilio", orgId })).toBe(true);
    await clearProviderDegradedMode({ provider: "twilio", orgId });
    expect(await shouldForceQueuedOnly({ provider: "twilio", orgId })).toBe(false);
  });
});
