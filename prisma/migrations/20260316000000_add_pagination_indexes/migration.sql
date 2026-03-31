-- Pagination/filtering indexes
CREATE INDEX "Booking_orgId_status_idx" ON "Booking"("orgId", "status");
CREATE INDEX "Booking_orgId_paymentStatus_idx" ON "Booking"("orgId", "paymentStatus");
CREATE INDEX "Client_orgId_lastBookingAt_idx" ON "Client"("orgId", "lastBookingAt");
CREATE INDEX "MessageThread_orgId_lastMessageAt_idx" ON "MessageThread"("orgId", "lastMessageAt");
