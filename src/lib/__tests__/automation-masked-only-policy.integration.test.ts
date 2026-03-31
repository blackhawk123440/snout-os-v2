import { beforeEach, describe, expect, it, vi } from "vitest";

const mockBookingFindUnique = vi.fn();
const mockSendMessage = vi.fn();
const mockThreadSend = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/automation-utils", () => ({
  shouldSendToRecipient: vi.fn().mockResolvedValue(true),
  getMessageTemplate: vi.fn().mockResolvedValue(""),
  replaceTemplateVariables: vi.fn((template: string) => template || "fallback"),
}));

vi.mock("@/lib/message-utils", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

vi.mock("@/lib/bookings/automation-thread-sender", () => ({
  sendAutomationMessageViaThread: (...args: unknown[]) => mockThreadSend(...args),
}));

vi.mock("@/lib/phone-utils", () => ({
  getOwnerPhone: vi.fn().mockResolvedValue("+15556667777"),
  getSitterPhone: vi.fn().mockResolvedValue("+15557778888"),
}));

import { executeAutomationForRecipient } from "@/lib/automation-executor";

describe("automation masked-only policy integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindUnique.mockResolvedValue({
      id: "booking-1",
      orgId: "org-1",
      firstName: "Alex",
      lastName: "Client",
      phone: "+15551112222",
      email: "alex@example.com",
      service: "Dog Walk",
      startAt: new Date("2026-03-20T10:00:00.000Z"),
      endAt: new Date("2026-03-20T11:00:00.000Z"),
      quantity: 1,
      afterHours: false,
      holiday: false,
      totalPrice: 45,
      paymentStatus: "unpaid",
      status: "confirmed",
      pets: [{ species: "dog" }],
      timeSlots: [],
      sitter: { id: "sitter-1", firstName: "Sam", lastName: "Sitter", commissionPercentage: 80 },
      sitterId: "sitter-1",
      clientId: "client-1",
      stripePaymentLinkUrl: null,
      address: "123 Main",
      notes: null,
    });
  });

  it("does not fall back to raw sendMessage for client automation when masked thread send fails", async () => {
    process.env.ENFORCE_MASKED_ONLY_MESSAGING = "true";
    mockThreadSend.mockResolvedValue({
      success: false,
      error: "Masked delivery required: no thread/number mapping",
      usedThread: false,
    });

    const result = await executeAutomationForRecipient("bookingConfirmation", "client", {
      bookingId: "booking-1",
      orgId: "org-1",
    });

    expect(result.success).toBe(false);
    expect(mockThreadSend).toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
