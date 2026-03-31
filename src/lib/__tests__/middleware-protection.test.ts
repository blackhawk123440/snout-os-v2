/**
 * Middleware Protection Tests (Gate B Phase 2.1)
 * 
 * Integration-style tests for middleware protection behavior.
 * These test the logic flow rather than actual HTTP requests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPublicRoute } from "../public-routes";
import { isProtectedRoute } from "../protected-routes";

describe("Middleware Protection Logic", () => {
  describe("Route Classification", () => {
    it("should correctly classify booking form as public", () => {
      expect(isPublicRoute("/api/form")).toBe(true);
      expect(isProtectedRoute("/api/form")).toBe(false);
    });

    it("should correctly classify webhooks as public", () => {
      expect(isPublicRoute("/api/webhooks/stripe")).toBe(true);
      expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
      
      expect(isPublicRoute("/api/webhooks/sms")).toBe(true);
      expect(isProtectedRoute("/api/webhooks/sms")).toBe(false);
    });

    it("should correctly classify health check as public", () => {
      expect(isPublicRoute("/api/health")).toBe(true);
      expect(isProtectedRoute("/api/health")).toBe(false);
    });

    it("should correctly classify tip routes as public", () => {
      expect(isPublicRoute("/tip/success")).toBe(true);
      expect(isProtectedRoute("/tip/success")).toBe(false);
    });

    it("should correctly classify settings as protected", () => {
      expect(isPublicRoute("/settings")).toBe(false);
      expect(isProtectedRoute("/settings")).toBe(true);
    });

    it("should correctly classify automation as protected", () => {
      expect(isPublicRoute("/automation")).toBe(false);
      expect(isProtectedRoute("/automation")).toBe(true);
    });

    it("should correctly classify bookings API as protected", () => {
      expect(isPublicRoute("/api/bookings")).toBe(false);
      expect(isProtectedRoute("/api/bookings")).toBe(true);
    });

    it("should correctly classify payments API as protected", () => {
      expect(isPublicRoute("/api/payments")).toBe(false);
      expect(isProtectedRoute("/api/payments/create-payment-link")).toBe(true);
    });

    it("should correctly classify stripe API as protected", () => {
      expect(isPublicRoute("/api/stripe")).toBe(false);
      expect(isProtectedRoute("/api/stripe/analytics")).toBe(true);
    });
  });

  describe("No Route Should Be Both Public and Protected", () => {
    const testRoutes = [
      "/api/form",
      "/api/webhooks/stripe",
      "/api/webhooks/sms",
      "/api/health",
      "/tip/success",
      "/booking-form.html",
      "/settings",
      "/settings/pricing",
      "/automation",
      "/automation-center",
      "/payments",
      "/bookings",
      "/calendar",
      "/clients",
      "/api/automations",
      "/api/clients",
      "/api/sitters",
      "/api/bookings",
      "/api/settings",
      "/api/pricing-rules",
      "/api/discounts",
      "/api/stripe/analytics",
      "/api/payments/create-payment-link",
      "/api/reports",
    ];

    testRoutes.forEach((route) => {
      it(`should not classify ${route} as both public and protected`, () => {
        const isPublic = isPublicRoute(route);
        const isProtected = isProtectedRoute(route);
        
        // A route should be either public OR protected, not both
        // (though it can be neither if it's a static asset or other non-app route)
        if (isPublic) {
          expect(isProtected).toBe(false);
        }
        // Note: isProtected can be true even if isPublic is false
        // because some routes are neither (e.g., static assets)
      });
    });
  });

  describe("Critical Public Routes Must Remain Public", () => {
    const criticalPublicRoutes = [
      "/api/form", // Booking form submission
      "/api/webhooks/stripe", // Stripe webhook
      "/api/webhooks/sms", // SMS webhook
      "/api/health", // Health check
      "/tip/success", // Payment return
      "/tip/payment", // Payment form
      "/booking-form.html", // Static booking form
      "/api/auth/signin", // NextAuth signin
    ];

    criticalPublicRoutes.forEach((route) => {
      it(`should keep ${route} as public route`, () => {
        expect(isPublicRoute(route)).toBe(true);
        expect(isProtectedRoute(route)).toBe(false);
      });
    });
  });

  describe("Critical Protected Routes Must Be Protected", () => {
    const criticalProtectedRoutes = [
      "/settings", // Settings pages
      "/settings/pricing", // Pricing settings
      "/automation", // Automation pages
      "/api/automations", // Automation API
      "/api/clients", // Clients API
      "/api/sitters", // Sitters API
      "/api/bookings", // Bookings API (admin)
      "/api/settings", // Settings API
      "/api/payments/create-payment-link", // Payment admin
      "/api/stripe/analytics", // Stripe admin
    ];

    criticalProtectedRoutes.forEach((route) => {
      it(`should keep ${route} as protected route`, () => {
        expect(isProtectedRoute(route)).toBe(true);
      });
    });
  });
});

