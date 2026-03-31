/**
 * Seed Messaging Data for Local Development
 * 
 * Creates test threads, messages, and related data for testing the messaging UI.
 * Run with: npx tsx scripts/seed-messaging-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMessagingData() {
  try {
    console.log('🌱 Seeding messaging data...');

    // Get or create org
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Demo Pet Care Business',
        },
      });
      console.log('✅ Created organization:', org.id);
    } else {
      console.log('✅ Using existing organization:', org.id);
    }

    // Get or create front desk number
    let frontDeskNumber = await prisma.messageNumber.findFirst({
      where: {
        orgId: org.id,
        numberClass: 'front_desk',
      },
    });

    if (!frontDeskNumber) {
      frontDeskNumber = await prisma.messageNumber.create({
        data: {
          orgId: org.id,
          numberClass: 'front_desk',
          e164: '+12562039373',
          provider: 'twilio',
          providerNumberSid: 'test-front-desk-sid',
          status: 'active',
        },
      });
      console.log('✅ Created front desk number');
    }

    // Get or create clients
    const client1 = await prisma.client.upsert({
      where: {
        orgId_name: {
          orgId: org.id,
          name: 'John Smith',
        },
      },
      update: {},
      create: {
        orgId: org.id,
        name: 'John Smith',
        contacts: {
          create: {
            e164: '+15551234567',
            label: 'Mobile',
            verified: true,
          },
        },
      },
    });

    const client2 = await prisma.client.upsert({
      where: {
        orgId_name: {
          orgId: org.id,
          name: 'Jane Doe',
        },
      },
      update: {},
      create: {
        orgId: org.id,
        name: 'Jane Doe',
        contacts: {
          create: {
            e164: '+15559876543',
            label: 'Mobile',
            verified: true,
          },
        },
      },
    });

    console.log('✅ Created/verified clients');

    // Create threads
    const thread1 = await prisma.messageThread.create({
      data: {
        orgId: org.id,
        clientId: client1.id,
        scope: 'client_general',
        messageNumberId: frontDeskNumber.id,
        numberClass: 'front_desk',
        status: 'open',
        isOneTimeClient: false,
        participants: {
          create: {
            orgId: org.id,
            role: 'client',
            realE164: '+15551234567',
            displayName: 'John Smith',
            clientId: client1.id,
          },
        },
      },
    });

    const thread2 = await prisma.messageThread.create({
      data: {
        orgId: org.id,
        clientId: client2.id,
        scope: 'client_general',
        messageNumberId: frontDeskNumber.id,
        numberClass: 'front_desk',
        status: 'open',
        isOneTimeClient: false,
        participants: {
          create: {
            orgId: org.id,
            role: 'client',
            realE164: '+15559876543',
            displayName: 'Jane Doe',
            clientId: client2.id,
          },
        },
      },
    });

    console.log('✅ Created threads');

    // Get or create a sitter for assignment window
    let sitter = await prisma.sitter.findFirst({
      where: { orgId: org.id },
    });
    if (!sitter) {
      sitter = await prisma.sitter.create({
        data: {
          orgId: org.id,
          firstName: 'Demo',
          lastName: 'Sitter',
          email: 'sitter@example.com',
          phone: '+15551111111',
        },
      });
    }

    // Create a booking for assignment window
    let booking = await prisma.booking.findFirst({
      where: { orgId: org.id },
    });
    if (!booking) {
      booking = await prisma.booking.create({
        data: {
          orgId: org.id,
          clientId: client1.id,
          sitterId: sitter.id,
          status: 'confirmed',
          startDate: new Date(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    // Create assignment window for thread1 (active now)
    const windowStart = new Date();
    const windowEnd = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    await prisma.assignmentWindow.create({
      data: {
        orgId: org.id,
        threadId: thread1.id,
        bookingId: booking.id,
        sitterId: sitter.id,
        startAt: windowStart,
        endAt: windowEnd,
        status: 'active',
      },
    });

    // Create messages for thread1
    const now = new Date();
    const msg1 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: thread1.id,
        direction: 'inbound',
        actorType: 'client',
        body: 'Hello, when will you arrive?',
        providerMessageSid: 'mock-msg-1',
        deliveryStatus: 'delivered',
      },
    });

    const msg2 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: thread1.id,
        direction: 'outbound',
        actorType: 'owner',
        body: 'Hi John! We\'ll be there at 2 PM.',
        providerMessageSid: 'mock-msg-2',
        deliveryStatus: 'delivered',
      },
    });

    const msg3 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: thread1.id,
        direction: 'inbound',
        actorType: 'client',
        body: 'Perfect, thank you!',
        providerMessageSid: 'mock-msg-3',
        deliveryStatus: 'delivered',
      },
    });

    // Create a failed delivery message (for Retry button)
    const msg4 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: thread1.id,
        direction: 'outbound',
        actorType: 'owner',
        body: 'This message failed to deliver',
        providerMessageSid: 'mock-msg-4',
        deliveryStatus: 'failed',
        failureCode: '30008',
        failureDetail: 'Unknown destination number',
        providerErrorCode: '30008',
        providerErrorMessage: 'Unknown destination number',
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    // Create a message with policy violation (for thread2)
    const msg5 = await prisma.messageEvent.create({
      data: {
        orgId: org.id,
        threadId: thread2.id,
        direction: 'inbound',
        actorType: 'client',
        body: 'Contact me at 555-1234 or email@example.com',
        providerMessageSid: 'mock-msg-5',
        deliveryStatus: 'delivered',
        metadataJson: JSON.stringify({
          hasPolicyViolation: true,
          redactedBody: 'Contact me at [REDACTED] or [REDACTED]',
        }),
      },
    });

    // Create AntiPoachingAttempt (policy violation) for msg5
    await prisma.antiPoachingAttempt.create({
      data: {
        orgId: org.id,
        threadId: thread2.id,
        eventId: msg5.id,
        actorType: 'client',
        violationType: 'phone_number',
        detectedContent: '555-1234',
        action: 'blocked',
      },
    });

    console.log('✅ Created messages');

    // Update thread timestamps
    // Update thread1: unread count > 0, latest activity
    await prisma.messageThread.update({
      where: { id: thread1.id },
      data: {
        lastInboundAt: msg3.createdAt,
        lastOutboundAt: msg2.createdAt,
        lastMessageAt: msg3.createdAt,
        ownerUnreadCount: 2, // Unread count > 0 for filter
        assignedSitterId: sitter.id, // Assign sitter for assignment window
      },
    });

    // Update thread2: unread count > 0, policy violation
    await prisma.messageThread.update({
      where: { id: thread2.id },
      data: {
        lastInboundAt: msg5.createdAt,
        lastMessageAt: msg5.createdAt,
        ownerUnreadCount: 1, // Unread count > 0 for filter
      },
    });

    console.log('\n🎉 Seeding complete!');
    console.log('\n📋 Created:');
    console.log(`  - Thread 1: ${thread1.id}`);
    console.log(`    * 4 messages (1 failed delivery - Retry button visible)`);
    console.log(`    * Unread count: 2 (Unread filter works)`);
    console.log(`    * Active assignment window (Window badge shows)`);
    console.log(`  - Thread 2: ${thread2.id}`);
    console.log(`    * 1 message with policy violation (Policy banner visible)`);
    console.log(`    * Unread count: 1 (Unread filter works)`);
    console.log('\n📝 Refresh /messages to see:');
    console.log('  ✓ Unread filter shows both threads');
    console.log('  ✓ Policy Issues filter shows thread2');
    console.log('  ✓ Delivery Failures filter shows thread1');
    console.log('  ✓ Retry button on failed message in thread1');
    console.log('  ✓ Policy violation banner in thread2');
    console.log('  ✓ Assignment window badge in thread1');

  } catch (error) {
    console.error('❌ Error seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedMessagingData();
