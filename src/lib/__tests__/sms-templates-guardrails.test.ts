import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMessage = vi.fn();
process.env.ENFORCE_MASKED_ONLY_MESSAGING = "true";

vi.mock("@/lib/message-utils", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));
vi.mock("@/lib/phone-utils", () => ({
  getOwnerPhone: vi.fn().mockResolvedValue("+15559990000"),
  getSitterPhone: vi.fn().mockResolvedValue("+15558887777"),
}));

import {
  sendBookingConfirmedToClient,
  sendOwnerAlert,
  type Booking,
} from "@/lib/sms-templates";

describe("sms template guardrails", () => {
  const booking: Booking = {
    id: "booking-1",
    firstName: "Alex",
    lastName: "Client",
    phone: "+15551112222",
    email: "alex@example.com",
    address: "123 Main",
    service: "Dog Walk",
    startAt: new Date("2026-03-20T10:00:00.000Z"),
    endAt: new Date("2026-03-20T11:00:00.000Z"),
    totalPrice: 45,
    pets: [{ species: "dog" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks direct client sends when masked-only enforcement is active", async () => {
    const sent = await sendBookingConfirmedToClient(booking as any);
    expect(sent).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("still allows explicit owner-only alert sends", async () => {
    mockSendMessage.mockResolvedValue(true);
    const sent = await sendOwnerAlert(
      "Alex",
      "Client",
      "+15551112222",
      "Dog Walk",
      new Date("2026-03-20T10:00:00.000Z"),
      [{ species: "dog" }]
    );
    expect(sent).toBe(true);
    expect(mockSendMessage).toHaveBeenCalled();
  });
});
