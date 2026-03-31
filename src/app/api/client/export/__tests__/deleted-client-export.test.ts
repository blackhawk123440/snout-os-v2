/**
 * Deleted client cannot export (403).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    client: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    eventLog: { create: (...args: unknown[]) => mockCreate(...args) },
  })),
}));

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requireRole: vi.fn(),
  requireClientContext: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock("@/lib/export-client-data", () => ({
  buildClientExportBundle: vi.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/api/client/export/route";
import { getRequestContext } from "@/lib/request-context";

describe("client export deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: "org-1",
      role: "client",
      userId: "u1",
      sitterId: null,
      clientId: "c1",
    });
  });

  it("returns 403 when client has deletedAt", async () => {
    mockFindFirst.mockResolvedValue({
      id: "c1",
      deletedAt: new Date("2025-01-01"),
    });

    const res = await GET(new Request("http://localhost/api/client/export"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("deleted");
  });
});
