/**
 * Sentry for worker process (standalone Node, not Next.js).
 * Call initWorkerSentry() at worker startup.
 */

import * as Sentry from "@sentry/node";

let initialized = false;

export function initWorkerSentry() {
  if (initialized || !process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
  initialized = true;
}

export function captureWorkerError(
  error: Error,
  context?: { jobName?: string; orgId?: string; bookingId?: string; correlationId?: string }
) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context?.jobName) scope.setTag("jobName", context.jobName);
    if (context?.orgId) scope.setTag("orgId", context.orgId);
    if (context?.bookingId) scope.setTag("bookingId", context.bookingId);
    if (context?.correlationId) scope.setTag("correlationId", context.correlationId);
    Sentry.captureException(error);
  });
}
