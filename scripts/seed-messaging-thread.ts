/**
 * Seed Messaging Thread - Local Dev Only
 * 
 * Creates a test thread with participants and messages for local development.
 * Run with: npx tsx scripts/seed-messaging-thread.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMessagingThread() {
  try {
    console.log('🌱 Seeding messaging thread...');

    // Get or create org (using default org for now)
    const orgId = 'default';

    // Get or create front desk number
    let frontDeskNumber = await prisma.messageNumber.findFirst({
      where: {
        orgId,
        numberClass: 'front_desk',
      },
    });

    if (!frontDeskNumber) {
      console.log('Creating front desk number...');
      frontDeskNumber = await prisma.messageNumber.create({
        data: {
          orgId,
          numberClass: 'front_desk',
          e164: '+12562039373', // Your Twilio number
          provider: 'twilio',
          providerNumberSid: 'test-front-desk-sid',
          status: 'active',
        },
      });
    }

    // Create thread first (participant requires threadId)
    const thread = await prisma.messageThread.create({
      data: {
        orgId,
        scope: 'client',
        messageNumberId: frontDeskNumber.id,
        numberClass: 'front_desk',
        status: 'open',
        isOneTimeClient: true,
        isMeetAndGreet: false,
      },
    });

    // Create test client participant (linked to thread)
    const clientPhone = '+15551234567';
    let clientParticipant = await prisma.messageParticipant.findFirst({
      where: {
        orgId,
        realE164: clientPhone,
        role: 'client',
        threadId: thread.id,
      },
    });

    if (!clientParticipant) {
      clientParticipant = await prisma.messageParticipant.create({
        data: {
          orgId,
          threadId: thread.id,
          realE164: clientPhone,
          role: 'client',
          displayName: 'Test Client',
        },
      });
    }

    // Create inbound message event
    const inboundEvent = await prisma.messageEvent.create({
      data: {
        orgId,
        threadId: thread.id,
        direction: 'inbound',
        actorType: 'client',
        body: 'Hello, this is a test message from the client.',
        providerMessageSid: 'test-inbound-msg-1',
        deliveryStatus: 'delivered',
        responsibleSitterIdSnapshot: null,
      },
    });

    // Create outbound message event
    const outboundEvent = await prisma.messageEvent.create({
      data: {
        orgId,
        threadId: thread.id,
        direction: 'outbound',
        actorType: 'owner',
        body: 'Hi! Thanks for reaching out. How can I help you today?',
        providerMessageSid: 'test-outbound-msg-1',
        deliveryStatus: 'delivered',
        responsibleSitterIdSnapshot: null,
      },
    });

    // Update thread timestamps
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        lastInboundAt: inboundEvent.createdAt,
        lastOutboundAt: outboundEvent.createdAt,
        lastMessageAt: outboundEvent.createdAt,
      },
    });

    console.log('✅ Seeding complete!');
    console.log('');
    console.log('Created:');
    console.log(`  Thread ID: ${thread.id}`);
    console.log(`  Client: ${clientPhone}`);
    console.log(`  Inbound message: ${inboundEvent.id}`);
    console.log(`  Outbound message: ${outboundEvent.id}`);
    console.log('');
    console.log('Refresh /messages to see the thread.');

  } catch (error) {
    console.error('❌ Error seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedMessagingThread();
