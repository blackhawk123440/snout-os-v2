import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  processInboundReconcileJob,
  type InboundExternalEvent,
} from "@/lib/calendar/bidirectional-adapter";

// Mock DB
const mockEventLogFindFirst = vi.fn().mockResolvedValue(null);
const mockEventLogCreate = vi.fn().mockResolvedValue({ id: "evt-1" });
const mockOverrideUpsert = vi.fn().mockResolvedValue({ id: "ovr-1" });

const mockDb = {
  eventLog: {
    findFirst: (...args: any[]) => mockEventLogFindFirst(...args),
    create: (...args: any[]) => mockEventLogCreate(...args),
  },
  sitterAvailabilityOverride: {
    upsert: (...args: any[]) => mockOverrideUpsert(...args),
  },
} as any;

describe("calendar bidirectional adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns disabled when flag is off", async () => {
    const observe = vi.fn();
    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events: [{ externalEventId: "e1", action: "moved" }] },
      { enabled: false, observe, db: mockDb }
    );

    expect(result.status).toBe("disabled");
    expect(result.movedDetected).toBe(0);
    expect(observe).toHaveBeenCalledWith("calendar.inbound.skipped", expect.objectContaining({ reason: "flag_disabled" }));
  });

  it("returns no_events when events array is empty", async () => {
    const observe = vi.fn();
    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events: [] },
      { enabled: true, observe, db: mockDb }
    );
    expect(result.status).toBe("no_events");
  });

  it("creates SitterAvailabilityOverride blackout for moved events with time range", async () => {
    const observe = vi.fn();
    const events: InboundExternalEvent[] = [
      {
        externalEventId: "gcal-123",
        action: "moved",
        startAt: "2026-04-01T14:00:00Z",
        endAt: "2026-04-01T16:00:00Z",
        updatedAt: "2026-03-25T10:00:00Z",
      },
    ];

    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events },
      { enabled: true, observe, db: mockDb }
    );

    expect(result.status).toBe("processed");
    expect(result.movedDetected).toBe(1);
    expect(result.overridesCreated).toBe(1);
    expect(result.conflictCandidates).toBe(1);

    // Verify override was created as blackout
    expect(mockOverrideUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockOverrideUpsert.mock.calls[0][0];
    expect(upsertArg.create.sitterId).toBe("s1");
    expect(upsertArg.create.isAvailable).toBe(false);
    expect(upsertArg.create.startTime).toBe("14:00");
    expect(upsertArg.create.endTime).toBe("16:00");
  });

  it("creates override for upserted events with time range", async () => {
    const events: InboundExternalEvent[] = [
      {
        externalEventId: "gcal-456",
        action: "upserted",
        startAt: "2026-04-02T09:00:00Z",
        endAt: "2026-04-02T10:30:00Z",
        updatedAt: "2026-03-25T11:00:00Z",
      },
    ];

    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events },
      { enabled: true, observe: vi.fn(), db: mockDb }
    );

    expect(result.overridesCreated).toBe(1);
    expect(mockOverrideUpsert).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate events using persistent EventLog lookup", async () => {
    // Simulate existing dedup record
    mockEventLogFindFirst.mockResolvedValueOnce({ id: "existing-dedup" });

    const events: InboundExternalEvent[] = [
      {
        externalEventId: "gcal-789",
        action: "moved",
        updatedAt: "2026-03-25T10:00:00Z",
      },
    ];

    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events },
      { enabled: true, observe: vi.fn(), db: mockDb }
    );

    expect(result.duplicatePrevented).toBe(1);
    expect(result.movedDetected).toBe(0);
    expect(mockOverrideUpsert).not.toHaveBeenCalled();
  });

  it("records deduplication marker in EventLog after processing", async () => {
    const events: InboundExternalEvent[] = [
      { externalEventId: "gcal-abc", action: "deleted", updatedAt: "2026-03-25T12:00:00Z" },
    ];

    await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events },
      { enabled: true, observe: vi.fn(), db: mockDb }
    );

    // Should create EventLog entry with dedupeKey
    const createCalls = mockEventLogCreate.mock.calls.filter(
      (c: any) => c[0]?.data?.eventType === "calendar.inbound.processed"
    );
    expect(createCalls.length).toBe(1);
    const metadata = JSON.parse(createCalls[0][0].data.metadata);
    expect(metadata.dedupeKey).toContain("gcal-abc");
    expect(metadata.action).toBe("deleted");
  });

  it("logs conflict summary when conflicts detected", async () => {
    const events: InboundExternalEvent[] = [
      {
        externalEventId: "gcal-conflict",
        action: "moved",
        startAt: "2026-04-03T08:00:00Z",
        endAt: "2026-04-03T09:00:00Z",
        updatedAt: "2026-03-25T13:00:00Z",
      },
    ];

    await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events },
      { enabled: true, observe: vi.fn(), db: mockDb }
    );

    const conflictLog = mockEventLogCreate.mock.calls.find(
      (c: any) => c[0]?.data?.eventType === "calendar.inbound.conflict"
    );
    expect(conflictLog).toBeTruthy();
    const metadata = JSON.parse(conflictLog[0].data.metadata);
    expect(metadata.conflictCandidates).toBe(1);
    expect(metadata.overridesCreated).toBe(1);
  });

  it("handles deleted events (logs but does not crash)", async () => {
    const observe = vi.fn();
    const events: InboundExternalEvent[] = [
      { externalEventId: "gcal-del", action: "deleted" },
    ];

    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", events },
      { enabled: true, observe, db: mockDb }
    );

    expect(result.deletedDetected).toBe(1);
    expect(observe).toHaveBeenCalledWith(
      "calendar.inbound.event_deleted",
      expect.objectContaining({ externalEventId: "gcal-del" })
    );
  });

  it("preserves correlation ID throughout", async () => {
    const observe = vi.fn();
    const result = await processInboundReconcileJob(
      { orgId: "org-1", sitterId: "s1", correlationId: "corr-test", events: [{ externalEventId: "e1", action: "moved", startAt: "2026-04-01T10:00:00Z", endAt: "2026-04-01T11:00:00Z" }] },
      { enabled: true, observe, db: mockDb }
    );

    expect(result.correlationId).toBe("corr-test");
    expect(observe).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ correlationId: "corr-test" })
    );
  });
});
