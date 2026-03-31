/**
 * Invariant helper for API routes.
 * Throws with consistent 4xx shape instead of random 500s.
 */

export type InvariantCode = 400 | 402 | 403 | 404 | 500;

export interface InvariantMeta {
  orgId?: string;
  entityId?: string;
  entityType?: string;
  route?: string;
  [key: string]: unknown;
}

export class InvariantError extends Error {
  constructor(
    public readonly code: InvariantCode,
    message: string,
    public readonly meta?: InvariantMeta
  ) {
    super(message);
    this.name = 'InvariantError';
  }
}

/**
 * Assert condition or throw with consistent 4xx response shape.
 * Use in API routes for invariant failures.
 *
 * @example
 * invariantOrThrow(!!thread, { code: 404, message: 'Thread not found', meta: { threadId } });
 * invariantOrThrow(thread.orgId === orgId, { code: 403, message: 'Unauthorized', meta: { orgId } });
 */
export function invariantOrThrow(
  condition: boolean,
  options: {
    code: InvariantCode;
    message: string;
    meta?: InvariantMeta;
  }
): asserts condition {
  if (!condition) {
    throw new InvariantError(options.code, options.message, options.meta);
  }
}

/**
 * Standard JSON shape for invariant failures in API responses.
 */
export function invariantErrorResponse(err: InvariantError): {
  error: string;
  code: InvariantCode;
  meta?: InvariantMeta;
} {
  return {
    error: err.message,
    code: err.code,
    ...(err.meta && Object.keys(err.meta).length > 0 ? { meta: err.meta } : {}),
  };
}
