/**
 * Automation System Initialization
 *
 * Initializes the event-queue bridge that connects domain events to the
 * automation queue (the LIVE automation path).
 *
 * The old automation-engine.ts subscription is intentionally removed.
 * That engine is dead code — it subscribes to all events, queries the DB,
 * then early-returns without executing anything. Removing it eliminates
 * wasted DB queries on every event emission.
 */

import { initializeEventQueueBridge } from "./event-queue-bridge";

let initialized = false;

export function initAutomationEngine() {
  if (initialized) {
    return;
  }

  try {
    initializeEventQueueBridge();
    initialized = true;

    if (process.env.NODE_ENV !== "test") {
      console.log("[Automation] Event queue bridge initialized");
    }
  } catch (error) {
    console.error("[Automation] Failed to initialize event queue bridge:", error);
  }
}

// Auto-initialize when module is imported (server-side only)
if (typeof window === "undefined") {
  if (typeof setImmediate !== "undefined") {
    setImmediate(() => initAutomationEngine());
  } else {
    setTimeout(() => initAutomationEngine(), 0);
  }
}
