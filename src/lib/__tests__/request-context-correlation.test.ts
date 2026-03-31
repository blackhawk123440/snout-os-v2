import { describe, expect, it, vi } from "vitest";
import { getRequestContext } from "@/lib/request-context";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-1", role: "owner" },
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_PERSONAL_MODE: true,
    PERSONAL_ORG_ID: "default",
  },
}));

describe("request-context correlationId", () => {
  it("uses x-correlation-id header when provided", async () => {
    const req = new Request("http://localhost", {
      headers: { "x-correlation-id": "corr-123" },
    });
    const ctx = await getRequestContext(req);
    expect(ctx.correlationId).toBe("corr-123");
  });
});
