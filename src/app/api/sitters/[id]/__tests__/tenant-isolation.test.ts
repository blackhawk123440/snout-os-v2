import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    sitter: {
      findFirst: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/sitters/[id]/route";
import { getRequestContext } from "@/lib/request-context";

describe("sitters route tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents sitter from reading another sitter profile", async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: "org-a",
      role: "sitter",
      sitterId: "sitter-1",
      userId: "u1",
    });

    const response = await GET(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: "sitter-2" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });
});
