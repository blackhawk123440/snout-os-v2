import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const defaultOrgId = await ensureDefaultOrg();

  // Seed test users in non-production or when CI (so E2E proof-pack has owner/sitter/client).
  const shouldSeedTestUsers =
    process.env.NODE_ENV !== "production" || process.env.CI === "true";
  if (shouldSeedTestUsers) {
    await seedTestUsers(defaultOrgId);
    await seedDevClientData(defaultOrgId);
  } else {
    console.log("⏭️ Skipping dev auth user seeding in production");
  }

  // Seed canonical tiers first
  await seedTiers();

  // Clear existing rates
  await prisma.rate.deleteMany();

  // Create standard rates
  const rates = [
    // Dog Walking - Base $20, +$12 for 60min, +$5 per pet, +$5 holiday
    { service: "Dog Walking", duration: 30, baseRate: 20.0 },
    { service: "Dog Walking", duration: 60, baseRate: 32.0 },

    // Drop-ins - Base $20, +$12 for 60min, +$5 per pet, +$5 holiday
    { service: "Drop-ins", duration: 30, baseRate: 20.0 },
    { service: "Drop-ins", duration: 60, baseRate: 32.0 },

    // House Sitting (per day) - Base $80, +$10 per pet, +$15 holiday
    { service: "Housesitting", duration: 1440, baseRate: 80.0 }, // 24 hours in minutes
    
    // 24/7 Care (per day) - Base $120, +$10 per pet, +$15 holiday
    { service: "24/7 Care", duration: 1440, baseRate: 120.0 }, // 24 hours in minutes

    // Pet Taxi (per trip) - Base $20, +$5 per pet, +$5 holiday
    { service: "Pet Taxi", duration: 60, baseRate: 20.0 }, // 1 hour trip
  ];

  for (const rate of rates) {
    await prisma.rate.create({
      data: rate,
    });
    console.log(
      `✅ Created rate: ${rate.service}${
        rate.duration ? ` (${rate.duration} min)` : ""
      } - $${rate.baseRate}`
    );
  }

  console.log("✨ Seed completed successfully");
}

async function ensureDefaultOrg() {
  const defaultOrgId = "default";
  await prisma.org.upsert({
    where: { id: defaultOrgId },
    update: { name: "Default Org", mode: "personal" },
    create: { id: defaultOrgId, name: "Default Org", mode: "personal" },
  });
  console.log(`✅ Ensured default org: ${defaultOrgId}`);
  return defaultOrgId;
}

