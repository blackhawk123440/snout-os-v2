/**
 * Seed Canonical Sitter Tiers
 * 
 * Creates the 4 canonical tiers as specified in the Enterprise Tier System:
 * 1. Trainee - Risk containment
 * 2. Certified - Reliable baseline labor
 * 3. Trusted - Delegation without supervision
 * 4. Elite - Retention, leadership, leverage
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding canonical sitter tiers...");

  // Clear existing tiers (optional - comment out if you want to preserve existing data)
  // await prisma.sitterTier.deleteMany();

  const tiers = [
    {
      name: "Trainee",
      pointTarget: 0,
      minCompletionRate: null,
      minResponseRate: null,
      priorityLevel: 1,
      description: "New sitters. Unproven. Learning your standards.",
      // Permissions - Risk containment
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
      // Commission - Lowest split
      commissionSplit: 65.0, // 65% to sitter, 35% to owner
      // Visual
      badgeColor: "#F5F5F5",
      badgeStyle: "outline",
      // Progression requirements
      progressionRequirements: JSON.stringify({
        bookings: "Complete X bookings with no issues",
        reliability: "No late arrivals or missed visits",
        training: "Complete training checklist",
      }),
      isDefault: true, // New sitters start here
    },
    {
      name: "Certified",
      pointTarget: 10,
      minCompletionRate: 95.0,
      minResponseRate: 90.0,
      priorityLevel: 2,
      description: "Sitters who have proven basic reliability.",
      // Permissions - Reliable baseline
      canJoinPools: true,
      canAutoAssign: false, // Still needs owner approval
      canOvernight: false,
      canSameDay: false,
      canHighValue: false,
      canRecurring: true,
      canLeadPool: false,
      canOverrideDecline: false,
      canTakeHouseSits: false, // Only short house sits
      canTakeTwentyFourHourCare: false,
      // Commission - Improved split
      commissionSplit: 75.0, // 75% to sitter
      // Visual
      badgeColor: "#8B6F47",
      badgeStyle: "outline",
      // Progression requirements
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
      // Permissions - Delegation without supervision
      canJoinPools: true,
      canAutoAssign: true, // Can be assigned without owner approval
      canOvernight: true,
      canSameDay: true, // Can handle last-minute bookings
      canHighValue: true,
      canRecurring: true,
      canLeadPool: false,
      canOverrideDecline: false,
      canTakeHouseSits: true,
      canTakeTwentyFourHourCare: true,
      // Commission - High split
      commissionSplit: 80.0, // 80% to sitter
      // Visual
      badgeColor: "#8B6F47",
      badgeStyle: "filled",
      // Progression requirements
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
      // Permissions - Retention, leadership, leverage
      canJoinPools: true,
      canAutoAssign: true,
      canOvernight: true,
      canSameDay: true,
      canHighValue: true,
      canRecurring: true,
      canLeadPool: true, // Can lead sitter pools
      canOverrideDecline: true, // Can override certain decline rules
      canTakeHouseSits: true,
      canTakeTwentyFourHourCare: true,
      // Commission - Top split + bonuses
      commissionSplit: 85.0, // 85% to sitter + bonuses
      // Visual
      badgeColor: "#8B6F47",
      badgeStyle: "accent", // Brown + pink accent
      // Progression requirements
      progressionRequirements: JSON.stringify({
        ownerApproval: "Owner approval required",
        reliability: "Long-term reliability",
        trust: "Business-level trust",
      }),
      isDefault: false,
    },
  ];

  for (const tierData of tiers) {
    // Check if tier already exists
    const existing = await prisma.sitterTier.findUnique({
      where: { name: tierData.name },
    });

    if (existing) {
      // Update existing tier
      await prisma.sitterTier.update({
        where: { name: tierData.name },
        data: tierData,
      });
      console.log(`✅ Updated tier: ${tierData.name}`);
    } else {
      // Create new tier
      await prisma.sitterTier.create({
        data: tierData,
      });
      console.log(`✅ Created tier: ${tierData.name}`);
    }
  }

  console.log("✨ Tier seeding completed successfully");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding tiers:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
