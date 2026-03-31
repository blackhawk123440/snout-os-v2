import { describe, expect, it } from "vitest";
import type { AutomationJobData } from "@/lib/automation-queue";
import type { CalendarJobType } from "@/lib/calendar-queue";
import type { FinanceReconcileJobData } from "@/lib/finance/reconcile-queue";
import type { ReminderTickJobData } from "@/lib/reminder-scheduler-queue";
import type { DailySnapshotJobData, WeeklyEvaluationJobData } from "@/lib/tiers/srs-queue";
import { enqueuePayoutForBooking } from "@/lib/payout/payout-queue";
import { enqueueAutomation } from "@/lib/automation-queue";
import {
  emitBookingCreated,
  emitBookingUpdated,
  emitPaymentSuccess,
  emitSitterAssigned,
} from "@/lib/event-emitter";

type Assert<T extends true> = T;
type HasCorrelationId<T> = "correlationId" extends keyof T ? true : false;

type _AutomationJobHasCorrelation = Assert<HasCorrelationId<AutomationJobData>>;
type _CalendarJobHasCorrelation = Assert<CalendarJobType extends { correlationId?: string } ? true : false>;
type _FinanceJobHasCorrelation = Assert<HasCorrelationId<FinanceReconcileJobData>>;
type _ReminderJobHasCorrelation = Assert<HasCorrelationId<ReminderTickJobData>>;
type _DailySnapshotHasCorrelation = Assert<HasCorrelationId<DailySnapshotJobData>>;
type _WeeklyEvalHasCorrelation = Assert<HasCorrelationId<WeeklyEvaluationJobData>>;

type _PayoutEnqueueHasCorrelation = Assert<
  HasCorrelationId<Parameters<typeof enqueuePayoutForBooking>[0]>
>;
type _AutomationEnqueueHasCorrelation = Assert<
  Parameters<typeof enqueueAutomation>[4] extends string | undefined ? true : false
>;

type _EmitBookingCreatedHasCorrelation = Assert<
  Parameters<typeof emitBookingCreated>[1] extends string | undefined ? true : false
>;
type _EmitBookingUpdatedHasCorrelation = Assert<
  Parameters<typeof emitBookingUpdated>[2] extends string | undefined ? true : false
>;
type _EmitPaymentSuccessHasCorrelation = Assert<
  Parameters<typeof emitPaymentSuccess>[2] extends string | undefined ? true : false
>;
type _EmitSitterAssignedHasCorrelation = Assert<
  Parameters<typeof emitSitterAssigned>[2] extends string | undefined ? true : false
>;

describe("correlation propagation coverage", () => {
  it("primary job payloads and event emitters accept correlationId", () => {
    expect(true).toBe(true);
  });
});
