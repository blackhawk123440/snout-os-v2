/**
 * Seed Sitter Dashboard Data
 * 
 * Creates deterministic test data for sitter dashboard:
 * - 1 sitter user linked to sitter record
 * - At least 1 pending request
 * - At least 1 upcoming booking
 * - At least 1 completed booking
 * - SRS snapshot exists (so tier is non-empty)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSitterDashboard() {
  console.log('🌱 Seeding sitter dashboard data...');

  // Get or create org
  let org = await (prisma as any).organization.findFirst();
  if (!org) {
    org = await (prisma as any).organization.create({
      data: {
        id: 'seed-org-1',
        name: 'Test Organization',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log('✅ Created organization');
  }

  const orgId = org.id;

  // Get or create sitter user
  let sitterUser = await (prisma as any).user.findFirst({
    where: { email: 'sitter@test.com' },
  });

  if (!sitterUser) {
    sitterUser = await (prisma as any).user.create({
      data: {
        email: 'sitter@test.com',
        name: 'Test Sitter',
        emailVerified: new Date(),
      },
    });
    console.log('✅ Created sitter user');
  }

  // Get or create sitter record
  let sitter = await (prisma as any).sitter.findFirst({
    where: { userId: sitterUser.id },
  });

  if (!sitter) {
    sitter = await (prisma as any).sitter.create({
      data: {
        userId: sitterUser.id,
        firstName: 'Test',
        lastName: 'Sitter',
        phone: '+15551234567',
        email: 'sitter@test.com',
        active: true,
        isActive: true,
        commissionPercentage: 80,
      },
    });
    console.log('✅ Created sitter record');
  }

  const sitterId = sitter.id;

  // Get or create tier
  let tier = await (prisma as any).sitterTier.findFirst({
    where: { name: 'Foundation' },
  });

  if (!tier) {
    tier = await (prisma as any).sitterTier.create({
      data: {
        name: 'Foundation',
        priorityLevel: 1,
        badgeColor: '#6B7280',
        badgeStyle: 'default',
      },
    });
    console.log('✅ Created tier');
  }

  // Link sitter to tier
  await (prisma as any).sitter.update({
    where: { id: sitterId },
    data: { currentTierId: tier.id },
  });

  // Get or create client
  let client = await (prisma as any).client.findFirst({
    where: { email: 'client@test.com' },
  });

  if (!client) {
    client = await (prisma as any).client.create({
      data: {
        firstName: 'Test',
        lastName: 'Client',
        email: 'client@test.com',
        phone: '+15559876543',
      },
    });
    console.log('✅ Created client');
  }

  const clientId = client.id;

  // Create pending request (booking with active pool offer)
  const pendingBooking = await (prisma as any).booking.create({
    data: {
      firstName: 'Pending',
      lastName: 'Client',
      email: 'pending@test.com',
      phone: '+15551111111',
      address: '123 Test St',
      service: 'Drop-in Visit',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
      status: 'pending',
      totalPrice: 50.00,
    },
  });

  await (prisma as any).sitterPoolOffer.create({
    data: {
      bookingId: pendingBooking.id,
      sitterId: sitterId,
      status: 'active',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      responses: '[]',
    },
  });
  console.log('✅ Created pending request');

  // Create upcoming booking
  const upcomingBooking = await (prisma as any).booking.create({
    data: {
      firstName: 'Upcoming',
      lastName: 'Client',
      email: 'upcoming@test.com',
      phone: '+15552222222',
      address: '456 Test Ave',
      service: 'Drop-in Visit',
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      status: 'confirmed',
      sitterId: sitterId,
      totalPrice: 60.00,
    },
  });
  console.log('✅ Created upcoming booking');

  // Create completed booking
  const completedBooking = await (prisma as any).booking.create({
    data: {
      firstName: 'Completed',
      lastName: 'Client',
      email: 'completed@test.com',
      phone: '+15553333333',
      address: '789 Test Blvd',
      service: 'Drop-in Visit',
      startAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      status: 'completed',
      sitterId: sitterId,
      totalPrice: 70.00,
    },
  });
  console.log('✅ Created completed booking');

  // Create SRS snapshot
  const snapshot = await (prisma as any).sitterTierSnapshot.create({
    data: {
      orgId,
      sitterId,
      asOfDate: new Date(),
      tier: 'foundation',
      rolling30dScore: 75.5,
      rolling30dBreakdownJson: JSON.stringify({
        responsiveness: 18,
        acceptance: 10,
        completion: 7,
        timeliness: 15,
        accuracy: 18,
        engagement: 8,
        conduct: 10,
      }),
      rolling26wScore: 72.0,
      rolling26wBreakdownJson: JSON.stringify({
        responsiveness: 17,
        acceptance: 9,
        completion: 7,
        timeliness: 14,
        accuracy: 17,
        engagement: 7,
        conduct: 10,
      }),
      provisional: false,
      visits30d: 20,
      offers30d: 15,
      atRisk: false,
    },
  });
  console.log('✅ Created SRS snapshot');

  console.log('\n✅ Sitter dashboard seed complete!');
  console.log(`\nSitter ID: ${sitterId}`);
  console.log(`Sitter Email: sitter@test.com`);
  console.log(`Pending Booking: ${pendingBooking.id}`);
  console.log(`Upcoming Booking: ${upcomingBooking.id}`);
  console.log(`Completed Booking: ${completedBooking.id}`);
  console.log(`SRS Snapshot: ${snapshot.id}`);
}

seedSitterDashboard()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
