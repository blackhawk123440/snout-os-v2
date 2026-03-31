import { describe, it, expect } from "vitest";
import { whereOrg } from "@/lib/org-scope";

describe("whereOrg", () => {
  it("injects orgId into query where objects", () => {
    expect(whereOrg("org-1", { id: "abc" })).toEqual({ orgId: "org-1", id: "abc" });
  });
});
