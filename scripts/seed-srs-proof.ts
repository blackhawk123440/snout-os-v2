/**
 * SRS Proof Seed Script
 * 
 * Creates seeded data for SRS system proof:
 * - Sitter A (fast responses) → High responsiveness
 * - Sitter B (slow responses) → Low responsiveness  
 * - Sitter C (<15 visits) → Provisional
 * - OfferEvents (accepts/declines)
 * - VisitEvents (late/missed + penalties)
 * - TimeOff for exclusions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSRSProof() {
  console.log('🌱 Seeding SRS proof data...');

  // Get orgId from existing data
  const thread = await (prisma as any).messageThread.findFirst({
    select: { orgId: true },
  });
  if (!thread?.orgId) {
    // Try from AssignmentWindow
    const window = await (prisma as any).assignmentWindow.findFirst({
      select: { orgId: true },
    });
    if (!window?.orgId) {
      throw new Error('No organization found. Please create a thread or assignment window first.');
    }
    var orgId = window.orgId;
  } else {
    var orgId = thread.orgId;
  }
  console.log(`✓ Using org: ${orgId}`);

  // Create or get sitters
  let sitterA = await (prisma as any).sitter.findFirst({
    where: { email: 'sitter-a-fast@example.com' },
  });
  if (!sitterA) {
    sitterA = await (prisma as any).sitter.create({
      data: {
        firstName: 'Fast',
        lastName: 'Responder',
        email: 'sitter-a-fast@example.com',
        phone: '+15551111111',
        active: true,
      },
    });
  }

  let sitterB = await (prisma as any).sitter.findFirst({
    where: { email: 'sitter-b-slow@example.com' },
  });
  if (!sitterB) {
    sitterB = await (prisma as any).sitter.create({
      data: {
        firstName: 'Slow',
        lastName: 'Responder',
        email: 'sitter-b-slow@example.com',
        phone: '+15552222222',
        active: true,
      },
    });
  }

  let sitterC = await (prisma as any).sitter.findFirst({
    where: { email: 'sitter-c-low-activity@example.com' },
  });
  if (!sitterC) {
    sitterC = await (prisma as any).sitter.create({
      data: {
        firstName: 'Low',
        lastName: 'Activity',
        email: 'sitter-c-low-activity@example.com',
        phone: '+15553333333',
        active: true,
      },
    });
  }

  console.log(`✓ Created/found sitters: A=${sitterA.id}, B=${sitterB.id}, C=${sitterC.id}`);

  // Create threads for each sitter
  const threadA = await (prisma as any).messageThread.findFirst({
    where: { assignedSitterId: sitterA.id },
  }) || await (prisma as any).messageThread.create({
    data: {
      orgId,
      scope: 'client_booking',
      assignedSitterId: sitterA.id,
      status: 'open',
    },
  });

  const threadB = await (prisma as any).messageThread.findFirst({
    where: { assignedSitterId: sitterB.id },
  }) || await (prisma as any).messageThread.create({
    data: {
      orgId,
      scope: 'client_booking',
      assignedSitterId: sitterB.id,
      status: 'open',
    },
  });

  const threadC = await (prisma as any).messageThread.findFirst({
    where: { assignedSitterId: sitterC.id },
  }) || await (prisma as any).messageThread.create({
    data: {
      orgId,
      scope: 'client_booking',
      assignedSitterId: sitterC.id,
      status: 'open',
    },
  });

  console.log(`✓ Created/found threads: A=${threadA.id}, B=${threadB.id}, C=${threadC.id}`);

  // Create assignment windows (active now for A and B)
  const now = new Date();
  const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

  // Check if windows exist (AssignmentWindow doesn't have unique constraint, so check by thread+sitter)
  const existingWindowA = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      threadId: threadA.id,
      sitterId: sitterA.id,
      startAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // Within last 24h
    },
  });

  // Create bookings first (needed for assignment windows)
  const bookingA = await (prisma as any).booking.create({
    data: {
      firstName: 'Client',
      lastName: 'A',
      phone: '+15554444444',
      service: 'drop-in',
      startAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      totalPrice: 50,
      status: 'confirmed',
      sitterId: sitterA.id,
    },
  });

  const bookingB = await (prisma as any).booking.create({
    data: {
      firstName: 'Client',
      lastName: 'B',
      phone: '+15555555555',
      service: 'drop-in',
      startAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      endAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      totalPrice: 50,
      status: 'confirmed',
      sitterId: sitterB.id,
    },
  });

  const bookingC = await (prisma as any).booking.create({
    data: {
      firstName: 'Client',
      lastName: 'C',
      phone: '+15556666666',
      service: 'drop-in',
      startAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      totalPrice: 50,
      status: 'confirmed',
      sitterId: sitterC.id,
    },
  });

  console.log('✓ Created bookings');

  // Create assignment windows (active now for A and B)
  const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

  // Check if windows exist
  const existingWindowA = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      threadId: threadA.id,
      sitterId: sitterA.id,
      startAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  let windowA;
  if (!existingWindowA) {
    windowA = await (prisma as any).assignmentWindow.create({
      data: {
        orgId,
        threadId: threadA.id,
        bookingId: bookingA.id,
        sitterId: sitterA.id,
        startAt: windowStart,
        endAt: windowEnd,
        status: 'active',
      },
    });
  } else {
    windowA = existingWindowA;
  }

  const existingWindowB = await (prisma as any).assignmentWindow.findFirst({
    where: {
      orgId,
      threadId: threadB.id,
      sitterId: sitterB.id,
      startAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  let windowB;
  if (!existingWindowB) {
    windowB = await (prisma as any).assignmentWindow.create({
      data: {
        orgId,
        threadId: threadB.id,
        bookingId: bookingB.id,
        sitterId: sitterB.id,
        startAt: windowStart,
        endAt: windowEnd,
        status: 'active',
      },
    });
  } else {
    windowB = existingWindowB;
  }

  console.log('✓ Created assignment windows');

  // Sitter A: Fast responses (5 minutes)
  const messagesA = [];
  for (let i = 0; i < 10; i++) {
    const clientMsgTime = new Date(now.getTime() - (10 - i) * 60 * 60 * 1000);
    const sitterResponseTime = new Date(clientMsgTime.getTime() + 5 * 60 * 1000); // 5 min later

    // Client message requiring response
    const clientMsg = await (prisma as any).messageEvent.create({
      data: {
        orgId,
        threadId: threadA.id,
        direction: 'inbound',
        actorType: 'client',
        body: `Question ${i + 1}`,
        requiresResponse: true,
        createdAt: clientMsgTime,
      },
    });

    // Sitter response (fast - 5 minutes)
    const sitterMsg = await (prisma as any).messageEvent.create({
      data: {
        orgId,
        threadId: threadA.id,
        direction: 'outbound',
        actorType: 'sitter',
        body: `Response ${i + 1}`,
        createdAt: sitterResponseTime,
      },
    });

    // Link response
    await (prisma as any).messageResponseLink.create({
      data: {
        orgId,
        threadId: threadA.id,
        requiresResponseEventId: clientMsg.id,
        responseEventId: sitterMsg.id,
        responseMinutes: 5,
        withinAssignmentWindow: true,
        excluded: false,
      },
    });

    messagesA.push({ client: clientMsg.id, sitter: sitterMsg.id });
  }

  console.log(`✓ Created ${messagesA.length} fast response pairs for Sitter A`);

  // Sitter B: Slow responses (2 hours)
  const messagesB = [];
  for (let i = 0; i < 10; i++) {
    const clientMsgTime = new Date(now.getTime() - (10 - i) * 60 * 60 * 1000);
    const sitterResponseTime = new Date(clientMsgTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

    const clientMsg = await (prisma as any).messageEvent.create({
      data: {
        orgId,
        threadId: threadB.id,
        direction: 'inbound',
        actorType: 'client',
        body: `Question ${i + 1}`,
        requiresResponse: true,
        createdAt: clientMsgTime,
      },
    });

    const sitterMsg = await (prisma as any).messageEvent.create({
      data: {
        orgId,
        threadId: threadB.id,
        direction: 'outbound',
        actorType: 'sitter',
        body: `Response ${i + 1}`,
        createdAt: sitterResponseTime,
      },
    });

    await (prisma as any).messageResponseLink.create({
      data: {
        orgId,
        threadId: threadB.id,
        requiresResponseEventId: clientMsg.id,
        responseEventId: sitterMsg.id,
        responseMinutes: 120,
        withinAssignmentWindow: true,
        excluded: false,
      },
    });

    messagesB.push({ client: clientMsg.id, sitter: sitterMsg.id });
  }

  console.log(`✓ Created ${messagesB.length} slow response pairs for Sitter B`);

  // Create OfferEvents
  // Sitter A: High acceptance (9/10)
  for (let i = 0; i < 10; i++) {
    const offerTime = new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000);
    const accepted = i < 9; // 9 out of 10 accepted

    await (prisma as any).offerEvent.create({
      data: {
        orgId,
        sitterId: sitterA.id,
        bookingId: bookingA.id,
        threadId: threadA.id,
        offeredAt: offerTime,
        acceptedAt: accepted ? new Date(offerTime.getTime() + 30 * 60 * 1000) : null,
        declinedAt: accepted ? null : new Date(offerTime.getTime() + 60 * 60 * 1000),
        declineReason: accepted ? null : 'unavailable',
        withinAvailability: true,
        leadTimeValid: true,
        routingValid: true,
        excluded: false,
      },
    });
  }

  // Sitter B: Low acceptance (5/10)
  for (let i = 0; i < 10; i++) {
    const offerTime = new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000);
    const accepted = i < 5; // 5 out of 10 accepted

    await (prisma as any).offerEvent.create({
      data: {
        orgId,
        sitterId: sitterB.id,
        bookingId: bookingB.id,
        threadId: threadB.id,
        offeredAt: offerTime,
        acceptedAt: accepted ? new Date(offerTime.getTime() + 2 * 60 * 60 * 1000) : null,
        declinedAt: accepted ? null : new Date(offerTime.getTime() + 4 * 60 * 60 * 1000),
        declineReason: accepted ? null : 'declined',
        withinAvailability: true,
        leadTimeValid: true,
        routingValid: true,
        excluded: false,
      },
    });
  }

  console.log('✓ Created OfferEvents');

  // Create VisitEvents
  // Sitter A: On-time, high accuracy (20 visits)
  for (let i = 0; i < 20; i++) {
    const visitTime = new Date(now.getTime() - (20 - i) * 24 * 60 * 60 * 1000);
    const scheduledStart = visitTime;
    const scheduledEnd = new Date(visitTime.getTime() + 2 * 60 * 60 * 1000);
    const checkIn = new Date(scheduledStart.getTime() + 2 * 60 * 1000); // 2 min late (still on-time)

    await (prisma as any).visitEvent.create({
      data: {
        orgId,
        sitterId: sitterA.id,
        bookingId: bookingA.id,
        threadId: threadA.id,
        scheduledStart,
        scheduledEnd,
        checkInAt: checkIn,
        checkOutAt: new Date(scheduledEnd.getTime() - 5 * 60 * 1000),
        status: 'completed',
        lateMinutes: 2,
        checklistMissedCount: 0,
        mediaMissingCount: 0,
        complaintVerified: false,
        safetyFlag: false,
        excluded: false,
      },
    });
  }

  // Sitter B: Late, some accuracy issues (15 visits)
  for (let i = 0; i < 15; i++) {
    const visitTime = new Date(now.getTime() - (15 - i) * 24 * 60 * 60 * 1000);
    const scheduledStart = visitTime;
    const scheduledEnd = new Date(visitTime.getTime() + 2 * 60 * 60 * 1000);
    const checkIn = new Date(scheduledStart.getTime() + 30 * 60 * 1000); // 30 min late
    const hasIssues = i % 3 === 0; // Every 3rd visit has issues

    await (prisma as any).visitEvent.create({
      data: {
        orgId,
        sitterId: sitterB.id,
        bookingId: bookingB.id,
        threadId: threadB.id,
        scheduledStart,
        scheduledEnd,
        checkInAt: checkIn,
        checkOutAt: new Date(scheduledEnd.getTime() - 10 * 60 * 1000),
        status: 'completed',
        lateMinutes: 30,
        checklistMissedCount: hasIssues ? 2 : 0,
        mediaMissingCount: hasIssues ? 1 : 0,
        complaintVerified: i === 5, // One complaint
        safetyFlag: false,
        excluded: false,
      },
    });
  }

  // Sitter C: Low activity (8 visits - provisional)
  for (let i = 0; i < 8; i++) {
    const visitTime = new Date(now.getTime() - (8 - i) * 24 * 60 * 60 * 1000);
    const scheduledStart = visitTime;
    const scheduledEnd = new Date(visitTime.getTime() + 2 * 60 * 60 * 1000);

    await (prisma as any).visitEvent.create({
      data: {
        orgId,
        sitterId: sitterC.id,
        bookingId: bookingC.id,
        threadId: threadC.id,
        scheduledStart,
        scheduledEnd,
        checkInAt: scheduledStart,
        checkOutAt: scheduledEnd,
        status: 'completed',
        lateMinutes: 0,
        checklistMissedCount: 0,
        mediaMissingCount: 0,
        complaintVerified: false,
        safetyFlag: false,
        excluded: false,
      },
    });
  }

  console.log('✓ Created VisitEvents');

  // Create TimeOff for Sitter B (to prove exclusions)
  const timeOffStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const timeOffEnd = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  await (prisma as any).sitterTimeOff.create({
    data: {
      orgId,
      sitterId: sitterB.id,
      type: 'pto',
      startsAt: timeOffStart,
      endsAt: timeOffEnd,
      approvedByUserId: 'system',
    },
  });

  // Exclude responses during time off
  await (prisma as any).messageResponseLink.updateMany({
    where: {
      orgId,
      thread: { assignedSitterId: sitterB.id },
      requiresResponseEvent: {
        createdAt: {
          gte: timeOffStart,
          lte: timeOffEnd,
        },
      },
    },
    data: {
      excluded: true,
      excludedReason: 'Time off period',
    },
  });

  console.log('✓ Created TimeOff and excluded responses');

  // Create compensation records
  const compA = await (prisma as any).sitterCompensation.findUnique({
    where: { orgId_sitterId: { orgId, sitterId: sitterA.id } },
  });
  if (!compA) {
    await (prisma as any).sitterCompensation.create({
      data: {
        orgId,
        sitterId: sitterA.id,
        basePay: 12.50,
        nextReviewDate: new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const compB = await (prisma as any).sitterCompensation.findUnique({
    where: { orgId_sitterId: { orgId, sitterId: sitterB.id } },
  });
  if (!compB) {
    await (prisma as any).sitterCompensation.create({
      data: {
        orgId,
        sitterId: sitterB.id,
        basePay: 12.50,
        nextReviewDate: new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const compC = await (prisma as any).sitterCompensation.findUnique({
    where: { orgId_sitterId: { orgId, sitterId: sitterC.id } },
  });
  if (!compC) {
    await (prisma as any).sitterCompensation.create({
      data: {
        orgId,
        sitterId: sitterC.id,
        basePay: 12.50,
        nextReviewDate: new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('✓ Created compensation records');

  console.log('\n✅ SRS proof data seeded successfully!');
  console.log('\nSummary:');
  console.log(`- Sitter A (Fast): ${sitterA.id} - Fast responses, high acceptance, on-time visits`);
  console.log(`- Sitter B (Slow): ${sitterB.id} - Slow responses, low acceptance, late visits`);
  console.log(`- Sitter C (Low Activity): ${sitterC.id} - Only 8 visits (provisional)`);
  console.log('\nNext steps:');
  console.log('1. Run snapshot: POST /api/ops/srs/run-snapshot');
  console.log('2. Check scores: GET /api/sitters/srs');
}

seedSRSProof()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
