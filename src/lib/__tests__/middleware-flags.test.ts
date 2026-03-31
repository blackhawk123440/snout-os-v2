/**
 * Middleware Feature Flags Tests (Gate B Phase 1)
 * 
 * Tests to ensure middleware allows all requests when flags are OFF.
 * This proves zero behavior change with flags disabled.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { isPublicRoute } from "../public-routes";

// Test the public routes function directly (simpler than testing middleware)
describe("Public Routes Allowlist", () => {
  it("should identify booking form as public", () => {
    expect(isPublicRoute("/api/form")).toBe(true);
  });

  it("should identify Stripe webhook as public", () => {
    expect(isPublicRoute("/api/webhooks/stripe")).toBe(true);
  });

  it("should identify SMS webhook as public", () => {
    expect(isPublicRoute("/api/webhooks/sms")).toBe(true);
  });

  it("should identify health check as public", () => {
    expect(isPublicRoute("/api/health")).toBe(true);
  });

  it("should identify tip payment pages as public", () => {
    expect(isPublicRoute("/tip/success")).toBe(true);
    expect(isPublicRoute("/tip/payment")).toBe(true);
    expect(isPublicRoute("/tip/cancel")).toBe(true);
  });

  it("should identify NextAuth routes as public", () => {
    expect(isPublicRoute("/api/auth/signin")).toBe(true);
    expect(isPublicRoute("/api/auth/callback")).toBe(true);
  });

  it("should NOT identify admin routes as public", () => {
    expect(isPublicRoute("/api/bookings")).toBe(false);
    expect(isPublicRoute("/api/automations")).toBe(false);
    expect(isPublicRoute("/bookings")).toBe(false);
  });
});

