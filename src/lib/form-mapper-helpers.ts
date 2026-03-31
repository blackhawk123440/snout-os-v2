/**
 * Helper functions for form mapper integration
 * Used in form route integration
 */

import type { NextRequest } from "next/server";
import type { MappingReport, RawNotesMetadata } from "./form-to-booking-mapper";
import type { RequestMetadata } from "./validation/form-booking";

/**
 * Extract request metadata from NextRequest
 */
export function extractRequestMetadata(request: NextRequest): RequestMetadata {
  // Get IP address (handle various proxy headers)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || undefined;

  // Get user agent
  const userAgent = request.headers.get("user-agent") || undefined;

  // Get referer
  const referer = request.headers.get("referer") || undefined;

  // Get origin
  const origin = request.headers.get("origin") || undefined;

  return {
    ip,
    userAgent,
    sourcePage: referer || origin,
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Redact PII and sensitive data from mapping report for logging
 * Removes raw notes content, phone numbers, emails, addresses, names
 */
export function redactMappingReport(report: MappingReport): {
  version: string;
  normalizedFields: {
    service: string;
    phone: string; // Only last 4 digits
    email: string | null;
    quantity: number;
    notes: string | null; // Only length, not content
    timezone: string;
    startAt: string;
    endAt: string;
  };
  warnings: string[];
  notesPrecedence: {
    selectedField: "specialInstructions" | "additionalNotes" | "notes" | null;
    rawNotesMetadata: {
      hasSpecialInstructions: boolean;
      hasAdditionalNotes: boolean;
      hasNotes: boolean;
      selectedField: "specialInstructions" | "additionalNotes" | "notes" | null;
    };
  };
  timezoneConversion: {
    sourceTimezone: string;
    rawStartAt?: string;
    rawEndAt?: string;
    computedStartAt: string;
    computedEndAt: string;
  };
  quantityCalculation: {
    serviceType: string;
    method: string;
    inputValue?: number;
    computedValue: number;
  };
  pricingMetadata?: {
    note: string;
  };
} {
  // Redact phone number (keep only last 4 digits)
  const redactPhone = (phone: string): string => {
    if (!phone || phone.length <= 4) return "****";
    return `****${phone.slice(-4)}`;
  };

  // Redact email (keep domain only)
  const redactEmail = (email: string | null): string | null => {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return "****@****";
    return `****@${parts[1]}`;
  };

  return {
    version: report.version,
    normalizedFields: {
      service: report.normalizedFields.service,
      phone: redactPhone(report.normalizedFields.phone),
      email: redactEmail(report.normalizedFields.email),
      quantity: report.normalizedFields.quantity,
      notes: report.normalizedFields.notes
        ? `[REDACTED - ${report.normalizedFields.notes.length} chars]`
        : null,
      timezone: report.normalizedFields.timezone,
      startAt: report.normalizedFields.startAt,
      endAt: report.normalizedFields.endAt,
    },
    warnings: report.warnings,
    notesPrecedence: {
      selectedField: report.notesPrecedence.selectedField,
      rawNotesMetadata: {
        hasSpecialInstructions: !!report.notesPrecedence.rawNotesMetadata.specialInstructions,
        hasAdditionalNotes: !!report.notesPrecedence.rawNotesMetadata.additionalNotes,
        hasNotes: !!report.notesPrecedence.rawNotesMetadata.notes,
        selectedField: report.notesPrecedence.selectedField,
      },
    },
    timezoneConversion: report.timezoneConversion,
    quantityCalculation: report.quantityCalculation,
    pricingMetadata: report.pricingMetadata,
  };
}

