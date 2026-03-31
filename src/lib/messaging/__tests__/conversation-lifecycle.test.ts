import { describe, it, expect } from "vitest";
import { resolveConversationRouting } from "@/lib/messaging/conversation-lifecycle";

describe("resolveConversationRouting", () => {
  it("routes intake/staffing to company lane front desk", () => {
    const resolved = resolveConversationRouting({
      laneType: "company",
      activationStage: "staffing",
      lifecycleStatus: "active",
      assignedRole: "front_desk",
    });
    expect(resolved.laneType).toBe("company");
    expect(resolved.recipientRole).toBe("front_desk");
    expect(resolved.shouldRerouteToCompany).toBe(false);
  });

  it("routes active service window to sitter", () => {
    const now = new Date("2026-03-14T12:00:00.000Z");
    const resolved = resolveConversationRouting(
      {
        laneType: "service",
        activationStage: "service",
        lifecycleStatus: "active",
        assignedRole: "sitter",
        assignedSitterId: "sitter-1",
        serviceWindowStart: new Date("2026-03-14T10:00:00.000Z"),
        serviceWindowEnd: new Date("2026-03-14T16:00:00.000Z"),
      },
      now
    );
    expect(resolved.laneType).toBe("service");
    expect(resolved.recipientRole).toBe("sitter");
  });

  it("reroutes expired service lane to company/front desk", () => {
    const now = new Date("2026-03-20T12:00:00.000Z");
    const resolved = resolveConversationRouting(
      {
        laneType: "service",
        activationStage: "service",
        lifecycleStatus: "grace",
        assignedRole: "sitter",
        assignedSitterId: "sitter-1",
        serviceWindowStart: new Date("2026-03-14T10:00:00.000Z"),
        serviceWindowEnd: new Date("2026-03-14T16:00:00.000Z"),
        graceEndsAt: new Date("2026-03-17T16:00:00.000Z"),
      },
      now
    );
    expect(resolved.shouldRerouteToCompany).toBe(true);
    expect(resolved.laneType).toBe("company");
    expect(resolved.recipientRole).toBe("front_desk");
  });
});

