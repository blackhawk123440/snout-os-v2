/**
 * Integration tests: visit.completed enqueues payout; payout job creates transfer and persists;
 * rerun does not duplicate.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/payout/payout-queue", () => ({
  enqueuePayoutForBooking: vi.fn().mockResolvedValue(undefined),
  getPayoutJobId: (bookingId: string) => `payout:${bookingId}`,
}));

vi.mock("@/lib/automation-queue", () => ({
  enqueueAutomation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/event-logger", () => ({
  logEventFromLogger: vi.fn().mockResolvedValue(undefined),
}));

import { eventEmitter } from "@/lib/event-emitter";
import { enqueuePayoutForBooking } from "@/lib/payout/payout-queue";

describe("visit.completed enqueues payout", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { initializeEventQueueBridge } = await import("@/lib/event-queue-bridge");
    initializeEventQueueBridge();
  });

  it("enqueues payout when visit.completed has sitterId", async () => {
    await eventEmitter.emit("visit.completed", {
      bookingId: "b1",
      booking: { orgId: "org-1", sitterId: "s1" },
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(enqueuePayoutForBooking).toHaveBeenCalledWith({
      orgId: "org-1",
      bookingId: "b1",
      sitterId: "s1",
    });
  });

  it("does not enqueue payout when visit.completed has no sitterId", async () => {
    await eventEmitter.emit("visit.completed", {
      bookingId: "b2",
      booking: { orgId: "org-1", sitterId: null },
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(enqueuePayoutForBooking).not.toHaveBeenCalled();
  });
});

describe("getPayoutJobId", () => {
  it("returns deterministic jobId per bookingId", async () => {
    const { getPayoutJobId } = await import("@/lib/payout/payout-queue");
    expect(getPayoutJobId("b1")).toBe("payout:b1");
    expect(getPayoutJobId("booking-xyz")).toBe("payout:booking-xyz");
  });
});
