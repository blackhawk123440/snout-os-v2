/**
 * Lazy init for event-queue-bridge.
 * Call from API routes that emit events (check-out, status updates).
 * NEVER import from middleware or Edge runtime - this pulls in BullMQ.
 *
 * Web server: enqueue only. Worker process: process jobs.
 */

let initPromise: Promise<void> | null = null;

export async function ensureEventQueueBridge(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { initializeEventQueueBridge } = await import('./event-queue-bridge');
    initializeEventQueueBridge();
  })();
  return initPromise;
}
