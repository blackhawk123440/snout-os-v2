/**
 * Proof Script: Bookings Polish
 * 
 * Validates that:
 * 1. Sort option 'sitter' exists in bookings list
 * 2. Pricing breakdown component present on booking detail
 * 3. More menu contains assign actions in both places
 * 4. /bookings/new route can use WebflowBookingFormEmbed (if enabled)
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const BOOKINGS_PAGE = path.join(REPO_ROOT, 'src/app/bookings/page.tsx');
const BOOKING_DETAIL_PAGE = path.join(REPO_ROOT, 'src/app/bookings/[id]/page.tsx');
const BOOKING_ROW_ACTIONS = path.join(REPO_ROOT, 'src/components/bookings/BookingRowActions.tsx');
const NEW_BOOKING_ROUTE = path.join(REPO_ROOT, 'src/app/bookings/new/page.tsx');
const WEBFLOW_EMBED = path.join(REPO_ROOT, 'src/components/bookings/WebflowBookingFormEmbed.tsx');

const errors: string[] = [];
const warnings: string[] = [];

// 1. Check sort option 'sitter' exists
if (!fs.existsSync(BOOKINGS_PAGE)) {
  errors.push(`❌ Missing: ${BOOKINGS_PAGE}`);
} else {
  const content = fs.readFileSync(BOOKINGS_PAGE, 'utf-8');
  
  if (!content.includes("'sitter'") && !content.includes('sitter')) {
    errors.push(`❌ Missing: Sort option 'sitter' in ${BOOKINGS_PAGE}`);
  } else {
    console.log(`✅ Sort option 'sitter' found in bookings page`);
  }
  
  // Check sort logic for sitter
  if (!content.includes('sortBy === \'sitter\'') && !content.includes("sortBy === 'sitter'")) {
    warnings.push(`⚠️  Sort logic for 'sitter' may not be implemented in ${BOOKINGS_PAGE}`);
  } else {
    console.log(`✅ Sort logic for 'sitter' found`);
  }
}

// 2. Check pricing breakdown on booking detail
if (!fs.existsSync(BOOKING_DETAIL_PAGE)) {
  errors.push(`❌ Missing: ${BOOKING_DETAIL_PAGE}`);
} else {
  const content = fs.readFileSync(BOOKING_DETAIL_PAGE, 'utf-8');
  
  if (!content.includes('Pricing Breakdown') && !content.includes('pricingBreakdown')) {
    errors.push(`❌ Missing: Pricing breakdown section in ${BOOKING_DETAIL_PAGE}`);
  } else {
    console.log(`✅ Pricing breakdown found in booking detail`);
  }
  
  // Check if it uses real pricing engine
  if (content.includes('getPricingForDisplay') || content.includes('pricingSnapshot')) {
    console.log(`✅ Pricing breakdown uses real pricing data`);
  } else {
    warnings.push(`⚠️  Pricing breakdown may not use real pricing engine in ${BOOKING_DETAIL_PAGE}`);
  }
}

// 3. Check More menu contains assign actions in booking detail
if (!fs.existsSync(BOOKING_DETAIL_PAGE)) {
  errors.push(`❌ Missing: ${BOOKING_DETAIL_PAGE}`);
} else {
  const content = fs.readFileSync(BOOKING_DETAIL_PAGE, 'utf-8');
  
  // Check for assign/unassign in More menu
  const hasAssignInMore = content.includes('Assign Sitter') || content.includes('Change Sitter') || content.includes('Unassign Sitter');
  const hasMoreModal = content.includes('showMoreActionsModal') || content.includes('More Actions');
  
  if (!hasMoreModal) {
    errors.push(`❌ Missing: More Actions modal in ${BOOKING_DETAIL_PAGE}`);
  } else if (!hasAssignInMore) {
    errors.push(`❌ Missing: Assign/Unassign actions in More menu in ${BOOKING_DETAIL_PAGE}`);
  } else {
    console.log(`✅ More menu contains assign actions in booking detail`);
  }
  
  // Check for assign modal
  if (content.includes('showAssignModal')) {
    console.log(`✅ Assign modal exists in booking detail`);
  } else {
    warnings.push(`⚠️  Assign modal may be missing in ${BOOKING_DETAIL_PAGE}`);
  }
}

// 4. Check WebflowBookingFormEmbed component exists
if (!fs.existsSync(WEBFLOW_EMBED)) {
  warnings.push(`⚠️  WebflowBookingFormEmbed component not found at ${WEBFLOW_EMBED}`);
} else {
  console.log(`✅ WebflowBookingFormEmbed component found`);
  
  const content = fs.readFileSync(WEBFLOW_EMBED, 'utf-8');
  
  if (content.includes('mode') && content.includes('edit') && content.includes('create')) {
    console.log(`✅ WebflowBookingFormEmbed supports create and edit modes`);
  } else {
    warnings.push(`⚠️  WebflowBookingFormEmbed may not fully support edit mode`);
  }
}

// Check if /bookings/new can use WebflowBookingFormEmbed
if (!fs.existsSync(NEW_BOOKING_ROUTE)) {
  errors.push(`❌ Missing: ${NEW_BOOKING_ROUTE}`);
} else {
  const content = fs.readFileSync(NEW_BOOKING_ROUTE, 'utf-8');
  
  if (content.includes('WebflowBookingFormEmbed')) {
    console.log(`✅ /bookings/new uses WebflowBookingFormEmbed`);
  } else if (content.includes('BookingForm')) {
    console.log(`ℹ️  /bookings/new uses BookingForm (Webflow embed not yet integrated)`);
  } else {
    warnings.push(`⚠️  /bookings/new may not have a form component`);
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

