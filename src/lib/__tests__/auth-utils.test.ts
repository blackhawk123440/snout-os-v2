import { describe, expect, it } from "vitest";
import { normalizeSignInEmail, shouldInvalidateSessionToken } from "@/lib/auth-utils";

describe("auth-utils", () => {
  it("normalizes sign-in email input", () => {
    expect(normalizeSignInEmail("  CLIENT@Example.com ")).toBe("client@example.com");
  });

  it("invalidates session tokens for deleted users", () => {
    expect(
      shouldInvalidateSessionToken({
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
        passwordChangedAt: null,
        tokenIssuedAtSec: 100,
      })
    ).toBe(true);
  });

  it("invalidates session tokens issued before a password change", () => {
    expect(
      shouldInvalidateSessionToken({
        deletedAt: null,
        passwordChangedAt: new Date("2026-01-01T00:10:00.000Z"),
        tokenIssuedAtSec: Math.floor(new Date("2026-01-01T00:05:00.000Z").getTime() / 1000),
      })
    ).toBe(true);
  });

  it("keeps the session when verification data is unchanged", () => {
    expect(
      shouldInvalidateSessionToken({
        deletedAt: null,
        passwordChangedAt: new Date("2026-01-01T00:05:00.000Z"),
        tokenIssuedAtSec: Math.floor(new Date("2026-01-01T00:10:00.000Z").getTime() / 1000),
      })
    ).toBe(false);
  });
});
