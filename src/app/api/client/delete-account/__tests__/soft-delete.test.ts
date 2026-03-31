/**
 * Client delete-account emits EventLog entries.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    client: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    user: { update: (...args: unknown[]) => mockUpdate(...args) },
  })),
}));

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requireRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock("@/lib/log-event", () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/client/delete-account/route";
import { getRequestContext } from "@/lib/request-context";
import { logEvent } from "@/lib/log-event";

describe("client delete-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: "org-1",
      role: "client",
      userId: "u1",
      sitterId: null,
      clientId: "c1",
    });
    mockFindFirst.mockResolvedValue({
      id: "c1",
      deletedAt: null,
      user: { id: "u1" },
    });
    mockUpdate.mockResolvedValue({});
  });

  it("emits client.delete.requested and client.delete.completed", async () => {
    const res = await POST(new Request("http://localhost/api/client/delete-account", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "client.delete.requested",
        orgId: "org-1",
        entityType: "client",
        entityId: "c1",
      })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "client.delete.completed",
        orgId: "org-1",
        entityType: "client",
        entityId: "c1",
      })
    );
  });
});
