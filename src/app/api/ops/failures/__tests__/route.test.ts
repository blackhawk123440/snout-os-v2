import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

const mockFindMany = vi.fn();
const mockBookingFindMany = vi.fn();
const mockSitterFindMany = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: () => ({
    queueJobRecord: { findMany: mockFindMany },
    booking: { findMany: mockBookingFindMany },
    sitter: { findMany: mockSitterFindMany },
  }),
}));

import { GET } from "@/app/api/ops/failures/route";
import { getRequestContext } from "@/lib/request-context";

describe("ops failures route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-1",
      role: "owner",
      userId: "u1",
    });
  });

  it("returns failures with booking detail", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "rec-1",
        queueName: "calendar-sync",
        jobName: "calendar:upsert",
        jobId: "job-1",
        status: "FAILED",
        retryCount: 1,
        lastError: "boom",
        providerErrorCode: "400",
        subsystem: "calendar",
        resourceType: "booking",
        resourceId: "booking-1",
        correlationId: "corr-1",
        payloadJson: JSON.stringify({ bookingId: "booking-1" }),
        startedAt: null,
        finishedAt: null,
        createdAt: new Date("2026-03-01T00:00:00Z"),
        updatedAt: new Date("2026-03-01T00:00:00Z"),
        retryOfJobId: null,
        lastRetryAt: null,
        lastRetryBy: null,
      },
    ]);
    mockBookingFindMany.mockResolvedValue([
      {
        id: "booking-1",
        firstName: "Maya",
        lastName: "Client",
        service: "Walk",
        startAt: new Date("2026-03-01T10:00:00Z"),
        status: "confirmed",
      },
    ]);
    mockSitterFindMany.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/ops/failures"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].booking?.id).toBe("booking-1");
  });
});
