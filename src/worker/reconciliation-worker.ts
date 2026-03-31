/**
 * Reconciliation Worker
 * 
 * Master Spec Reference: Section 5.3, Epic 12.3.5
 * 
 * Background worker for pricing reconciliation.
 * Runs pricing drift detection and logs results.
 */

import { runPricingReconciliation } from "@/lib/pricing-reconciliation";
import { logEvent } from "@/lib/event-logger";

/**
 * Process pricing reconciliation
 * 
 * This function is called by the reconciliation queue worker.
 * It runs the pricing reconciliation job and logs results.
 */
export async function processPricingReconciliation(): Promise<{
  totalChecked: number;
  driftsFound: number;
}> {
  try {
    console.log("[Reconciliation Worker] Starting pricing reconciliation...");

    // Run reconciliation (check up to 1000 bookings per run)
    const result = await runPricingReconciliation(1000, 0.01); // $0.01 threshold

    console.log(
      `[Reconciliation Worker] Reconciliation complete: ${result.totalChecked} checked, ${result.driftsFound} drifts found`
    );

    // Log summary
    if (result.driftsFound > 0) {
      console.warn(
        `[Reconciliation Worker] ⚠️  ${result.driftsFound} pricing drifts detected. Check exception queue.`
      );
    }

    return {
      totalChecked: result.totalChecked,
      driftsFound: result.driftsFound,
    };
  } catch (error: any) {
    console.error("[Reconciliation Worker] Reconciliation failed:", error);
    
    // Log error to EventLog
    await logEvent("pricing.reconciliation.error", "failed", {
      error: error?.message || String(error),
      metadata: {
        error: error?.message || String(error),
        stack: error?.stack,
      },
    });

    throw error;
  }
}

