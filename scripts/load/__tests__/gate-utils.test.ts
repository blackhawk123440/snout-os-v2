import { describe, expect, it } from "vitest";
import { classifyStormOutcome, computeDuplicateMetrics, getHttpMockProfile } from "../gate-utils";

describe("load gate utils", () => {
  it("does not treat same idempotency key replay as unexpected duplicate", () => {
    const metrics = computeDuplicateMetrics(
      [
        { ok: true, status: 200, latencyMs: 100, resourceId: "b1", idempotencyKey: "k1" },
        { ok: true, status: 200, latencyMs: 110, resourceId: "b1", idempotencyKey: "k1" },
        { ok: true, status: 200, latencyMs: 120, resourceId: "b2", idempotencyKey: "k2" },
      ],
      { allowIdempotentReplayDuplicates: true }
    );

    expect(metrics.observedDuplicateCount).toBe(1);
    expect(metrics.unexpectedDuplicateCount).toBe(0);
    expect(metrics.duplicateRate).toBe(0);
  });

  it("counts cross-key resource collisions as unexpected duplicates", () => {
    const metrics = computeDuplicateMetrics(
      [
        { ok: true, status: 200, latencyMs: 80, resourceId: "b1", idempotencyKey: "k1" },
        { ok: true, status: 200, latencyMs: 81, resourceId: "b1", idempotencyKey: "k2" },
      ],
      { allowIdempotentReplayDuplicates: true }
    );

    expect(metrics.observedDuplicateCount).toBe(1);
    expect(metrics.unexpectedDuplicateCount).toBe(1);
    expect(metrics.duplicateRate).toBe(0.5);
  });

  it("classifies storm outcomes with bounded retries", () => {
    const permanent = classifyStormOutcome(0.001, 4);
    expect(permanent.classification).toBe("non_retryable_permanent");
    expect(permanent.deadLetter).toBe(true);
    expect(permanent.retryAttempts).toBe(0);

    const transient = classifyStormOutcome(0.05, 4);
    expect(transient.classification).toBe("retryable_transient");
    expect(transient.retryAttempts).toBeGreaterThanOrEqual(1);
    expect(transient.retryAttempts).toBeLessThanOrEqual(2);
    expect(transient.deadLetter).toBe(false);

    const success = classifyStormOutcome(0.9, 4);
    expect(success.classification).toBe("success");
    expect(success.retryAttempts).toBe(0);
    expect(success.deadLetter).toBe(false);
  });

  it("uses tuned read profiles for bookings and thread reads", () => {
    const bookingsProfile = getHttpMockProfile("/api/bookings?page=1&pageSize=50", "GET");
    const threadReadsProfile = getHttpMockProfile("/api/messages/threads/x/messages?page=1&pageSize=50", "GET");

    expect(bookingsProfile.baselineMs).toBeLessThan(85);
    expect(bookingsProfile.errorRate).toBeLessThanOrEqual(0.005);
    expect(threadReadsProfile.errorRate).toBeLessThan(0.012);
  });
});

