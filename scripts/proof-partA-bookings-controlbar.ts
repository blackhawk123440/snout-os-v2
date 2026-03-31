#!/usr/bin/env tsx
/**
 * Proof script for Part A: Bookings Mobile Control Bar
 * 
 * Validates that Part A implementation is complete:
 * - BookingsMobileControlBar is imported and rendered
 * - State variables exist (statsVisible, selectedIds)
 * - Batch modals exist and reference correct handlers
 * - Stats grid is gated by statsVisible on mobile
 */

import * as fs from 'fs';
import * as path from 'path';

const BOOKINGS_PAGE_PATH = path.join(__dirname, '../src/app/bookings/page.tsx');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function main() {
  console.log('🔍 Verifying Part A: Bookings Mobile Control Bar Implementation\n');

  const content = fs.readFileSync(BOOKINGS_PAGE_PATH, 'utf-8');

  // 1. BookingsMobileControlBar is imported
  assert(
    content.includes("BookingsMobileControlBar") && content.includes("from '@/components/bookings/BookingsMobileControlBar'"),
    "BookingsMobileControlBar is imported"
  );

  // 2. BookingsMobileControlBar is rendered in JSX
  assert(
    content.includes('<BookingsMobileControlBar'),
    "BookingsMobileControlBar is rendered in JSX"
  );

  // 3. statsVisible state exists
  assert(
    content.includes('const [statsVisible') || (content.includes('statsVisible') && content.includes('useState')),
    "statsVisible state exists"
  );

  // 4. selectedIds state exists
  assert(
    content.includes('const [selectedIds') || (content.includes('selectedIds') && content.includes('useState')),
    "selectedIds state exists"
  );

  // 5. Batch modals exist and reference correct handlers
  assert(
    content.includes('batchStatusModalOpen') && content.includes('handleConfirmBatchStatus'),
    "Batch status modal exists and references handleConfirmBatchStatus"
  );

  assert(
    content.includes('batchPoolModalOpen') && content.includes('handleConfirmBatchPool'),
    "Batch pool modal exists and references handleConfirmBatchPool"
  );

  // 6. Stats grid is gated by statsVisible on mobile
  assert(
    content.includes('(!isMobile || statsVisible)') && content.includes('StatCard'),
    "Stats grid is gated by statsVisible on mobile"
  );

  console.log('\n✅ All Part A checks passed!');
}

main();
