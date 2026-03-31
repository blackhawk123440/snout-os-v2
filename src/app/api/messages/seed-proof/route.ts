/**
 * API Route: Seed Messaging Proof Scenarios
 *
 * Creates demo data for proof pack. Only available in dev/staging.
 *
 * IMPORTANT: This endpoint must work in serverless environments (Render, Vercel).
 * It directly calls the seed logic rather than executing a script.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';

export async function POST(request: NextRequest) {
  // Only allow in dev/staging
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_OPS_SEED) {
    return NextResponse.json(
      { error: 'Seed endpoint disabled in production' },
      { status: 403 }
    );
  }

  // Require owner authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user is owner (User model uses role field)
  const user = await (prisma as any).user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'owner') {
    return NextResponse.json(
      { error: 'Owner access required' },
      { status: 403 }
    );
  }

  try {
    // Import and run seed logic directly (works in serverless)
    const seedResult = await seedMessagingProof();

    return NextResponse.json({
      success: true,
      message: 'Proof scenarios seeded successfully',
      summary: seedResult,
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed proof scenarios',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Seed messaging proof scenarios
 * This is the same logic as scripts/seed-messaging-proof.ts but callable from API route
 */
async function seedMessagingProof() {
  console.log('Seeding messaging proof scenarios...');

  // Get or create org (Organization model in enterprise-messaging-dashboard schema)
  let org = await (prisma as any).organization.findFirst({
    where: { name: 'Demo Pet Care Business' },
  });

  if (!org) {
    org = await (prisma as any).organization.create({
      data: { name: 'Demo Pet Care Business' },
    });
  }

  // Create a scoped db for this org
  const db = getScopedDb({ orgId: org.id });

  // Get owner user (User model has orgId in enterprise-messaging-dashboard schema)
  const owner = await (prisma as any).user.findFirst({
    where: { email: 'leah2maria@gmail.com', orgId: org.id },
  });

  if (!owner) {
    throw new Error('Owner user not found. Please create owner user first.');
  }

  // Get or create sitter (Sitter model uses 'name' not firstName/lastName)
  let sitter = await (db as any).sitter.findFirst({
    where: {},
  });

  if (!sitter) {
    sitter = await (db as any).sitter.create({
      data: {
        name: 'Sarah Johnson',
        active: true,
      },
    });
  }

  // Get or create clients (Client model has orgId in enterprise-messaging-dashboard schema)
  const client1 = await (db as any).client.findFirst({
    where: { name: 'Demo Client 1' },
  }) || await (db as any).client.create({
    data: {
      name: 'Demo Client 1',
    },
  });

  const client2 = await (db as any).client.findFirst({
    where: { name: 'Demo Client 2' },
  }) || await (db as any).client.create({
    data: {
      name: 'Demo Client 2',
    },
  });

  const client3 = await (db as any).client.findFirst({
    where: { name: 'Demo Client 3' },
  }) || await (db as any).client.create({
    data: {
      name: 'Demo Client 3',
    },
  });

  // Get or create front desk number (MessageNumber uses 'class' not 'numberClass', 'providerType' not 'provider')
  let frontDeskNumber = await (db as any).messageNumber.findFirst({
    where: { class: 'front_desk', status: 'active' },
  });

  if (!frontDeskNumber) {
    frontDeskNumber = await (db as any).messageNumber.create({
      data: {
        e164: '+15559876543',
        class: 'front_desk',
        status: 'active',
        providerType: 'twilio',
        providerNumberSid: 'PN_DEMO_FRONT_DESK',
      },
    });
  }

  // Get or create pool number
  let poolNumber = await (db as any).messageNumber.findFirst({
    where: { class: 'pool', status: 'active' },
  });

  if (!poolNumber) {
    poolNumber = await (db as any).messageNumber.create({
      data: {
        e164: '+15559876544',
        class: 'pool',
        status: 'active',
        providerType: 'twilio',
        providerNumberSid: 'PN_DEMO_POOL',
      },
    });
  }

  // Create quarantined number
  let quarantinedNumber = await (db as any).messageNumber.findFirst({
    where: { status: 'quarantined' },
  });

  if (!quarantinedNumber) {
    quarantinedNumber = await (db as any).messageNumber.create({
      data: {
        e164: '+15559876545',
        class: 'pool',
        status: 'quarantined',
        providerType: 'twilio',
        providerNumberSid: 'PN_DEMO_QUARANTINED',
      },
    });
  }

  // Scenario 1: Unread Thread (Thread model, not MessageThread)
  let unreadThread = await (db as any).thread.findFirst({
    where: { clientId: client1.id },
  });

  if (!unreadThread) {
    unreadThread = await (db as any).thread.create({
      data: {
        clientId: client1.id,
        numberId: poolNumber.id,
        threadType: 'pool',
        status: 'active',
        ownerUnreadCount: 2,
        lastActivityAt: new Date(),
      },
    });

    await (prisma as any).threadParticipant.create({
      data: {
        threadId: unreadThread.id,
        participantType: 'client',
        participantId: client1.id,
      },
    });

    await (prisma as any).threadParticipant.create({
      data: {
        threadId: unreadThread.id,
        participantType: 'owner',
        participantId: owner.id,
      },
    });

    await (db as any).message.create({
      data: {
        threadId: unreadThread.id,
        direction: 'inbound',
        senderType: 'client',
        senderId: client1.id,
        body: 'Hello, I need help with my pet.',
        createdAt: new Date(Date.now() - 3600000),
      },
    });

    await (db as any).message.create({
      data: {
        threadId: unreadThread.id,
        direction: 'inbound',
        senderType: 'client',
        senderId: client1.id,
        body: 'Can someone call me back?',
        createdAt: new Date(Date.now() - 1800000),
      },
    });
  } else {
    await (db as any).thread.update({
      where: { id: unreadThread.id },
      data: { ownerUnreadCount: 2 },
    });
  }

  // Scenario 2: Failed Delivery Message
  let failedDeliveryThread = await (db as any).thread.findFirst({
    where: { clientId: client2.id },
  });

  if (!failedDeliveryThread) {
    failedDeliveryThread = await (db as any).thread.create({
      data: {
        clientId: client2.id,
        numberId: frontDeskNumber.id,
        threadType: 'front_desk',
        status: 'active',
        ownerUnreadCount: 0,
        lastActivityAt: new Date(),
      },
    });

    await (prisma as any).threadParticipant.create({
      data: {
        threadId: failedDeliveryThread.id,
        participantType: 'client',
        participantId: client2.id,
      },
    });

    await (prisma as any).threadParticipant.create({
      data: {
        threadId: failedDeliveryThread.id,
        participantType: 'owner',
        participantId: owner.id,
      },
    });
  }

  const failedMessage = await (db as any).message.create({
    data: {
      threadId: failedDeliveryThread.id,
      direction: 'outbound',
      senderType: 'owner',
      senderId: owner.id,
      body: 'This message failed to deliver',
      createdAt: new Date(Date.now() - 7200000),
    },
  });

  // Create failed delivery record
  await (prisma as any).messageDelivery.create({
    data: {
      messageId: failedMessage.id,
      attemptNo: 1,
      status: 'failed',
      providerErrorCode: '21211',
      providerErrorMessage: 'Invalid phone number',
    },
  });

  // Scenario 3: Policy Violation Message
  let policyViolationThread = await (db as any).thread.findFirst({
    where: { clientId: client3.id },
  });

  if (!policyViolationThread) {
    policyViolationThread = await (db as any).thread.create({
      data: {
        clientId: client3.id,
        numberId: poolNumber.id,
        threadType: 'pool',
        status: 'active',
        ownerUnreadCount: 1,
        lastActivityAt: new Date(),
      },
    });

    await (prisma as any).threadParticipant.create({
      data: {
        threadId: policyViolationThread.id,
        participantType: 'client',
        participantId: client3.id,
      },
    });

    await (prisma as any).threadParticipant.create({
      data: {
        threadId: policyViolationThread.id,
        participantType: 'owner',
        participantId: owner.id,
      },
    });
  }

  const violationMessage = await (db as any).message.create({
    data: {
      threadId: policyViolationThread.id,
      direction: 'inbound',
      senderType: 'client',
      senderId: client3.id,
      body: 'Call me at 555-123-4567 or email me at test@example.com',
      redactedBody: 'Call me at [REDACTED] or email me at [REDACTED]',
      hasPolicyViolation: true,
      createdAt: new Date(Date.now() - 5400000),
    },
  });

  // Scenario 4: Active Assignment Window (AssignmentWindow doesn't have status field, uses sitterId not responsibleSitterId)
  const now = new Date();
  const startsAt = new Date(now.getTime() - 86400000);
  const endsAt = new Date(now.getTime() + 86400000);

  const existingWindow = await (db as any).assignmentWindow.findFirst({
    where: {
      threadId: unreadThread.id,
      sitterId: sitter.id,
    },
  });

  if (!existingWindow) {
    await (db as any).assignmentWindow.create({
      data: {
        threadId: unreadThread.id,
        sitterId: sitter.id,
        startsAt,
        endsAt,
      },
    });

    await (db as any).thread.update({
      where: { id: unreadThread.id },
      data: { sitterId: sitter.id },
    });
  } else {
    await (db as any).assignmentWindow.update({
      where: { id: existingWindow.id },
      data: { startsAt, endsAt },
    });
  }

  return {
    unreadThreadId: unreadThread.id,
    failedDeliveryThreadId: failedDeliveryThread.id,
    failedMessageId: failedMessage.id,
    policyViolationThreadId: policyViolationThread.id,
    violationMessageId: violationMessage.id,
    quarantinedNumberE164: quarantinedNumber.e164,
    sitterName: sitter.name || 'Sarah Johnson',
  };
}
