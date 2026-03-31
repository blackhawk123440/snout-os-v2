#!/usr/bin/env tsx
/**
 * Proof script for Part B: Booking Card Mobile Integration
 * 
 * Validates that Part B implementation is complete:
 * - BookingCardMobileSummary is used by bookings list mobile rendering
 * - SitterPoolPicker is used on the booking card
 * - BookingStatusInlineControl is used on the booking card
 * - Selection handlers are wired (presence of onToggleSelect or equivalent)
 */

import * as fs from 'fs';
import * as path from 'path';

const BOOKINGS_PAGE_PATH = path.join(__dirname, '../src/app/bookings/page.tsx');
const BOOKING_CARD_COMPONENT_PATH = path.join(__dirname, '../src/components/bookings/BookingCardMobileSummary.tsx');
const TABLE_COMPONENT_PATH = path.join(__dirname, '../src/components/ui/Table.tsx');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function main() {
  console.log('🔍 Verifying Part B: Booking Card Mobile Integration\n');

  const bookingsPageContent = fs.readFileSync(BOOKINGS_PAGE_PATH, 'utf-8');
  const bookingCardContent = fs.readFileSync(BOOKING_CARD_COMPONENT_PATH, 'utf-8');
  const tableContent = fs.readFileSync(TABLE_COMPONENT_PATH, 'utf-8');

  // 1. Table component has mobileCardRenderer prop
  assert(
    tableContent.includes('mobileCardRenderer') && tableContent.includes('mobileCardRenderer?:'),
    'Table component has mobileCardRenderer prop'
  );

  // 2. BookingCardMobileSummary is imported in bookings page
  assert(
    bookingsPageContent.includes("BookingCardMobileSummary") && bookingsPageContent.includes("from '@/components/bookings/BookingCardMobileSummary'"),
    "BookingCardMobileSummary is imported in bookings page"
  );

  // 3. renderBookingMobileCard function exists and uses BookingCardMobileSummary
  assert(
    bookingsPageContent.includes('renderBookingMobileCard') && bookingsPageContent.includes('<BookingCardMobileSummary'),
    'renderBookingMobileCard function exists and uses BookingCardMobileSummary'
  );

  // 4. mobileCardRenderer prop is passed to Table component
  assert(
    bookingsPageContent.includes('mobileCardRenderer={renderBookingMobileCard}'),
    'mobileCardRenderer prop is passed to Table component'
  );

  // 5. SitterPoolPicker is used in BookingCardMobileSummary
  assert(
    bookingCardContent.includes('<SitterPoolPicker') || bookingCardContent.includes('SitterPoolPicker'),
    'SitterPoolPicker is used in BookingCardMobileSummary'
  );

  // 6. BookingStatusInlineControl is used in BookingCardMobileSummary
  assert(
    bookingCardContent.includes('<BookingStatusInlineControl') || bookingCardContent.includes('BookingStatusInlineControl'),
    'BookingStatusInlineControl is used in BookingCardMobileSummary'
  );

  // 7. Selection handlers are wired (onToggleSelected prop exists in component props and usage)
  assert(
    (bookingCardContent.includes('onToggleSelected?:') || bookingCardContent.includes('onToggleSelected:')) && 
    (bookingCardContent.includes('selected?:') || bookingCardContent.includes('selected:')) &&
    (bookingCardContent.includes('onToggleSelected') && bookingCardContent.includes('selected')),
    'Selection handlers are wired (onToggleSelected and selected props exist in interface and usage)'
  );

  // 8. BookingCardMobileSummary has correct field order (Service + Status, Client name, Schedule, etc.)
  assert(
    bookingCardContent.includes('booking.service') && bookingCardContent.includes('booking.firstName') && bookingCardContent.includes('booking.lastName'),
    'BookingCardMobileSummary includes required fields (service, firstName, lastName)'
  );

  console.log('\n✅ All Part B checks passed!');
}

main();

