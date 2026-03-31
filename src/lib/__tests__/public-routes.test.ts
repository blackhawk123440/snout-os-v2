/**
 * Public Routes Tests (Gate B Phase 1)
 * 
 * Tests to ensure public routes are correctly identified.
 */

import { describe, it, expect } from "vitest";
import { isPublicRoute } from "../public-routes";

describe("isPublicRoute", () => {
  describe("booking form routes", () => {
    it("should allow /api/form", () => {
      expect(isPublicRoute("/api/form")).toBe(true);
    });

    it("should allow exact match for booking form", () => {
      expect(isPublicRoute("/api/form")).toBe(true);
    });
  });

  describe("webhook routes", () => {
    it("should allow /api/webhooks/stripe", () => {
      expect(isPublicRoute("/api/webhooks/stripe")).toBe(true);
    });

    it("should allow /api/webhooks/sms", () => {
      expect(isPublicRoute("/api/webhooks/sms")).toBe(true);
    });
  });

  describe("health check", () => {
    it("should allow /api/health", () => {
      expect(isPublicRoute("/api/health")).toBe(true);
    });
  });

  describe("tip payment routes", () => {
    it("should allow /tip/success", () => {
      expect(isPublicRoute("/tip/success")).toBe(true);
    });

    it("should allow /tip/payment", () => {
      expect(isPublicRoute("/tip/payment")).toBe(true);
    });

    it("should allow /tip/cancel", () => {
      expect(isPublicRoute("/tip/cancel")).toBe(true);
    });

    it("should allow paths starting with /tip/", () => {
      expect(isPublicRoute("/tip/123/456")).toBe(true);
    });
  });

  describe("NextAuth routes", () => {
    it("should allow /api/auth/signin", () => {
      expect(isPublicRoute("/api/auth/signin")).toBe(true);
    });

    it("should allow /api/auth/callback", () => {
      expect(isPublicRoute("/api/auth/callback")).toBe(true);
    });

    it("should allow any /api/auth/ path", () => {
      expect(isPublicRoute("/api/auth/anything")).toBe(true);
    });
  });

  describe("static booking form", () => {
    it("should allow /booking-form.html", () => {
      expect(isPublicRoute("/booking-form.html")).toBe(true);
    });
  });

  describe("protected routes", () => {
    it("should NOT allow /api/bookings", () => {
      expect(isPublicRoute("/api/bookings")).toBe(false);
    });

    it("should NOT allow /api/automations", () => {
      expect(isPublicRoute("/api/automations")).toBe(false);
    });

    it("should NOT allow /app/bookings", () => {
      expect(isPublicRoute("/app/bookings")).toBe(false);
    });

    it("should NOT allow /settings", () => {
      expect(isPublicRoute("/settings")).toBe(false);
    });
  });
});

