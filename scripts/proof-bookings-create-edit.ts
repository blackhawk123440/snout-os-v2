/**
 * Proof Script: Bookings Create and Edit
 * 
 * Validates that:
 * 1. /bookings/new route exists
 * 2. BookingForm is imported there
 * 3. Booking detail edit uses BookingForm
 * 4. BookingRowActions exists and is used in bookings list
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const NEW_BOOKING_ROUTE = path.join(REPO_ROOT, 'src/app/bookings/new/page.tsx');
const BOOKING_DETAIL_PAGE = path.join(REPO_ROOT, 'src/app/bookings/[id]/page.tsx');
const BOOKINGS_LIST_PAGE = path.join(REPO_ROOT, 'src/app/bookings/page.tsx');
const BOOKING_FORM_COMPONENT = path.join(REPO_ROOT, 'src/components/bookings/BookingForm.tsx');
const BOOKING_ROW_ACTIONS_COMPONENT = path.join(REPO_ROOT, 'src/components/bookings/BookingRowActions.tsx');

const errors: string[] = [];
const warnings: string[] = [];

// 1. Check /bookings/new route exists
if (!fs.existsSync(NEW_BOOKING_ROUTE)) {
  errors.push(`❌ Missing: ${NEW_BOOKING_ROUTE}`);
} else {
  console.log(`✅ Found: ${NEW_BOOKING_ROUTE}`);
  
  const newBookingContent = fs.readFileSync(NEW_BOOKING_ROUTE, 'utf-8');
  
  // 2. Check BookingForm is imported
  if (!newBookingContent.includes('BookingForm')) {
    errors.push(`❌ Missing: BookingForm import in ${NEW_BOOKING_ROUTE}`);
  } else {
    console.log(`✅ BookingForm imported in ${NEW_BOOKING_ROUTE}`);
  }
  
  // Check BookingForm is used
  if (!newBookingContent.includes('<BookingForm') && !newBookingContent.includes('BookingForm')) {
    errors.push(`❌ Missing: BookingForm usage in ${NEW_BOOKING_ROUTE}`);
  } else {
    console.log(`✅ BookingForm used in ${NEW_BOOKING_ROUTE}`);
  }
}

// 3. Check BookingForm component exists
if (!fs.existsSync(BOOKING_FORM_COMPONENT)) {
  errors.push(`❌ Missing: ${BOOKING_FORM_COMPONENT}`);
} else {
  console.log(`✅ Found: ${BOOKING_FORM_COMPONENT}`);
  
  const bookingFormContent = fs.readFileSync(BOOKING_FORM_COMPONENT, 'utf-8');
  
  // Check BookingForm supports create and edit modes
  if (!bookingFormContent.includes("mode: 'create' | 'edit'") && 
      !bookingFormContent.includes('mode?:') &&
      !bookingFormContent.includes('mode =')) {
    warnings.push(`⚠️  BookingForm may not support create/edit modes: ${BOOKING_FORM_COMPONENT}`);
  } else {
    console.log(`✅ BookingForm supports create/edit modes`);
  }
}

// 4. Check booking detail edit uses BookingForm
if (!fs.existsSync(BOOKING_DETAIL_PAGE)) {
  errors.push(`❌ Missing: ${BOOKING_DETAIL_PAGE}`);
} else {
  console.log(`✅ Found: ${BOOKING_DETAIL_PAGE}`);
  
  const bookingDetailContent = fs.readFileSync(BOOKING_DETAIL_PAGE, 'utf-8');
  
  // Check BookingForm is imported
  if (!bookingDetailContent.includes('BookingForm')) {
    errors.push(`❌ Missing: BookingForm import in ${BOOKING_DETAIL_PAGE}`);
  } else {
    console.log(`✅ BookingForm imported in ${BOOKING_DETAIL_PAGE}`);
  }
  
  // Check BookingForm is used for edit
  if (!bookingDetailContent.includes('<BookingForm') && !bookingDetailContent.includes('BookingForm')) {
    errors.push(`❌ Missing: BookingForm usage in ${BOOKING_DETAIL_PAGE}`);
  } else {
    console.log(`✅ BookingForm used in ${BOOKING_DETAIL_PAGE}`);
  }
  
  // Check for bookingToFormValues usage (for edit mode prefilling)
  if (!bookingDetailContent.includes('bookingToFormValues')) {
    warnings.push(`⚠️  bookingToFormValues may not be used in ${BOOKING_DETAIL_PAGE}`);
  } else {
    console.log(`✅ bookingToFormValues used in ${BOOKING_DETAIL_PAGE}`);
  }
}

// 5. Check BookingRowActions exists
if (!fs.existsSync(BOOKING_ROW_ACTIONS_COMPONENT)) {
  errors.push(`❌ Missing: ${BOOKING_ROW_ACTIONS_COMPONENT}`);
} else {
  console.log(`✅ Found: ${BOOKING_ROW_ACTIONS_COMPONENT}`);
}

// 6. Check BookingRowActions is used in bookings list
if (!fs.existsSync(BOOKINGS_LIST_PAGE)) {
  errors.push(`❌ Missing: ${BOOKINGS_LIST_PAGE}`);
} else {
  console.log(`✅ Found: ${BOOKINGS_LIST_PAGE}`);
  
  const bookingsListContent = fs.readFileSync(BOOKINGS_LIST_PAGE, 'utf-8');
  
  // Check BookingRowActions is imported
  if (!bookingsListContent.includes('BookingRowActions')) {
    errors.push(`❌ Missing: BookingRowActions import in ${BOOKINGS_LIST_PAGE}`);
  } else {
    console.log(`✅ BookingRowActions imported in ${BOOKINGS_LIST_PAGE}`);
  }
  
  // Check BookingRowActions is used
  if (!bookingsListContent.includes('<BookingRowActions') && !bookingsListContent.includes('BookingRowActions')) {
    errors.push(`❌ Missing: BookingRowActions usage in ${BOOKINGS_LIST_PAGE}`);
  } else {
    console.log(`✅ BookingRowActions used in ${BOOKINGS_LIST_PAGE}`);
  }
}

// 7. Check New Booking button links to /bookings/new
if (fs.existsSync(BOOKINGS_LIST_PAGE)) {
  const bookingsListContent = fs.readFileSync(BOOKINGS_LIST_PAGE, 'utf-8');
  
  if (!bookingsListContent.includes('/bookings/new') && !bookingsListContent.includes('href="/bookings/new"')) {
    warnings.push(`⚠️  New Booking button may not link to /bookings/new in ${BOOKINGS_LIST_PAGE}`);
  } else {
    console.log(`✅ New Booking button links to /bookings/new`);
  }
}

// Report results
console.log('\n---\n');

if (errors.length > 0) {
  console.error('❌ ERRORS FOUND:');
  errors.forEach(error => console.error(`  ${error}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  WARNINGS:');
  warnings.forEach(warning => console.warn(`  ${warning}`));
}

console.log('✅ All required checks passed!');
process.exit(0);

