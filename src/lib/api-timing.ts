/**
 * API response timing utility.
 * Logs slow responses for visibility without external monitoring.
 */

export function withTiming<T>(
  handler: () => Promise<T>,
  label: string,
  warnMs: number = 2000
): Promise<T> {
  const start = Date.now();
  return handler().finally(() => {
    const ms = Date.now() - start;
    if (ms > warnMs) {
      console.warn(`[SLOW API] ${label}: ${ms}ms (threshold: ${warnMs}ms)`);
    }
  });
}
