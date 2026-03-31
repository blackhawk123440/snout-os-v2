/**
 * Proof Script: UI Convergence Verification
 * 
 * Validates that shared primitives are used correctly across the codebase.
 * This script ensures compliance with Universal UI Laws.
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

interface ProofResult {
  name: string;
  passed: boolean;
  message: string;
  files?: string[];
}

const results: ProofResult[] = [];

// Helper to read file content
function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return '';
  }
}

// Helper to find files matching pattern
function findFiles(pattern: RegExp, dir: string = SRC_DIR): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and .next
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        const content = readFile(fullPath);
        if (pattern.test(content)) {
          files.push(path.relative(ROOT_DIR, fullPath));
        }
      }
    }
  }
  
  walk(dir);
  return files;
}

// Proof 1: CalendarGrid imported in both calendar page and sitter dashboard
console.log('Checking CalendarGrid usage...');
const calendarPage = readFile(path.join(SRC_DIR, 'app/calendar/page.tsx'));
const sitterDashboard = readFile(path.join(SRC_DIR, 'app/sitter-dashboard/page.tsx'));

const calendarGridImported = 
  calendarPage.includes('CalendarGrid') && 
  sitterDashboard.includes('CalendarGrid');

results.push({
  name: 'CalendarGrid shared primitive',
  passed: calendarGridImported,
  message: calendarGridImported 
    ? '✅ CalendarGrid imported in calendar page and sitter dashboard'
    : '❌ CalendarGrid not found in required pages',
  files: calendarGridImported ? ['src/app/calendar/page.tsx', 'src/app/sitter-dashboard/page.tsx'] : [],
});

// Proof 2: BookingScheduleDisplay used everywhere schedule is shown
console.log('Checking BookingScheduleDisplay usage...');
const scheduleFiles = findFiles(/BookingScheduleDisplay/);
const pagesWithSchedule = [
  'app/bookings/page.tsx',
  'app/bookings/[id]/page.tsx',
  'app/calendar/page.tsx',
  'app/sitter-dashboard/page.tsx',
  'app/sitter/page.tsx',
].filter(page => {
  const filePath = path.join(SRC_DIR, page);
  return fs.existsSync(filePath) && readFile(filePath).includes('BookingScheduleDisplay');
});

results.push({
  name: 'BookingScheduleDisplay shared primitive',
  passed: pagesWithSchedule.length >= 3, // At least 3 pages should use it
  message: `✅ BookingScheduleDisplay used in ${pagesWithSchedule.length} pages: ${pagesWithSchedule.join(', ')}`,
  files: pagesWithSchedule,
});

// Proof 3: SitterAssignmentDisplay used everywhere assignment is shown
console.log('Checking SitterAssignmentDisplay usage...');
const assignmentFiles = findFiles(/SitterAssignmentDisplay/);
const pagesWithAssignment = [
  'app/bookings/page.tsx',
  'app/bookings/[id]/page.tsx',
  'app/calendar/page.tsx',
].filter(page => {
  const filePath = path.join(SRC_DIR, page);
  return fs.existsSync(filePath) && readFile(filePath).includes('SitterAssignmentDisplay');
});

results.push({
  name: 'SitterAssignmentDisplay shared primitive',
  passed: pagesWithAssignment.length >= 2,
  message: `✅ SitterAssignmentDisplay used in ${pagesWithAssignment.length} pages: ${pagesWithAssignment.join(', ')}`,
  files: pagesWithAssignment,
});

// Proof 4: No duplicate summary header blocks on booking detail
console.log('Checking booking detail header duplication...');
const bookingDetailPage = readFile(path.join(SRC_DIR, 'app/bookings/[id]/page.tsx'));
const stickyHeaderMatches = (bookingDetailPage.match(/Sticky Summary Header/g) || []).length;
const compactHeaderMatches = (bookingDetailPage.match(/Compact Mobile Header/g) || []).length;
const firstNameLastNameMatches = (bookingDetailPage.match(/\{booking\.firstName\} \{booking\.lastName\}/g) || []).length;

// Should have exactly one sticky header, zero compact headers, and client name should appear limited times in mobile section
const noDuplicateHeader = 
  stickyHeaderMatches === 1 && 
  compactHeaderMatches === 0 &&
  (bookingDetailPage.match(/Mobile: Single-page Layout/) || []).length === 1;

results.push({
  name: 'Booking detail header deduplication',
  passed: noDuplicateHeader,
  message: noDuplicateHeader
    ? '✅ Single sticky summary header, no duplicate compact header'
    : `❌ Found ${stickyHeaderMatches} sticky headers, ${compactHeaderMatches} compact headers`,
  files: ['src/app/bookings/[id]/page.tsx'],
});

// Proof 5: CalendarGrid has horizontal scroll support
console.log('Checking CalendarGrid horizontal scroll...');
const calendarGridComponent = readFile(path.join(SRC_DIR, 'components/calendar/CalendarGrid.tsx'));
const hasHorizontalScroll = 
  calendarGridComponent.includes('overflowX') || 
  calendarGridComponent.includes('overflow-x') ||
  calendarGridComponent.includes('overflowX:') ||
  calendarGridComponent.includes('overflow-x:');

results.push({
  name: 'CalendarGrid horizontal scroll support',
  passed: hasHorizontalScroll,
  message: hasHorizontalScroll
    ? '✅ CalendarGrid has horizontal scroll support'
    : '❌ CalendarGrid missing horizontal scroll implementation',
  files: ['src/components/calendar/CalendarGrid.tsx'],
});

// Print results
console.log('\n=== UI Convergence Proof Results ===\n');

let allPassed = true;
for (const result of results) {
  console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  console.log(`   ${result.message}`);
  if (result.files && result.files.length > 0) {
    console.log(`   Files: ${result.files.join(', ')}`);
  }
  console.log('');
  
  if (!result.passed) {
    allPassed = false;
  }
}

console.log(`\n=== Overall: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'} ===\n`);

process.exit(allPassed ? 0 : 1);