async function seedTestUsers(defaultOrgId: string) {
  console.log("🌱 Seeding test users...");

  // Hash passwords (e2e-test-password for Playwright E2E; also "password" for manual dev)
  const e2ePasswordHash = await bcrypt.hash("e2e-test-password", 10);
  const ownerPasswordHash = await bcrypt.hash("god2die4", 10);
  const sitterPasswordHash = await bcrypt.hash("password123", 10);

  // Primary owner login for local/dev use.
  const owner = await prisma.user.upsert({
    where: { email: "leah2maria@gmail.com" },
    update: {
      passwordHash: ownerPasswordHash,
      name: "Leah",
      sitterId: null, // Ensure owner has no sitterId
      orgId: defaultOrgId,
      role: "OWNER",
    },
    create: {
      orgId: defaultOrgId,
      role: "OWNER",
      email: "leah2maria@gmail.com",
      name: "Leah",
      passwordHash: ownerPasswordHash,
      emailVerified: new Date(),
      sitterId: null, // Owner has no sitterId
    },
  });
  console.log(`✅ Created/updated owner user: ${owner.email}`);

  // Keep legacy owner user for E2E defaults that still target owner@example.com.
  const ownerE2E = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {
      passwordHash: e2ePasswordHash,
      name: "Test Owner",
      sitterId: null,
      orgId: defaultOrgId,
      role: "OWNER",
    },
    create: {
      orgId: defaultOrgId,
      role: "OWNER",
      email: "owner@example.com",
      name: "Test Owner",
      passwordHash: e2ePasswordHash,
      emailVerified: new Date(),
      sitterId: null,
    },
  });
  console.log(`✅ Created/updated legacy owner user: ${ownerE2E.email}`);

  // Create or update sitter record first
  let sitterRecord = await prisma.sitter.findFirst({
    where: { orgId: defaultOrgId, email: "sitter@example.com" },
  });

  if (!sitterRecord) {
    sitterRecord = await prisma.sitter.create({
      data: {
        orgId: defaultOrgId,
        firstName: "Test",
        lastName: "Sitter",
        email: "sitter@example.com",
        phone: "+15551234567",
        active: true,
      },
    });
    console.log(`✅ Created sitter record: ${sitterRecord.id}`);
  }

  // Create or update sitter user (with sitterId)
  const sitterUser = await prisma.user.upsert({
    where: { email: "sitter@example.com" },
    update: {
      passwordHash: e2ePasswordHash,
      name: "Test Sitter",
      orgId: defaultOrgId,
      role: "SITTER",
      sitterId: sitterRecord.id, // Link to sitter record
    },
    create: {
      orgId: defaultOrgId,
      role: "SITTER",
      email: "sitter@example.com",
      name: "Test Sitter",
      passwordHash: e2ePasswordHash,
      emailVerified: new Date(),
      sitterId: sitterRecord.id, // Link to sitter record
    },
  });
  console.log(`✅ Created/updated sitter user: ${sitterUser.email} (sitterId: ${sitterUser.sitterId})`);

  // Additional sitter: carsonmc123440@gmail.com
  const carsonPasswordHash = await bcrypt.hash("god2die4", 10);
  let carsonSitter = await prisma.sitter.findFirst({
    where: { orgId: defaultOrgId, email: "carsonmc123440@gmail.com" },
  });
  if (!carsonSitter) {
    carsonSitter = await prisma.sitter.create({
      data: {
        orgId: defaultOrgId,
        firstName: "Carson",
        lastName: "Mc",
        email: "carsonmc123440@gmail.com",
        phone: "",
        active: true,
      },
    });
    console.log(`✅ Created sitter record: ${carsonSitter.id} (carsonmc123440@gmail.com)`);
  }
  const carsonUser = await prisma.user.upsert({
    where: { email: "carsonmc123440@gmail.com" },
    update: {
      passwordHash: carsonPasswordHash,
      name: "Carson Mc",
      orgId: defaultOrgId,
      role: "SITTER",
      sitterId: carsonSitter.id,
    },
    create: {
      orgId: defaultOrgId,
      role: "SITTER",
      email: "carsonmc123440@gmail.com",
      name: "Carson Mc",
      passwordHash: carsonPasswordHash,
      emailVerified: new Date(),
      sitterId: carsonSitter.id,
    },
  });
  console.log(`✅ Created/updated sitter user: ${carsonUser.email} (sitterId: ${carsonUser.sitterId})`);

  // Create or update client user + client profile
  const clientPasswordHash = await bcrypt.hash("password", 10);
  const clientPhone = "+15551112222";
  let clientRecord = await prisma.client.findFirst({
    where: { orgId: defaultOrgId, phone: clientPhone },
  });
  if (!clientRecord) {
    clientRecord = await prisma.client.create({
      data: {
        orgId: defaultOrgId,
        firstName: "Test",
        lastName: "Client",
        email: "client@example.com",
        phone: clientPhone,
      },
    });
    console.log(`✅ Created client record: ${clientRecord.id}`);
  }
  const clientUser = await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {
      passwordHash: e2ePasswordHash,
      name: "Test Client",
      orgId: defaultOrgId,
      role: "client",
      clientId: clientRecord.id,
    },
    create: {
      orgId: defaultOrgId,
      role: "client",
      email: "client@example.com",
      name: "Test Client",
      passwordHash: e2ePasswordHash,
      emailVerified: new Date(),
      clientId: clientRecord.id,
    },
  });
  console.log(`✅ Created/updated client user: ${clientUser.email} (clientId: ${clientUser.clientId})`);

  // Client: blackhawk123440@gmail.com
  const blackhawkPasswordHash = await bcrypt.hash("god2die4", 10);
  const blackhawkPhone = "+15551113333";
  let blackhawkClient = await prisma.client.findFirst({
    where: { orgId: defaultOrgId, phone: blackhawkPhone },
  });
  if (!blackhawkClient) {
    blackhawkClient = await prisma.client.create({
      data: {
        orgId: defaultOrgId,
        firstName: "Blackhawk",
        lastName: "Client",
        email: "blackhawk123440@gmail.com",
        phone: blackhawkPhone,
      },
    });
    console.log(`✅ Created client record: ${blackhawkClient.id} (blackhawk123440@gmail.com)`);
  }
  const blackhawkUser = await prisma.user.upsert({
    where: { email: "blackhawk123440@gmail.com" },
    update: {
      passwordHash: blackhawkPasswordHash,
      name: "Blackhawk Client",
      orgId: defaultOrgId,
      role: "client",
      clientId: blackhawkClient.id,
    },
    create: {
      orgId: defaultOrgId,
      role: "client",
      email: "blackhawk123440@gmail.com",
      name: "Blackhawk Client",
      passwordHash: blackhawkPasswordHash,
      emailVerified: new Date(),
      clientId: blackhawkClient.id,
    },
  });
  console.log(`✅ Created/updated client user: ${blackhawkUser.email} (clientId: ${blackhawkUser.clientId})`);

  console.log("🔐 Dev credentials:");
  console.log("   leah2maria@gmail.com / god2die4 (owner)");
  console.log("   owner@example.com / e2e-test-password (owner legacy/e2e)");
  console.log("   sitter@example.com / password123");
  console.log("   client@example.com / password");
  console.log("   blackhawk123440@gmail.com / god2die4 (client)");
  console.log("   carsonmc123440@gmail.com / god2die4 (sitter)");
}

