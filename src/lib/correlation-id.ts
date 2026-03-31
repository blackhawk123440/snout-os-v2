import { randomUUID } from "crypto";

const CORRELATION_ID_HEADER = "x-correlation-id";
const REQUEST_ID_HEADER = "x-request-id";

export function resolveCorrelationId(request?: Request, fallback?: string): string {
  const headerValue = request?.headers.get(CORRELATION_ID_HEADER) || request?.headers.get(REQUEST_ID_HEADER);
  const normalized = typeof headerValue === "string" ? headerValue.trim() : "";
  if (normalized) return normalized;
  if (fallback && fallback.trim()) return fallback.trim();
  return randomUUID();
}

export function normalizeCorrelationId(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function attachCorrelationIdHeader(headers: HeadersInit, correlationId: string): HeadersInit {
  if (!correlationId) return headers;
  if (headers instanceof Headers) {
    headers.set(CORRELATION_ID_HEADER, correlationId);
    return headers;
  }
  if (Array.isArray(headers)) {
    return [...headers, [CORRELATION_ID_HEADER, correlationId]];
  }
  return { ...(headers || {}), [CORRELATION_ID_HEADER]: correlationId };
}
