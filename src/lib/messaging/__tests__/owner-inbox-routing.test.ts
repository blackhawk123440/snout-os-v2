/**
 * Tests for owner-inbox-routing — verifies placeholder is replaced with
 * a hard error when no existing thread is found.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    thread: { findFirst: (...args: any[]) => mockFindFirst(...args) },
    message: { create: vi.fn().mockResolvedValue({ id: "msg-1" }) },
  },
}));

vi.mock("../event-logger", () => ({
  logEvent: vi.fn(),
}));

import { findOrCreateOwnerInboxThread } from "../owner-inbox-routing";

describe("findOrCreateOwnerInboxThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing thread when one is found", async () => {
    const fakeThread = {
      id: "thread-real",
      orgId: "org-1",
      threadType: "other",
      status: "active",
    };
    mockFindFirst.mockResolvedValueOnce(fakeThread);

    const result = await findOrCreateOwnerInboxThread("org-1");
    expect(result.id).toBe("thread-real");
  });

  it("throws instead of returning placeholder when no thread exists", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await expect(findOrCreateOwnerInboxThread("org-1")).rejects.toThrow(
      "Cannot create owner inbox thread"
    );
  });

  it("never returns an object with id 'owner-inbox-placeholder'", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    try {
      const result = await findOrCreateOwnerInboxThread("org-1");
      // If it somehow returns, verify no placeholder
      expect(result.id).not.toBe("owner-inbox-placeholder");
    } catch (e) {
      // Expected — the function throws now
      expect(e).toBeTruthy();
    }
  });
});
