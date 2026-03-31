/**
 * Suppress Expected 404 Errors
 * 
 * These endpoints are from the legacy booking system and don't exist
 * in the messaging dashboard API. The frontend handles them gracefully,
 * but we suppress console errors to reduce noise.
 */

const EXPECTED_404_ENDPOINTS = [
  '/api/bookings',
  '/api/sitters',
];

/**
 * Check if an endpoint is expected to return 404
 */
export function isExpected404(endpoint: string): boolean {
  return EXPECTED_404_ENDPOINTS.some(expected => endpoint.includes(expected));
}

/**
 * Suppress console errors for expected 404s
 * Call this in catch blocks or error handlers
 */
export function suppressExpected404Error(endpoint: string, error: any): void {
  if (isExpected404(endpoint)) {
    // Silently ignore - these are legacy endpoints
    return;
  }
  // Re-throw or log other errors
  throw error;
}
