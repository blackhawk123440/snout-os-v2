import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSoftAntiPoachingFlag } from "@/lib/messaging/anti-poaching-flags";

vi.mock("@/lib/db", () => ({
  prisma: {
    messageConversationFlag: {
      create: vi.fn(),
    },
    messageThread: {
      findUnique: vi.fn(),
    },
    eventLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("createSoftAntiPoachingFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates anti-poaching flag for suspicious content", async () => {
    const flagged = await createSoftAntiPoachingFlag({
      orgId: "org-1",
      threadId: "thread-1",
      messageEventId: "event-1",
      body: "Text me directly at 555-123-1234",
    });

    expect(flagged).toBe(true);
    expect(prisma.messageConversationFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "anti_poaching",
          severity: "medium",
        }),
      })
    );
  });

  it("does not create flag for normal content", async () => {
    const flagged = await createSoftAntiPoachingFlag({
      orgId: "org-1",
      threadId: "thread-1",
      messageEventId: "event-1",
      body: "Can we move pickup to 3pm?",
    });

    expect(flagged).toBe(false);
    expect(prisma.messageConversationFlag.create).not.toHaveBeenCalled();
  });
});

