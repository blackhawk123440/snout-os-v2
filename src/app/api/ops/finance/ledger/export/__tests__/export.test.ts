/**
 * Ledger export tests: owner/admin only, org-scoped
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetRequestContext = vi.fn();
const mockRequireAnyRole = vi.fn();

vi.mock("@/lib/request-context", () => ({
  getRequestContext: () => mockGetRequestContext(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac")>();
  return {
    ...actual,
    requireAnyRole: (...args: unknown[]) => mockRequireAnyRole(...args),
  };
});

vi.mock("@/lib/tenancy", () => ({
  getScopedDb: vi.fn(() => ({
    ledgerEntry: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "le_1",
          orgId: "org-1",
          entryType: "charge",
          source: "stripe",
          stripeId: "ch_1",
          amountCents: 5000,
          currency: "usd",
          status: "succeeded",
          occurredAt: new Date(),
          createdAt: new Date(),
        },
      ]),
    },
  })),
}));

describe("GET /api/ops/finance/ledger/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestContext.mockResolvedValue({ orgId: "org-1", role: "owner" });
    mockRequireAnyRole.mockImplementation(() => {});
  });

  it("returns 401 when not authenticated", async () => {
    mockGetRequestContext.mockRejectedValue(new Error("Unauthorized"));

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/ops/finance/ledger/export");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when not owner/admin", async () => {
    mockGetRequestContext.mockResolvedValue({ orgId: "org-1", role: "sitter" });
    const { ForbiddenError } = await import("@/lib/rbac");
    mockRequireAnyRole.mockImplementation(() => {
      throw new ForbiddenError();
    });

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/ops/finance/ledger/export");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns org-scoped entries when owner", async () => {
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/ops/finance/ledger/export?start=2025-03-01&end=2025-03-31");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0].orgId).toBe("org-1");
  });
});
