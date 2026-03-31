-- PayrollLineItem: add payoutTransferId for audit trail (one line per transfer)
ALTER TABLE "PayrollLineItem" ADD COLUMN "payoutTransferId" TEXT;

CREATE UNIQUE INDEX "PayrollLineItem_payoutTransferId_key" ON "PayrollLineItem"("payoutTransferId");
CREATE INDEX "PayrollLineItem_payoutTransferId_idx" ON "PayrollLineItem"("payoutTransferId");
