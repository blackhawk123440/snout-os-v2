import { PrismaClient } from '@prisma/client';

function deletedClientPhone(clientId: string) {
  return `deleted-client-${clientId}`;
}

function deletedSitterPhone(sitterId: string) {
  return `deleted-sitter-${sitterId}`;
}

function deletedUserEmail(userId: string) {
  return `deleted+${userId}@redacted.invalid`;
}

function deletedSitterEmail(sitterId: string) {
  return `deleted-sitter+${sitterId}@redacted.invalid`;
}

export async function eraseClientAccountData(db: PrismaClient, orgId: string, clientId: string, userId?: string | null) {
  const now = new Date();
  const tombstonePhone = deletedClientPhone(clientId);

  await db.$transaction([
    db.clientContact.deleteMany({ where: { orgId, clientId } }),
    db.clientEmergencyContact.deleteMany({ where: { orgId, clientId } }),
    db.emergencyVetAuth.deleteMany({ where: { orgId, clientId } }),
    db.pet.updateMany({
      where: { orgId, clientId },
      data: {
        name: 'Redacted Pet',
        breed: null,
        age: null,
        weight: null,
        gender: null,
        birthday: null,
        color: null,
        microchipId: null,
        photoUrl: null,
        feedingInstructions: null,
        medicationNotes: null,
        behaviorNotes: null,
        houseRules: null,
        walkInstructions: null,
        medications: null,
        vetName: null,
        vetPhone: null,
        vetAddress: null,
        vetClinicName: null,
        notes: null,
      },
    }),
    db.booking.updateMany({
      where: { orgId, clientId },
      data: {
        firstName: 'Deleted',
        lastName: 'Client',
        phone: tombstonePhone,
        email: null,
        address: null,
        pickupAddress: null,
        dropoffAddress: null,
        notes: null,
        entryInstructions: null,
        doorCode: null,
      },
    }),
    db.client.update({
      where: { id: clientId },
      data: {
        firstName: 'Deleted',
        lastName: 'Client',
        phone: tombstonePhone,
        email: null,
        address: null,
        notes: null,
        keyStatus: 'none',
        keyHolder: null,
        keyNotes: null,
        keyGivenAt: null,
        keyReturnedAt: null,
        keyLocation: null,
        lockboxCode: null,
        doorAlarmCode: null,
        wifiNetwork: null,
        wifiPassword: null,
        entryInstructions: null,
        parkingNotes: null,
        stripeCustomerId: null,
        defaultPaymentMethodId: null,
        referredBy: null,
        referralCode: null,
        deletedAt: now,
      },
    }),
    ...(userId
      ? [
          db.user.update({
            where: { id: userId },
            data: {
              name: 'Deleted User',
              email: deletedUserEmail(userId),
              image: null,
              passwordHash: null,
              inviteToken: null,
              inviteExpiresAt: null,
              welcomeToken: null,
              welcomeTokenExpiresAt: null,
              passwordResetToken: null,
              passwordResetExpiresAt: null,
              deletedAt: now,
              passwordChangedAt: now,
            },
          }),
        ]
      : []),
  ]);
}

export async function eraseSitterAccountData(db: PrismaClient, orgId: string, sitterId: string, userId?: string | null) {
  const now = new Date();

  await db.$transaction([
    db.sitter.update({
      where: { id: sitterId },
      data: {
        firstName: 'Deleted',
        lastName: 'Sitter',
        phone: deletedSitterPhone(sitterId),
        email: deletedSitterEmail(sitterId),
        personalPhone: null,
        openphonePhone: null,
        phoneType: null,
        stripeAccountId: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
        calendarSyncEnabled: false,
        deletedAt: now,
      },
    }),
    ...(userId
      ? [
          db.user.update({
            where: { id: userId },
            data: {
              name: 'Deleted User',
              email: deletedUserEmail(userId),
              image: null,
              passwordHash: null,
              inviteToken: null,
              inviteExpiresAt: null,
              welcomeToken: null,
              welcomeTokenExpiresAt: null,
              passwordResetToken: null,
              passwordResetExpiresAt: null,
              deletedAt: now,
              passwordChangedAt: now,
            },
          }),
        ]
      : []),
  ]);
}
