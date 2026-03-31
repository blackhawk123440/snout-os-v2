ALTER TABLE "BookingRequestIdempotency"
ADD COLUMN "reservationStatus" TEXT NOT NULL DEFAULT 'reserved';
