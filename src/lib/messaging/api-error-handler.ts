/**
 * API Error Handler
 * 
 * Centralized error handling for messaging API endpoints.
 * Ensures consistent HTTP status code mapping and prevents information leakage.
 */

import { NextResponse } from "next/server";
import { NotFoundError, UnauthorizedError, ValidationError, ForbiddenError } from "./errors";

export interface ApiErrorResponse {
  error: string;
  errorCode?: string;
  status: number;
}

/**
 * Map error to HTTP response
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = "An error occurred"
): NextResponse<ApiErrorResponse> {
  console.error("[api-error-handler] Error:", error);

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message || "Resource not found", status: 404 },
      { status: 404 }
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message || "Unauthorized", status: 401 },
      { status: 401 }
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message || "Validation failed", status: 400 },
      { status: 400 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message || "Forbidden", status: 403 },
      { status: 403 }
    );
  }

  if (error instanceof Error) {
    if (error.name === "NotFoundError" || error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Resource not found", status: 404 },
        { status: 404 }
      );
    }

    if (error.name === "UnauthorizedError" || error.message.includes("unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }

    if (error.name === "ValidationError" || error.message.includes("validation")) {
      return NextResponse.json(
        { error: error.message || "Validation failed", status: 400 },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: defaultMessage, status: 500 },
    { status: 500 }
  );
}
