import { describe, expect, it } from "vitest";
import { getPhoneForViewer, getRealPhoneNumber, maskPhoneNumber } from "@/lib/masked-numbers";

describe("masked number guardrails", () => {
  it("returns masked values for sitter/client viewers", () => {
    const input = "+15551234567";
    expect(getPhoneForViewer(input, "sitter")).toBe(maskPhoneNumber(input));
    expect(getPhoneForViewer(input, "client")).toBe(maskPhoneNumber(input));
  });

  it("blocks real-number access without explicit internal authorization", () => {
    expect(() => getRealPhoneNumber("+15551234567")).toThrow(/authorization required/i);
    expect(() =>
      getPhoneForViewer("+15551234567", "owner", { isInternalAdmin: false, reason: "ops" })
    ).not.toBe("+15551234567");
  });

  it("allows real-number access only with explicit admin reason", () => {
    expect(
      getPhoneForViewer("+15551234567", "owner", {
        isInternalAdmin: true,
        reason: "fraud review",
      })
    ).toBe("+15551234567");
  });
});
