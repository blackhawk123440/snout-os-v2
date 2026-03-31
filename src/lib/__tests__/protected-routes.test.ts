/**
 * Protected Routes Tests (Gate B Phase 2.1)
 * 
 * Tests to ensure protected routes are correctly identified.
 */

import { describe, it, expect } from "vitest";
import { isProtectedRoute } from "../protected-routes";

describe("isProtectedRoute", () => {
  describe("settings pages", () => {
    it("should protect /settings", () => {
      expect(isProtectedRoute("/settings")).toBe(true);
    });

    it("should protect /settings/pricing", () => {
      expect(isProtectedRoute("/settings/pricing")).toBe(true);
    });

    it("should protect /settings/business", () => {
      expect(isProtectedRoute("/settings/business")).toBe(true);
    });

    it("should protect /settings/services", () => {
      expect(isProtectedRoute("/settings/services")).toBe(true);
    });

    it("should protect /settings/custom-fields", () => {
      expect(isProtectedRoute("/settings/custom-fields")).toBe(true);
    });
  });

  describe("automation pages", () => {
    it("should protect /automation", () => {
      expect(isProtectedRoute("/automation")).toBe(true);
    });

    it("should protect /automation-center", () => {
      expect(isProtectedRoute("/automation-center")).toBe(true);
    });

    it("should protect /automation-center/new", () => {
      expect(isProtectedRoute("/automation-center/new")).toBe(true);
    });
  });

  describe("payment/admin pages", () => {
    it("should protect /payments", () => {
      expect(isProtectedRoute("/payments")).toBe(true);
    });
  });

  describe("booking management pages", () => {
    it("should protect /bookings", () => {
      expect(isProtectedRoute("/bookings")).toBe(true);
    });

    it("should protect /calendar", () => {
      expect(isProtectedRoute("/calendar")).toBe(true);
    });

    it("should protect /clients", () => {
      expect(isProtectedRoute("/clients")).toBe(true);
    });
  });

  describe("admin API routes", () => {
    it("should protect /api/automations", () => {
      expect(isProtectedRoute("/api/automations")).toBe(true);
    });

    it("should protect /api/clients", () => {
      expect(isProtectedRoute("/api/clients")).toBe(true);
    });

    it("should protect /api/sitters", () => {
      expect(isProtectedRoute("/api/sitters")).toBe(true);
    });

    it("should protect /api/bookings", () => {
      expect(isProtectedRoute("/api/bookings")).toBe(true);
    });

    it("should protect /api/settings", () => {
      expect(isProtectedRoute("/api/settings")).toBe(true);
    });

    it("should protect /api/pricing-rules", () => {
      expect(isProtectedRoute("/api/pricing-rules")).toBe(true);
    });

    it("should protect /api/discounts", () => {
      expect(isProtectedRoute("/api/discounts")).toBe(true);
    });

    it("should protect /api/stripe", () => {
      expect(isProtectedRoute("/api/stripe/analytics")).toBe(true);
    });

    it("should protect /api/payments", () => {
      expect(isProtectedRoute("/api/payments/create-payment-link")).toBe(true);
    });

    it("should protect /api/reports", () => {
      expect(isProtectedRoute("/api/reports")).toBe(true);
    });
  });

  describe("public routes should NOT be protected", () => {
    it("should NOT protect /api/form", () => {
      expect(isProtectedRoute("/api/form")).toBe(false);
    });

    it("should NOT protect /api/webhooks/stripe", () => {
      expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
    });

    it("should NOT protect /api/webhooks/sms", () => {
      expect(isProtectedRoute("/api/webhooks/sms")).toBe(false);
    });

    it("should NOT protect /api/health", () => {
      expect(isProtectedRoute("/api/health")).toBe(false);
    });

    it("should NOT protect /tip/success", () => {
      expect(isProtectedRoute("/tip/success")).toBe(false);
    });

    it("should NOT protect /booking-form.html", () => {
      expect(isProtectedRoute("/booking-form.html")).toBe(false);
    });

    it("should NOT protect /api/auth/signin", () => {
      expect(isProtectedRoute("/api/auth/signin")).toBe(false);
    });
  });
});

