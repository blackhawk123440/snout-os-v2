/**
 * Next.js instrumentation - runs once on server boot.
 * - Node.js: verify-runtime + Sentry server
 * - Edge: Sentry edge
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const skipRuntimeVerification =
      process.env.SKIP_RUNTIME_VERIFICATION === "true" ||
      process.env.SKIP_RUNTIME_VERIFY === "true";

    if (skipRuntimeVerification) {
      console.warn("[verify-runtime] Skipped via SKIP_RUNTIME_VERIFICATION/SKIP_RUNTIME_VERIFY.");
    } else {
      const { verifyRuntime } = await import("@/lib/startup/verify-runtime");
      const result = await verifyRuntime();
      if (!result.ok) {
        console.error("[verify-runtime] Critical misconfiguration:", result.errors);
        throw new Error(`Startup verification failed: ${result.errors.join("; ")}`);
      }
      if (result.warnings.length) {
        console.warn("[verify-runtime] Warnings:", result.warnings);
      }
    }
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
