import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: () => ({
    queueJobRecord: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
  }),
}));

const mockQueueAdd = vi.fn();

vi.mock("@/lib/queue-registry", () => ({
  getQueueByName: () => ({
    add: mockQueueAdd,
  }),
}));

const recordQueueJobQueued = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queue-observability", () => ({
  recordQueueJobQueued,
}));

import { POST } from "@/app/api/ops/failures/[id]/retry/route";
import { getRequestContext } from "@/lib/request-context";

describe("ops failures retry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-1",
      role: "owner",
      userId: "u1",
      correlationId: "corr-1",
    });
  });

  it("re-enqueues a failed job", async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        id: "rec-1",
        orgId: "org-1",
        queueName: "calendar-sync",
        jobName: "calendar:upsert",
        jobId: "job-1",
        status: "FAILED",
        retryCount: 1,
        subsystem: "calendar",
        resourceType: "booking",
        resourceId: "booking-1",
        payloadJson: JSON.stringify({ type: "upsert", bookingId: "booking-1", orgId: "org-1" }),
      })
      .mockResolvedValueOnce(null);

    mockQueueAdd.mockResolvedValue({ id: "job-retry-1" });

    const res = await POST(new Request("http://localhost/api/ops/failures/rec-1/retry"), {
      params: Promise.resolve({ id: "rec-1" }),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(recordQueueJobQueued).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
