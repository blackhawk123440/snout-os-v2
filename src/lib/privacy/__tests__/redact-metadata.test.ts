import { describe, expect, it } from "vitest";
import { redactPhoneLikeString, redactSensitiveMetadata } from "@/lib/privacy/redact-metadata";

describe("redact metadata boundary", () => {
  it("redacts direct phone fields recursively", () => {
    const result = redactSensitiveMetadata({
      phone: "+15551112222",
      nested: {
        clientPhone: "+15553334444",
      },
      array: [{ supportPhone: "+15556667777" }],
    }) as any;

    expect(result.phone).not.toContain("1112222");
    expect(result.nested.clientPhone).not.toContain("3334444");
    expect(result.array[0].supportPhone).not.toContain("6667777");
  });

  it("redacts phone-like text values while keeping non-phone text", () => {
    const result = redactSensitiveMetadata({
      notes: "Contact +15558889999 before arrival",
      status: "active",
    }) as any;

    expect(result.notes).not.toContain("+15558889999");
    expect(result.status).toBe("active");
  });

  it("redacts simple phone strings", () => {
    expect(redactPhoneLikeString("+15550001111")).not.toContain("0001111");
  });
});
