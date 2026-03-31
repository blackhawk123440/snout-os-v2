/**
 * Soft delete: auth block, export block, EventLog entries.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { getRequestContext } from "@/lib/request-context";
import { auth } from "@/lib/auth";

describe("getRequestContext blocks deleted users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user has deletedAt set", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", orgId: "org-1", role: "client", clientId: "c1" },
    } as any);

    mockFindUnique.mockResolvedValue({
      id: "u1",
      deletedAt: new Date("2025-01-01"),
    });

    await expect(getRequestContext()).rejects.toThrow("Account has been deleted");
  });

  it("succeeds when user has no deletedAt", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u2", orgId: "org-1", role: "owner" },
    } as any);

    mockFindUnique.mockResolvedValue({
      id: "u2",
      deletedAt: null,
    });

    const ctx = await getRequestContext();
    expect(ctx.userId).toBe("u2");
    // In personal mode (NEXT_PUBLIC_PERSONAL_MODE=true), orgId is always PERSONAL_ORG_ID || "default"
    expect(ctx.orgId).toBe("default");
  });
});
