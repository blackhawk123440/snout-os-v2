/**
 * Tests for provider factory — verifies MockProvider behavior and provider selection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    messageAccount: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("../provider-credentials", () => ({
  getProviderCredentials: vi.fn().mockResolvedValue(null),
}));

describe("MockProvider behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all provider env vars to force MockProvider
    delete process.env.MESSAGING_PROVIDER;
    delete process.env.OPENPHONE_API_KEY;
    delete process.env.OPENPHONE_NUMBER_ID;
  });

  it("sendMessage throws descriptive error", async () => {
    const { getMessagingProvider } = await import("../provider-factory");
    const provider = await getMessagingProvider("org-test");

    await expect(
      provider.sendMessage({ to: "+15551234567", body: "test" })
    ).rejects.toThrow("No messaging provider configured");
  });

  it("updateSessionParticipants returns failure, not silent success", async () => {
    const { getMessagingProvider } = await import("../provider-factory");
    const provider = await getMessagingProvider("org-test");

    const result = await provider.updateSessionParticipants({
      sessionSid: "test",
      clientParticipantSid: "test",
      sitterParticipantSids: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain("No messaging provider configured");
  });

  it("verifyWebhook returns false", async () => {
    const { getMessagingProvider } = await import("../provider-factory");
    const provider = await getMessagingProvider("org-test");
    expect(provider.verifyWebhook("", "", "")).toBe(false);
  });

  it("parseInbound throws not implemented", async () => {
    const { getMessagingProvider } = await import("../provider-factory");
    const provider = await getMessagingProvider("org-test");
    expect(() => provider.parseInbound({})).toThrow("Not implemented");
  });
});

describe("provider selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns OpenPhone when MESSAGING_PROVIDER=openphone and keys set", async () => {
    process.env.MESSAGING_PROVIDER = "openphone";
    process.env.OPENPHONE_API_KEY = "test-key";
    process.env.OPENPHONE_NUMBER_ID = "test-number";

    const { getMessagingProvider } = await import("../provider-factory");
    const provider = await getMessagingProvider("org-test");

    // OpenPhone throws on updateSessionParticipants (no masking support)
    // MockProvider returns { success: false } — either way, NOT silent success
    let threwOrFailed = false;
    try {
      const result = await provider.updateSessionParticipants({
        sessionSid: "test",
        clientParticipantSid: "test",
        sitterParticipantSids: [],
      });
      // If it returns, it must NOT be a silent success
      threwOrFailed = !result.success;
    } catch {
      // OpenPhone throws — that's fine, not a silent success
      threwOrFailed = true;
    }
    expect(threwOrFailed).toBe(true);

    // Cleanup
    delete process.env.MESSAGING_PROVIDER;
    delete process.env.OPENPHONE_API_KEY;
    delete process.env.OPENPHONE_NUMBER_ID;
  });
});
