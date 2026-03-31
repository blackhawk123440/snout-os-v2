/**
 * Pool Release Job Tests
 * 
 * Verifies pool number release behavior based on rotation settings.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { releasePoolNumbers } from '../pool-release-job';

describe('Pool Release Job', () => {
  const orgId = 'test-org-release';
  const sitterId = 'test-sitter-release';
  const clientPhone = '+15559999999';

  beforeEach(async () => {
    // Clean up test data
    await prisma.assignmentWindow.deleteMany({ where: { orgId } });
    await prisma.messageThread.deleteMany({ where: { orgId } });
    await prisma.booking.deleteMany({ where: { orgId } });
    await prisma.client.deleteMany({ where: { orgId } });
    await prisma.sitter.deleteMany({ where: { orgId } });
    await prisma.messageNumber.deleteMany({ where: { orgId } });
    await prisma.setting.deleteMany({ where: { orgId, key: { startsWith: 'rotation.' } } });

    await prisma.sitter.upsert({
      where: { id: sitterId },
      update: { orgId },
      create: {
        id: sitterId,
        orgId,
        firstName: 'Pool',
        lastName: 'Sitter',
        email: 'pool-release-sitter@test.local',
      },
    });
  });

  it('should release pool numbers after postBookingGraceHours', async () => {
    // Set short grace period for testing (1 hour)
    await prisma.setting.upsert({
      where: { orgId_key: { orgId, key: 'rotation.postBookingGraceHours' } },
      update: { value: '1' },
      create: {
        orgId,
        key: 'rotation.postBookingGraceHours',
        value: '1',
        category: 'rotation',
        label: 'postBookingGraceHours',
      },
    });

    // Create pool number
    const poolNumber = await prisma.messageNumber.create({
      data: {
        orgId,
        e164: '+15550000001',
        numberClass: 'pool',
        status: 'active',
        provider: 'twilio',
      },
    });

    const client = await prisma.client.upsert({
      where: { phone: clientPhone },
      update: { orgId },
      create: { orgId, phone: clientPhone, firstName: 'Pool', lastName: 'Client' },
    });
    const booking = await prisma.booking.create({
      data: {
        orgId,
        clientId: client.id,
        sitterId,
        firstName: 'Pool',
        lastName: 'Client',
        phone: client.phone,
        service: 'Dog Walk',
        startAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        endAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        totalPrice: 50,
        status: 'confirmed',
      },
    });

    // Create thread with assignment window that ended 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const thread = await prisma.messageThread.create({
      data: {
        orgId,
        messageNumberId: poolNumber.id,
        numberClass: 'pool',
        scope: 'client_general',
        status: 'open',
      },
    });

    await prisma.assignmentWindow.create({
      data: {
        orgId,
        threadId: thread.id,
        bookingId: booking.id,
        sitterId,
        startAt: new Date(twoHoursAgo.getTime() - 2 * 60 * 60 * 1000),
        endAt: twoHoursAgo,
        status: 'active',
      },
    });

    // Run release job
    const stats = await releasePoolNumbers(orgId);

    expect(stats.releasedByGracePeriod).toBeGreaterThan(0);
    expect(stats.totalReleased).toBeGreaterThan(0);

    // Verify thread no longer has pool number
    const updatedThread = await prisma.messageThread.findUnique({
      where: { id: thread.id },
    });

    expect(updatedThread?.messageNumberId).toBeNull();
  });

  it('should release pool numbers after inactivityReleaseDays', async () => {
    // Set short inactivity period for testing (1 day)
    await prisma.setting.upsert({
      where: { orgId_key: { orgId, key: 'rotation.inactivityReleaseDays' } },
      update: { value: '1' },
      create: {
        orgId,
        key: 'rotation.inactivityReleaseDays',
        value: '1',
        category: 'rotation',
        label: 'inactivityReleaseDays',
      },
    });

    // Create pool number
    const poolNumber = await prisma.messageNumber.create({
      data: {
        orgId,
        e164: '+15550000001',
        numberClass: 'pool',
        status: 'active',
        provider: 'twilio',
      },
    });

    // Create thread with last message 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const thread = await prisma.messageThread.create({
      data: {
        orgId,
        messageNumberId: poolNumber.id,
        numberClass: 'pool',
        scope: 'client_general',
        status: 'open',
        lastMessageAt: twoDaysAgo,
      },
    });

    // Run release job
    const stats = await releasePoolNumbers(orgId);

    expect(stats.releasedByInactivity).toBeGreaterThan(0);
    expect(stats.totalReleased).toBeGreaterThan(0);

    // Verify thread no longer has pool number
    const updatedThread = await prisma.messageThread.findUnique({
      where: { id: thread.id },
    });

    expect(updatedThread?.messageNumberId).toBeNull();
  });

  it('should release pool numbers after maxPoolThreadLifetimeDays', async () => {
    // Set short max lifetime for testing (1 day)
    await prisma.setting.upsert({
      where: { orgId_key: { orgId, key: 'rotation.maxPoolThreadLifetimeDays' } },
      update: { value: '1' },
      create: {
        orgId,
        key: 'rotation.maxPoolThreadLifetimeDays',
        value: '1',
        category: 'rotation',
        label: 'maxPoolThreadLifetimeDays',
      },
    });

    // Create pool number
    const poolNumber = await prisma.messageNumber.create({
      data: {
        orgId,
        e164: '+15550000001',
        numberClass: 'pool',
        status: 'active',
        provider: 'twilio',
      },
    });

    // Create thread created 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const thread = await prisma.messageThread.create({
      data: {
        orgId,
        messageNumberId: poolNumber.id,
        numberClass: 'pool',
        scope: 'client_general',
        status: 'open',
        createdAt: twoDaysAgo,
      },
    });

    // Run release job
    const stats = await releasePoolNumbers(orgId);

    expect(stats.releasedByMaxLifetime).toBeGreaterThan(0);
    expect(stats.totalReleased).toBeGreaterThan(0);

    // Verify thread no longer has pool number
    const updatedThread = await prisma.messageThread.findUnique({
      where: { id: thread.id },
    });

    expect(updatedThread?.messageNumberId).toBeNull();
  });
});
