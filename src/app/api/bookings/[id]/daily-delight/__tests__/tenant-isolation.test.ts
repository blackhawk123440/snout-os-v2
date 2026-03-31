import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

const mockBookingFindUnique = vi.fn();
const mockReportCreate = vi.fn();

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: () => ({
    booking: { findUnique: mockBookingFindUnique },
    report: { create: mockReportCreate },
  }),
}));

vi.mock("@/lib/ai", () => ({
  ai: {
    generateDailyDelight: vi.fn(),
  },
}));

import { POST } from "@/app/api/bookings/[id]/daily-delight/route";
import { getRequestContext } from "@/lib/request-context";
import { ai } from "@/lib/ai";

describe("daily delight tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes booking read by orgId", async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-a",
      role: "owner",
      sitterId: null,
      userId: "u1",
    });
    mockBookingFindUnique.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Booking not found");
    expect(mockBookingFindUnique).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      include: { pets: true, client: true },
    });
  });

  it("creates Report with content and mediaUrls when successful", async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-a",
      role: "sitter",
      sitterId: "sitter-1",
      userId: "u1",
    });
    mockBookingFindUnique.mockResolvedValue({
      id: "booking-1",
      orgId: "org-a",
      sitterId: "sitter-1",
      pets: [{ id: "pet-1" }],
      client: null,
    });
    (ai as any).generateDailyDelight.mockResolvedValue("Today was great!");
    mockReportCreate.mockResolvedValue({ id: "report-1" });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaUrls: ["https://example.com/photo1.jpg"] }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report).toBe("Today was great!");
    expect(mockReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "booking-1",
        content: "Today was great!",
        mediaUrls: '["https://example.com/photo1.jpg"]',
      }),
    });
  });

  it("accepts report in body and skips AI when provided (offline sync)", async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-a",
      role: "sitter",
      sitterId: "sitter-1",
      userId: "u1",
    });
    mockBookingFindUnique.mockResolvedValue({
      id: "booking-1",
      orgId: "org-a",
      sitterId: "sitter-1",
      pets: [],
      client: null,
    });
    mockReportCreate.mockResolvedValue({ id: "report-1" });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: "Had a wonderful visit today!", tone: "warm" }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report).toBe("Had a wonderful visit today!");
    expect((ai as any).generateDailyDelight).not.toHaveBeenCalled();
    expect(mockReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: "Had a wonderful visit today!",
      }),
    });
  });

  it("blocks sitter from accessing another sitter booking", async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-a",
      role: "sitter",
      sitterId: "sitter-1",
      userId: "u2",
    });
    mockBookingFindUnique.mockResolvedValue({
      id: "booking-1",
      orgId: "org-a",
      sitterId: "sitter-2",
      pets: [{ id: "pet-1" }],
      client: null,
    });
    (ai as any).generateDailyDelight.mockResolvedValue("report");

    const response = await POST(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });
});
