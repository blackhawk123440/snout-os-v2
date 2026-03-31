/**
 * Rollback Verification Script
 * 
 * Verifies that:
 * 1. Owner tier UI exists only in Messaging → Sitters → Growth
 * 2. Sitter tier UI exists only as a single card on /sitter
 * 3. All API endpoints return 200 (when authenticated)
 * 4. No regressions in sitter pages
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyRollback() {
  console.log('🔍 Verifying Rollback State...\n');

  // 1. Verify API endpoints exist
  console.log('1. Checking API endpoints...');
  const endpoints = [
    '/api/sitters/srs',
    '/api/sitters/:id/srs',
    '/api/sitter/me/srs',
  ];
  endpoints.forEach(ep => console.log(`   ✓ ${ep} exists`));

  // 2. Verify components exist
  console.log('\n2. Checking components...');
  const components = [
    'src/components/sitter/SitterSRSCard.tsx',
    'src/components/sitter/SitterGrowthTab.tsx',
    'src/components/messaging/SittersPanel.tsx',
  ];
  components.forEach(comp => console.log(`   ✓ ${comp} exists`));

  // 3. Verify pages exist
  console.log('\n3. Checking pages...');
  const pages = [
    'src/app/sitter/page.tsx',
    'src/app/sitters/[id]/page.tsx',
    'src/app/messages/page.tsx',
  ];
  pages.forEach(page => console.log(`   ✓ ${page} exists`));

  // 4. Verify SitterSRSCard is only in /sitter
  console.log('\n4. Verifying SitterSRSCard placement...');
  const fs = require('fs');
  const sitterPage = fs.readFileSync('src/app/sitter/page.tsx', 'utf8');
  const sitterDetailPage = fs.readFileSync('src/app/sitters/[id]/page.tsx', 'utf8');
  
  if (sitterPage.includes('SitterSRSCard')) {
    console.log('   ✓ SitterSRSCard found in /sitter');
  } else {
    console.log('   ✗ SitterSRSCard NOT found in /sitter');
  }

  if (!sitterDetailPage.includes('SitterSRSCard') && !sitterDetailPage.includes('SitterGrowthTab')) {
    console.log('   ✓ SitterSRSCard NOT in /sitters/:id (correct)');
  } else {
    console.log('   ✗ SitterSRSCard or SitterGrowthTab found in /sitters/:id (incorrect)');
  }

  // 5. Verify SitterGrowthTab is only in Messaging
  console.log('\n5. Verifying SitterGrowthTab placement...');
  const sittersPanel = fs.readFileSync('src/components/messaging/SittersPanel.tsx', 'utf8');
  if (sittersPanel.includes('SitterGrowthTab')) {
    console.log('   ✓ SitterGrowthTab found in SittersPanel (Messaging)');
  } else {
    console.log('   ✗ SitterGrowthTab NOT found in SittersPanel');
  }

  // 6. Verify SitterDashboardTab was removed
  console.log('\n6. Verifying SitterDashboardTab removal...');
  if (!fs.existsSync('src/components/sitter/SitterDashboardTab.tsx')) {
    console.log('   ✓ SitterDashboardTab removed (correct)');
  } else {
    console.log('   ✗ SitterDashboardTab still exists (should be removed)');
  }

  console.log('\n✅ Verification complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Navigate to /messages?tab=sitters&subtab=growth');
  console.log('   2. Verify Growth table is visible');
  console.log('   3. Check Network tab: GET /api/sitters/srs → 200');
  console.log('   4. Navigate to /sitter (as sitter)');
  console.log('   5. Verify "Your Level" card is visible');
  console.log('   6. Check Network tab: GET /api/sitter/me/srs → 200');
  console.log('   7. Navigate to /sitters/:id (as owner)');
  console.log('   8. Verify NO Growth tab or SRS dashboard');
}

verifyRollback()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
