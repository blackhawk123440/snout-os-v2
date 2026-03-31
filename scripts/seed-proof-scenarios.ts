/**
 * Seed Proof Scenarios
 * 
 * Creates deterministic demo data for proof pack:
 * - 1 unread thread
 * - 1 failed delivery message (Retry visible)
 * - 1 policy violation message (banner visible)
 * - 1 active assignment window (sitter thread visible)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding proof scenarios...');

  // Get or create org
  let org = await prisma.organization.findFirst({
    where: { name: 'Demo Pet Care Business' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Demo Pet Care Business' },
    });
  }

  // Get owner
  const owner = await prisma.user.findFirst({
    where: { email: 'leah2maria@gmail.com', orgId: org.id },
  });

  if (!owner) {
    console.error('❌ Owner user not found. Run main seed first.');
    process.exit(1);
  }

  // Get or create sitter
  let sitter = await prisma.sitter.findFirst({
    where: { orgId: org.id, name: 'Sarah Johnson' },
  });

  if (!sitter) {
    sitter = await prisma.sitter.create({
      data: {
        orgId: org.id,
        name: 'Sarah Johnson',
        active: true,
      },
    });
  }

  // Get or create client
  let client = await prisma.client.findFirst({
    where: { orgId: org.id, name: 'Demo Client' },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        orgId: org.id,
        name: 'Demo Client',
      },
    });
  }

  // Create client contact
  let contact = await prisma.clientContact.findFirst({
    where: { clientId: client.id, e164: '+15551234567' },
  });

  if (!contact) {
    contact = await prisma.clientContact.create({
      data: {
        clientId: client.id,
        e164: '+15551234567',
        label: 'Mobile',
      },
    });
  }

  // Get or create front desk number
  let frontDeskNumber = await prisma.messageNumber.findFirst({
    where: { orgId: org.id, class: 'front_desk', status: 'active' },
  });

  if (!frontDeskNumber) {
    frontDeskNumber = await prisma.messageNumber.create({
      data: {
        orgId: org.id,
        e164: '+15559876543',
        class: 'front_desk',
        status: 'active',
        providerType: 'twilio',
        providerNumberSid: 'PN_DEMO_FRONT_DESK',
      },
    });
  }

  // Get or create pool number
  let poolNumber = await prisma.messageNumber.findFirst({
    where: { orgId: org.id, class: 'pool', status: 'active' },
  });

  if (!poolNumber) {
    poolNumber = await prisma.messageNumber.create({
      data: {
        orgId: org.id,
        e164: '+15559876544',
        class: 'pool',
        status: 'active',
        providerType: 'twilio',
        providerNumberSid: 'PN_DEMO_POOL',
      },
    });
  }

  // ============================================
  // Scenario 1: Unread Thread
  // ============================================
  let unreadThread = await prisma.thread.findFirst({
    where: { orgId: org.id, clientId: client.id },
  });

  if (!unreadThread) {
    unreadThread = await prisma.thread.create({
      data: {
        orgId: org.id,
        clientId: client.id,
        numberId: poolNumber.id,
        threadType: 'pool',
        status: 'active',
        ownerUnreadCount: 2, // Unread!
        lastActivityAt: new Date(),
      },
    });

    // Create unread messages
    await prisma.message.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        direction: 'inbound',
        senderType: 'client',
        senderId: client.id,
        body: 'Hello, I need help with my pet.',
        deliveryStatus: 'delivered',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    await prisma.message.create({
      data: {
        orgId: org.id,
        threadId: unreadThread.id,
        direction: 'inbound',
        senderType: 'client',
        senderId: client.id,
        body: 'Can someone call me back?',
        deliveryStatus: 'delivered',
        createdAt: new Date(Date.now() - 1800000), // 30 min ago
      },
    });

    console.log('✅ Created unread thread:', unreadThread.id);
  } else {
    // Update to have unread count
    await prisma.thread.update({
      where: { id: unreadThread.id },
      data: { ownerUnreadCount: 2 },
    });
    console.log('✅ Updated thread to have unread count:', unreadThread.id);
  }

  // ============================================
  // Scenario 2: Failed Delivery Message
  // ============================================
  let failedDeliveryThread = await prisma.thread.findFirst({
    where: { orgId: org.id, clientId: client.id },
    include: { messages: true },
  });

  if (!failedDeliveryThread || failedDeliveryThread.id === unreadThread.id) {
    // Create a new client for failed delivery thread
    const client2 = await prisma.client.create({
      data: {
        orgId: org.id,
        name: 'Failed Delivery Client',
      },
    });

    await prisma.clientContact.create({
      data: {
        clientId: client2.id,
        e164: '+15551234568',
        label: 'Mobile',
      },
    });

    failedDeliveryThread = await prisma.thread.create({
      data: {
        orgId: org.id,
        clientId: client2.id,
        numberId: frontDeskNumber.id,
        threadType: 'front_desk',
        status: 'active',
        ownerUnreadCount: 0,
        lastActivityAt: new Date(),
      },
    });
  }

  // Create a failed delivery message
  const failedMessage = await prisma.message.create({
    data: {
      orgId: org.id,
      threadId: failedDeliveryThread.id,
      direction: 'outbound',
      senderType: 'owner',
      senderId: owner.id,
      body: 'This message failed to deliver',
      deliveryStatus: 'failed',
      createdAt: new Date(Date.now() - 7200000), // 2 hours ago
    },
  });

  // Create delivery record showing failure
  await prisma.messageDelivery.create({
    data: {
      messageId: failedMessage.id,
      providerMessageSid: 'SM_FAILED_DEMO',
      status: 'failed',
      providerErrorMessage: 'Invalid phone number',
      providerErrorCode: '21211',
      attemptedAt: new Date(Date.now() - 7200000),
      deliveredAt: null,
    },
  });

  console.log('✅ Created failed delivery message:', failedMessage.id);

  // ============================================
  // Scenario 3: Policy Violation Message
  // ============================================
  let policyViolationThread = await prisma.thread.findFirst({
    where: { orgId: org.id },
    include: { messages: true },
  });

  // Find a different thread or create one
  if (!policyViolationThread || policyViolationThread.id === unreadThread.id || policyViolationThread.id === failedDeliveryThread.id) {
    const client3 = await prisma.client.create({
      data: {
        orgId: org.id,
        name: 'Policy Violation Client',
      },
    });

    await prisma.clientContact.create({
      data: {
        clientId: client3.id,
        e164: '+15551234569',
        label: 'Mobile',
      },
    });

    policyViolationThread = await prisma.thread.create({
      data: {
        orgId: org.id,
        clientId: client3.id,
        numberId: poolNumber.id,
        threadType: 'pool',
        status: 'active',
        ownerUnreadCount: 1,
        lastActivityAt: new Date(),
      },
    });
  }

  // Create policy violation message
  const violationMessage = await prisma.message.create({
    data: {
      orgId: org.id,
      threadId: policyViolationThread.id,
      direction: 'inbound',
      senderType: 'client',
      senderId: policyViolationThread.clientId,
      body: 'Call me at 555-123-4567 or email me at test@example.com',
      redactedBody: 'Call me at [REDACTED] or email me at [REDACTED]',
      deliveryStatus: 'delivered',
      hasPolicyViolation: true,
      createdAt: new Date(Date.now() - 5400000), // 1.5 hours ago
    },
  });

  // Create policy violation record
  await prisma.policyViolation.create({
    data: {
      orgId: org.id,
      threadId: policyViolationThread.id,
      messageId: violationMessage.id,
      violationType: 'other',
      detectedSummary: 'Message contains phone number and email address',
      actionTaken: 'redacted',
      status: 'open',
      detectedAt: new Date(Date.now() - 5400000),
    },
  });

  console.log('✅ Created policy violation message:', violationMessage.id);

  // ============================================
  // Scenario 4: Active Assignment Window
  // ============================================
  // Use the unread thread and assign it to sitter with active window
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
      },
    });

    // Update thread to have sitter
    await prisma.thread.update({
      where: { id: unreadThread.id },
      data: { sitterId: sitter.id },
    });

    console.log('✅ Created active assignment window');
  } else {
    // Update existing window to be active
    await prisma.assignmentWindow.update({
      where: { id: existingWindow.id },
      data: { startsAt, endsAt },
    });
    console.log('✅ Updated assignment window to be active');
  }

  console.log('\n✅ Proof scenarios seeded successfully!');
  console.log('\nSummary:');
  console.log(`- Unread thread: ${unreadThread.id}`);
  console.log(`- Failed delivery thread: ${failedDeliveryThread.id}`);
  console.log(`- Policy violation thread: ${policyViolationThread.id}`);
  console.log(`- Active assignment window: ${sitter.name} -> ${unreadThread.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
