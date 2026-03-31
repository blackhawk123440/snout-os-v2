import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockSendThreadMessage = vi.fn();
const mockClientFindFirst = vi.fn();
const mockSendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentWindow: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    client: {
      findFirst: (...args: unknown[]) => mockClientFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/messaging/send", () => ({
  sendThreadMessage: (...args: unknown[]) => mockSendThreadMessage(...args),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { sendAutomationMessageViaThread } from "@/lib/bookings/automation-thread-sender";

describe("automation-thread-sender guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to email when no thread mapping exists and client has email", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockClientFindFirst.mockResolvedValue({ email: "client@test.com", firstName: "Jane" });
    mockSendEmail.mockResolvedValue({ success: true });

    const result = await sendAutomationMessageViaThread({
      bookingId: "booking-1",
      orgId: "org-1",
      clientId: "client-1",
      message: "Test message",
      recipient: "client",
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("email");
    expect(mockSendThreadMessage).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "client@test.com" })
    );
  });

  it("returns failure when no thread and no client email available", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockClientFindFirst.mockResolvedValue(null);

    const result = await sendAutomationMessageViaThread({
      bookingId: "booking-1",
      orgId: "org-1",
      clientId: "client-1",
      message: "Test message",
      recipient: "client",
    });

    expect(result.success).toBe(false);
    expect(result.channel).toBe("none");
    expect(mockSendThreadMessage).not.toHaveBeenCalled();
  });

  it("uses thread send path when thread mapping exists", async () => {
    mockFindFirst.mockResolvedValue({
      thread: { id: "thread-1", numberId: "num-1", messageNumber: { id: "num-1" } },
    });
    mockSendThreadMessage.mockResolvedValue({ messageId: "event-1" });

    const result = await sendAutomationMessageViaThread({
      bookingId: "booking-1",
      orgId: "org-1",
      clientId: "client-1",
      message: "Masked thread message",
      recipient: "client",
    });

    expect(result.success).toBe(true);
    expect(result.usedThread).toBe(true);
    expect(result.channel).toBe("sms");
    expect(mockSendThreadMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        actor: { role: "automation", userId: null },
      })
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
