/**
 * Verification Script: BookingSitterPool Table
 * 
 * Proves the BookingSitterPool table exists in the database.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    // Attempt to query the BookingSitterPool table
    const count = await prisma.bookingSitterPool.count();
    console.log('✅ BookingSitterPool table exists');
    console.log(`   Current records: ${count}`);
    return true;
  } catch (error: any) {
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('❌ BookingSitterPool table does NOT exist');
      console.error('   Migration has not been applied');
      return false;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verify()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });

