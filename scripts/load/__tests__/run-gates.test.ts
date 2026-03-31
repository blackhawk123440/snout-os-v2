import { describe, expect, it } from "vitest";
import { isAcceptedMessageSuccess } from "../result-classifier";

describe("isAcceptedMessageSuccess", () => {
  it("treats accepted queued 202 message sends as success", () => {
    const ok = isAcceptedMessageSuccess(
      "/api/messages/threads/thread-1/messages",
      "POST",
      202,
      true,
      { accepted: true, queued: true }
    );
    expect(ok).toBe(true);
  });

  it("keeps non-message responses on native response ok", () => {
    const ok = isAcceptedMessageSuccess("/api/bookings?page=1", "GET", 429, false, {});
    expect(ok).toBe(false);
  });
});
