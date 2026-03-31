/**
 * Typed API Client
 * 
 * Wraps fetch with:
 * - Base URL configuration
 * - JWT token handling
 * - Error normalization to human-readable messages
 * - Zod validation of responses
 */

import { z } from 'zod';

// Always use relative URLs - proxy through Next.js BFF layer
// The BFF proxy handles authentication and forwards to the API server
const API_BASE_URL = '';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Normalize API errors to human-readable messages
 */
function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Map common error messages
    if (error.message.includes('Invalid credentials')) {
      return 'The email or password you entered is incorrect.';
    }
    if (error.message.includes('Invalid webhook signature')) {
      return 'Webhook verification failed. Check your provider configuration.';
    }
    if (error.message.includes('Thread not found')) {
      return 'This conversation thread could not be found.';
    }
    if (error.message.includes('Policy violation')) {
      return 'Your message contains content that cannot be sent. Please remove phone numbers, emails, or external links.';
    }
    if (error.message.includes('Cannot quarantine')) {
      return error.message;
    }
    if (error.message.includes('assignment window')) {
      return 'You cannot send messages outside your active assignment window.';
    }

    return error.message || 'An unexpected error occurred.';
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Set auth token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

/**
 * Typed fetch wrapper
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>,
): Promise<T> {
  const token = getAuthToken();
  // If API_BASE_URL is empty, use relative URL (same origin for Next.js API routes)
  // If API_BASE_URL is set, use it (for separate API server)
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  // Check if this is the threads LIST endpoint (for diagnostics tracking)
  // Match: /api/messages/threads or /api/messages/threads?params
  // Don't match: /api/messages/threads/:id
  const isThreadsListEndpoint = endpoint === '/api/messages/threads' || 
    endpoint.startsWith('/api/messages/threads?') || 
    (endpoint.startsWith('/api/messages/threads') && !endpoint.match(/\/api\/messages\/threads\/[^?]/));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Store fetch metadata for diagnostics (only for threads LIST endpoint, not detail)
    if (typeof window !== 'undefined' && isThreadsListEndpoint) {
      const responseClone = response.clone();
      responseClone.text().then((text) => {
        (window as any).__lastThreadsFetch = {
          url,
          status: response.status,
          responseSize: text.length,
          timestamp: new Date().toISOString(),
        };
      }).catch(() => {
        // Ignore errors reading response
      });
    }

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new ApiError(
          `Request failed: ${response.statusText}`,
          response.status,
        );
      }
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || `Request failed: ${response.statusText}`;
      const apiError = new ApiError(errorMessage, response.status, data.code);
      
      // Store error details for diagnostics
      if (typeof window !== 'undefined' && isThreadsListEndpoint) {
        (window as any).__lastThreadsFetch = {
          url,
          status: response.status,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
      
      // For 429 errors, add a helpful message
      if (response.status === 429) {
        throw new ApiError(
          'Rate limit exceeded. Please wait a moment and refresh the page.',
          response.status,
          data.code
        );
      }
      
      throw apiError;
    }

    // Validate response with Zod schema if provided
    if (schema) {
      return schema.parse(data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      // Store error details for diagnostics
      if (typeof window !== 'undefined' && isThreadsListEndpoint) {
        (window as any).__lastThreadsFetch = {
          url,
          status: error.statusCode || 0,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw new ApiError(
        `Invalid response format: ${error.issues.map((e) => e.message).join(', ')}`,
        500,
        'VALIDATION_ERROR',
      );
    }

    const message = normalizeError(error);
    throw new ApiError(message, 500, 'UNKNOWN_ERROR');
  }
}

/**
 * GET request
 */
export function apiGet<T>(
  endpoint: string,
  schema?: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET', ...options }, schema);
}

/**
 * POST request
 */
export function apiPost<T>(
  endpoint: string,
  body?: unknown,
  schema?: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    },
    schema,
  );
}

/**
 * PATCH request
 */
export function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  schema?: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    },
    schema,
  );
}

/**
 * DELETE request
 */
export function apiDelete<T>(
  endpoint: string,
  schema?: z.ZodSchema<T>,
  options?: RequestInit,
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE', ...options }, schema);
}