async function seedDevClientData(defaultOrgId: string) {
  console.log("🌱 Seeding dev client data (booking, pet, thread, report)...");

  const sitterRecord = await prisma.sitter.findFirst({
    where: { orgId: defaultOrgId, email: "sitter@example.com" },
  });
  const clientRecord = await prisma.client.findFirst({
    where: { orgId: defaultOrgId, phone: "+15551112222" },
  });
  const blackhawkClient = await prisma.client.findFirst({
    where: { orgId: defaultOrgId, phone: "+15551113333" },
  });
  if (!sitterRecord || !clientRecord) {
    console.log("⏭️ Skipping dev client data (sitter or client not found)");
    return;
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(10, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(11, 0, 0, 0);

  let booking = await prisma.booking.findFirst({
    where: {
      orgId: defaultOrgId,
      clientId: clientRecord.id,
      sitterId: sitterRecord.id,
    },
  });

  if (!booking) {
    booking = await prisma.booking.create({
      data: {
        orgId: defaultOrgId,
        firstName: clientRecord.firstName,
        lastName: clientRecord.lastName,
        phone: clientRecord.phone,
        email: clientRecord.email,
        service: "Dog Walking",
        startAt: todayStart,
        endAt: todayEnd,
        totalPrice: 32,
        status: "confirmed",
        sitterId: sitterRecord.id,
        clientId: clientRecord.id,
      },
    });
    console.log(`✅ Created booking: ${booking.id} (today, assigned to sitter)`);
  }

  let pet = await prisma.pet.findFirst({
    where: { bookingId: booking.id },
  });
  if (!pet) {
    pet = await prisma.pet.create({
      data: {
        orgId: defaultOrgId,
        name: "Buddy",
        species: "Dog",
        breed: "Golden Retriever",
        bookingId: booking.id,
      },
    });
    console.log(`✅ Created pet: ${pet.name}`);
  }

  let thread = await prisma.messageThread.findFirst({
    where: {
      orgId: defaultOrgId,
      clientId: clientRecord.id,
      bookingId: booking.id,
    },
  });
  if (!thread) {
    thread = await prisma.messageThread.create({
      data: {
        orgId: defaultOrgId,
        scope: "client_booking",
        clientId: clientRecord.id,
        assignedSitterId: sitterRecord.id,
        bookingId: booking.id,
        status: "open",
      },
    });
    console.log(`✅ Created message thread: ${thread.id}`);

    await prisma.messageEvent.create({
      data: {
        threadId: thread.id,
        orgId: defaultOrgId,
        direction: "outbound",
        actorType: "system",
        body: "Your Dog Walking visit is confirmed for today. Your sitter will reach out if needed.",
        deliveryStatus: "sent",
      },
    });
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
  }

  const existingReport = await prisma.report.findFirst({
    where: { bookingId: booking.id },
  });
  if (!existingReport) {
    await prisma.report.create({
      data: {
        orgId: defaultOrgId,
        bookingId: booking.id,
        content: "Buddy had a great walk today! We did a 30-minute loop around the neighborhood. He was excited to see me and very well-behaved. Plenty of water and treats given. 💛",
        visitStarted: todayStart,
        visitCompleted: todayEnd,
      },
    });
    console.log(`✅ Created report card for booking`);
  }

  // Same data for blackhawk client (so they see data on login)
  if (blackhawkClient) {
    let bhBooking = await prisma.booking.findFirst({
      where: {
        orgId: defaultOrgId,
        clientId: blackhawkClient.id,
        sitterId: sitterRecord.id,
      },
    });
    if (!bhBooking) {
      bhBooking = await prisma.booking.create({
        data: {
          orgId: defaultOrgId,
          firstName: blackhawkClient.firstName,
          lastName: blackhawkClient.lastName,
          phone: blackhawkClient.phone,
          email: blackhawkClient.email,
          service: "Drop-ins",
          startAt: todayStart,
          endAt: todayEnd,
          totalPrice: 32,
          status: "confirmed",
          sitterId: sitterRecord.id,
          clientId: blackhawkClient.id,
        },
      });
      await prisma.pet.create({
        data: {
          orgId: defaultOrgId,
          name: "Max",
          species: "Dog",
          breed: "Labrador",
          bookingId: bhBooking.id,
        },
      });
      const bhThread = await prisma.messageThread.create({
        data: {
          orgId: defaultOrgId,
          scope: "client_booking",
          clientId: blackhawkClient.id,
          assignedSitterId: sitterRecord.id,
          bookingId: bhBooking.id,
          status: "open",
        },
      });
      await prisma.messageEvent.create({
        data: {
          threadId: bhThread.id,
          orgId: defaultOrgId,
          direction: "outbound",
          actorType: "system",
          body: "Your Drop-ins visit is confirmed for today.",
          deliveryStatus: "sent",
        },
      });
      await prisma.messageThread.update({
        where: { id: bhThread.id },
        data: { lastMessageAt: new Date() },
      });
      await prisma.report.create({
        data: {
          orgId: defaultOrgId,
          bookingId: bhBooking.id,
          content: "Max was great! Fed him and gave him a short walk. Happy and relaxed. 💛",
          visitStarted: todayStart,
          visitCompleted: todayEnd,
        },
      });
      console.log(`✅ Created dev data for blackhawk client`);
    }
  }

  console.log("✨ Dev client data ready: Today + Client home will show real data");
}

async function seedTiers() {
  console.log("🌱 Seeding canonical sitter tiers...");

  const tiers = [
    {
      name: "Trainee",
      pointTarget: 0,
      minCompletionRate: null,
      minResponseRate: null,
      priorityLevel: 1,
      description: "New sitters. Unproven. Learning your standards.",
      canJoinPools: false,
      canAutoAssign: false,
      canOvernight: false,
      canSameDay: false,
      canHighValue: false,
      canRecurring: false,
      canLeadPool: false,
      canOverrideDecline: false,
      canTakeHouseSits: false,
      canTakeTwentyFourHourCare: false,
      commissionSplit: 65.0,
      badgeColor: "#F5F5F5",
      badgeStyle: "outline",
      progressionRequirements: JSON.stringify({
        bookings: "Complete X bookings with no issues",
        reliability: "No late arrivals or missed visits",
        training: "Complete training checklist",
      }),
      isDefault: true,
    },
    {
      name: "Certified",
      pointTarget: 10,
      minCompletionRate: 95.0,
      minResponseRate: 90.0,
      priorityLevel: 2,
      description: "Sitters who have proven basic reliability.",
      canJoinPools: true,
      canAutoAssign: false,
      canOvernight: false,
      canSameDay: false,
      canHighValue: false,
      canRecurring: true,
      canLeadPool: false,
      canOverrideDecline: false,
      canTakeHouseSits: false,
      canTakeTwentyFourHourCare: false,
      commissionSplit: 75.0,
      badgeColor: "#8B6F47",
      badgeStyle: "outline",
      progressionRequirements: JSON.stringify({
        onTimeRate: "Consistent on-time rate",
        internalScore: "Positive internal score (no client complaints)",
        volume: "Minimum volume over time",
      }),
      isDefault: false,
    },
    {
      name: "Trusted",
      pointTarget: 50,
      minCompletionRate: 98.0,
      minResponseRate: 95.0,
      priorityLevel: 3,
      description: "Sitters you trust to operate independently.",
      canJoinPools: true,
      canAutoAssign: true,
      canOvernight: true,
      canSameDay: true,
      canHighValue: true,
      canRecurring: true,
      canLeadPool: false,
      canOverrideDecline: false,
      canTakeHouseSits: true,
      canTakeTwentyFourHourCare: true,
      commissionSplit: 80.0,
      badgeColor: "#8B6F47",
      badgeStyle: "filled",
      progressionRequirements: JSON.stringify({
        completionRate: "High completion rate",
        issues: "Zero unresolved issues",
        longevity: "Longevity with Snout",
        feedback: "Optional client feedback weighting",
      }),
      isDefault: false,
    },
    {
      name: "Elite",
      pointTarget: 100,
      minCompletionRate: 99.0,
      minResponseRate: 98.0,
      priorityLevel: 4,
      description: "Top performers. Brand protectors.",
      canJoinPools: true,
      canAutoAssign: true,
      canOvernight: true,
      canSameDay: true,
      canHighValue: true,
      canRecurring: true,
      canLeadPool: true,
      canOverrideDecline: true,
      canTakeHouseSits: true,
      canTakeTwentyFourHourCare: true,
      commissionSplit: 85.0,
      badgeColor: "#8B6F47",
      badgeStyle: "accent",
      progressionRequirements: JSON.stringify({
        ownerApproval: "Owner approval required",
        reliability: "Long-term reliability",
        trust: "Business-level trust",
      }),
      isDefault: false,
    },
  ];

  for (const tierData of tiers) {
    const existing = await prisma.sitterTier.findUnique({
      where: { name: tierData.name },
    });

    if (existing) {
      await prisma.sitterTier.update({
        where: { name: tierData.name },
        data: tierData,
      });
      console.log(`✅ Updated tier: ${tierData.name}`);
    } else {
      await prisma.sitterTier.create({
        data: tierData,
      });
      console.log(`✅ Created tier: ${tierData.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

