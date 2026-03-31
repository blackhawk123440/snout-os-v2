/**
 * Seed Messaging Proof Scenarios
 * 
 * Creates deterministic demo data for proof pack:
 * - 1 unread thread (ownerUnreadCount > 0)
 * - 1 thread with failed delivery message (shows Retry button)
 * - 1 thread with policy violation (shows banner)
 * - 1 thread with active assignment window (shows "Active" indicator)
 * - 1 quarantined number (for Restore Now testing)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding messaging proof scenarios...');

  // Get or create org
  let org = await prisma.organization.findFirst({
    where: { name: 'Demo Pet Care Business' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Demo Pet Care Business' },
    });
  }

  // Get owner user
  const owner = await prisma.user.findFirst({
    where: { email: 'leah2maria@gmail.com', orgId: org.id },
  });

  if (!owner) {
    console.error('❌ Owner user not found. Please create owner user first.');
    process.exit(1);
  }

  // Get or create sitter
  let sitter = await prisma.sitter.findFirst({
    where: { orgId: org.id },
  });

  if (!sitter) {
    sitter = await prisma.sitter.create({
      data: {
        orgId: org.id,
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+15551234567',
        email: 'sarah@example.com',
        active: true,
      },
    });
  }

  // Get or create clients
  const client1 = await prisma.client.findFirst({
    where: { orgId: org.id, name: 'Demo Client 1' },
  }) || await prisma.client.create({
    data: {
      orgId: org.id,
      name: 'Demo Client 1',
    },
  });

  const client2 = await prisma.client.findFirst({
    where: { orgId: org.id, name: 'Demo Client 2' },
  }) || await prisma.client.create({
    data: {
      orgId: org.id,
      name: 'Demo Client 2',
    },
  });

  const client3 = await prisma.client.findFirst({
    where: { orgId: org.id, name: 'Demo Client 3' },
  }) || await prisma.client.create({
    data: {
      orgId: org.id,
      name: 'Demo Client 3',
    },
  });

  // Get or create front desk number
  let frontDeskNumber = await prisma.messageNumber.findFirst({
    where: { orgId: org.id, numberClass: 'front_desk', status: 'active' },
  });

  if (!frontDeskNumber) {
    frontDeskNumber = await prisma.messageNumber.create({
      data: {
        orgId: org.id,
        e164: '+15559876543',
        numberClass: 'front_desk',
        status: 'active',
        provider: 'twilio',
        providerNumberSid: 'PN_DEMO_FRONT_DESK',
      },
    });
  }

  // Get or create pool number
  let poolNumber = await prisma.messageNumber.findFirst({
    where: { orgId: org.id, numberClass: 'pool', status: 'active' },
  });

  if (!poolNumber) {
    poolNumber = await prisma.messageNumber.create({
      data: {
        orgId: org.id,
        e164: '+15559876544',
        numberClass: 'pool',
        status: 'active',
        provider: 'twilio',
        providerNumberSid: 'PN_DEMO_POOL',
      },
    });
  }

  // Create quarantined number
  let quarantinedNumber = await prisma.messageNumber.findFirst({
    where: { orgId: org.id, status: 'quarantined' },
  });

  if (!quarantinedNumber) {
    quarantinedNumber = await prisma.messageNumber.create({
      data: {
        orgId: org.id,
        e164: '+15559876545',
        numberClass: 'pool',
        status: 'quarantined',
        provider: 'twilio',
        providerNumberSid: 'PN_DEMO_QUARANTINED',
      },
    });
  }

  // ============================================
  // Scenario 1: Unread Thread
  // ============================================
  let unreadThread = await prisma.messageThread.findFirst({
    where: { orgId: org.id, clientId: client1.id },
  });

  if (!unreadThread) {
    unreadThread = await prisma.messageThread.create({
      data: {
        orgId: org.id,
        scope: 'client_booking',
        clientId: client1.id,
        messageNumberId: poolNumber.id,
        numberClass: 'pool',
        status: 'open',
        ownerUnreadCount: 2, // Unread!
        lastMessageAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Create participants
    await prisma.messageParticipant.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        role: 'client',
        clientId: client1.id,
        displayName: 'Demo Client 1',
        realE164: '+15551234567',
      },
    });

    await prisma.messageParticipant.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        role: 'owner',
        userId: owner.id,
        displayName: 'Owner',
        realE164: '+15559876543',
      },
    });

    // Create unread messages
    const message1 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        direction: 'inbound',
        actorType: 'client',
        actorClientId: client1.id,
        body: 'Hello, I need help with my pet.',
        deliveryStatus: 'delivered',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    const message2 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        direction: 'inbound',
        actorType: 'client',
        actorClientId: client1.id,
        body: 'Can someone call me back?',
        deliveryStatus: 'delivered',
        createdAt: new Date(Date.now() - 1800000), // 30 min ago
      },
    });

    console.log('✅ Created unread thread:', unreadThread.id);
  } else {
    // Update to have unread count
    await prisma.messageThread.update({
      where: { id: unreadThread.id },
      data: { ownerUnreadCount: 2 },
    });
    console.log('✅ Updated thread to have unread count:', unreadThread.id);
  }

  // ============================================
  // Scenario 2: Failed Delivery Message
  // ============================================
  let failedDeliveryThread = await prisma.messageThread.findFirst({
    where: { orgId: org.id, clientId: client2.id },
  });

  if (!failedDeliveryThread) {
    failedDeliveryThread = await prisma.messageThread.create({
      data: {
        orgId: org.id,
        scope: 'client_booking',
        clientId: client2.id,
        messageNumberId: frontDeskNumber.id,
        numberClass: 'front_desk',
        status: 'open',
        ownerUnreadCount: 0,
        lastMessageAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    await prisma.messageParticipant.create({
      data: {
        orgId: org.id,
        threadId: failedDeliveryThread.id,
        role: 'client',
        clientId: client2.id,
        displayName: 'Demo Client 2',
        realE164: '+15551234568',
      },
    });

    await prisma.messageParticipant.create({
      data: {
        orgId: org.id,
        threadId: failedDeliveryThread.id,
        role: 'owner',
        userId: owner.id,
        displayName: 'Owner',
        realE164: '+15559876543',
      },
    });
  }

  // Create a failed delivery message
  const failedMessage = await prisma.messageEvent.create({
    data: {
      orgId: org.id,
      threadId: failedDeliveryThread.id,
      direction: 'outbound',
      actorType: 'owner',
      actorUserId: owner.id,
      body: 'This message failed to deliver',
      deliveryStatus: 'failed',
      failureCode: '21211',
      failureDetail: 'Invalid phone number',
      createdAt: new Date(Date.now() - 7200000), // 2 hours ago
    },
  });

  console.log('✅ Created failed delivery message:', failedMessage.id);

  // ============================================
  // Scenario 3: Policy Violation Message
  // ============================================
  let policyViolationThread = await prisma.messageThread.findFirst({
    where: { orgId: org.id, clientId: client3.id },
  });

  if (!policyViolationThread) {
    policyViolationThread = await prisma.messageThread.create({
      data: {
        orgId: org.id,
        scope: 'client_booking',
        clientId: client3.id,
        messageNumberId: poolNumber.id,
        numberClass: 'pool',
        status: 'open',
        ownerUnreadCount: 1,
        lastMessageAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    await prisma.messageParticipant.create({
      data: {
        orgId: org.id,
        threadId: policyViolationThread.id,
        role: 'client',
        clientId: client3.id,
        displayName: 'Demo Client 3',
        realE164: '+15551234569',
      },
    });

    await prisma.messageParticipant.create({
      data: {
        orgId: org.id,
        threadId: policyViolationThread.id,
        role: 'owner',
        userId: owner.id,
        displayName: 'Owner',
        realE164: '+15559876543',
      },
    });
  }

  // Create policy violation message
  // Note: Policy violations are detected by the system and stored in metadataJson
  // For demo purposes, we'll mark the message with metadata indicating a violation
  const violationMessage = await prisma.messageEvent.create({
    data: {
      orgId: org.id,
      threadId: policyViolationThread.id,
      direction: 'inbound',
      actorType: 'client',
      actorClientId: client3.id,
      body: 'Call me at 555-123-4567 or email me at test@example.com',
      deliveryStatus: 'delivered',
      metadataJson: JSON.stringify({
        hasPolicyViolation: true,
        violationType: 'other',
        detectedSummary: 'Message contains phone number and email address',
        actionTaken: 'redacted',
        redactedBody: 'Call me at [REDACTED] or email me at [REDACTED]',
      }),
      createdAt: new Date(Date.now() - 5400000), // 1.5 hours ago
    },
  });

  console.log('✅ Created policy violation message:', violationMessage.id);

  // ============================================
  // Scenario 4: Active Assignment Window
  // ============================================
  const now = new Date();
  const startsAt = new Date(now.getTime() - 86400000); // Started 1 day ago
  const endsAt = new Date(now.getTime() + 86400000); // Ends in 1 day

  const existingWindow = await prisma.assignmentWindow.findFirst({
    where: {
      orgId: org.id,
      threadId: unreadThread.id,
      sitterId: sitter.id,
    },
  });

  if (!existingWindow) {
    await prisma.assignmentWindow.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        sitterId: sitter.id,
        startsAt,
        endsAt,
        status: 'active',
      },
    });

    // Update thread to have sitter
    await prisma.messageThread.update({
      where: { id: unreadThread.id },
      data: { assignedSitterId: sitter.id },
    });

    console.log('✅ Created active assignment window');
  } else {
    // Update existing window to be active
    await prisma.assignmentWindow.update({
      where: { id: existingWindow.id },
      data: { startsAt, endsAt, status: 'active' },
    });
    console.log('✅ Updated assignment window to be active');
  }

  console.log('\n✅ Proof scenarios seeded successfully!');
  console.log('\nSummary:');
  console.log(`- Unread thread: ${unreadThread.id}`);
  console.log(`- Failed delivery thread: ${failedDeliveryThread.id}`);
  console.log(`- Policy violation thread: ${policyViolationThread.id}`);
  console.log(`- Active assignment window: ${sitter.firstName} ${sitter.lastName} -> ${unreadThread.id}`);
  console.log(`- Quarantined number: ${quarantinedNumber.e164}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
