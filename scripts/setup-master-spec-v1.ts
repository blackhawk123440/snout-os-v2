/**
 * Master Spec V1 Database Setup Script
 * 
 * Initializes required DB data for MASTER SPEC V1 in a safe, repeatable way.
 * 
 * Usage:
 *   npx tsx scripts/setup-master-spec-v1.ts --orgId=default --frontDeskE164=+15551234567 --poolNumbers=+15559876543,+15559876544
 *   npx tsx scripts/setup-master-spec-v1.ts --orgId=default --frontDeskE164=+15551234567 --poolCount=10 --dry-run
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface SetupOptions {
  orgId?: string;
  orgSlug?: string;
  frontDeskE164?: string;
  poolNumbers?: string[];
  poolCount?: number;
  provider?: string;
  dryRun?: boolean;
}

interface SetupReport {
  created: {
    frontDesk: number;
    pool: number;
    sitterMasked: number;
  };
  updated: {
    frontDesk: number;
    pool: number;
    sitterMasked: number;
  };
  warnings: string[];
  errors: string[];
}

async function parseArgs(): Promise<SetupOptions> {
  const args = process.argv.slice(2);
  const options: SetupOptions = {};

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--orgId=')) {
      options.orgId = arg.split('=')[1];
    } else if (arg.startsWith('--orgSlug=')) {
      options.orgSlug = arg.split('=')[1];
    } else if (arg.startsWith('--frontDeskE164=')) {
      options.frontDeskE164 = arg.split('=')[1];
    } else if (arg.startsWith('--poolNumbers=')) {
      options.poolNumbers = arg.split('=')[1].split(',').map(n => n.trim());
    } else if (arg.startsWith('--poolCount=')) {
      options.poolCount = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--provider=')) {
      options.provider = arg.split('=')[1];
    }
  }

  return options;
}

async function resolveOrgId(options: SetupOptions): Promise<string> {
  if (options.orgId) {
    return options.orgId;
  }

  if (options.orgSlug) {
    // For now, orgSlug maps directly to orgId (single-org mode)
    // In future, would lookup Organization table
    return options.orgSlug;
  }

  // Default to 'default' org
  return 'default';
}

async function ensureFrontDeskNumber(
  orgId: string,
  e164: string,
  provider: string,
  dryRun: boolean,
  report: SetupReport
): Promise<void> {
  if (!e164) {
    report.errors.push('--frontDeskE164 is required');
    return;
  }

  const existing = await prisma.messageNumber.findFirst({
    where: {
      orgId,
      numberClass: 'front_desk',
      e164,
    },
  });

  if (existing) {
    if (existing.status !== 'active') {
      if (!dryRun) {
        await prisma.messageNumber.update({
          where: { id: existing.id },
          data: { status: 'active' },
        });
      }
      report.updated.frontDesk++;
      console.log(`  ✓ Updated front desk number ${e164} to active`);
    } else {
      console.log(`  ✓ Front desk number ${e164} already exists and is active`);
    }
  } else {
    if (!dryRun) {
      await prisma.messageNumber.create({
        data: {
          orgId,
          numberClass: 'front_desk',
          e164,
          provider: provider || 'twilio',
          providerNumberSid: `FD-${Date.now()}`, // Placeholder, should be real SID
          status: 'active',
        },
      });
    }
    report.created.frontDesk++;
    console.log(`  ${dryRun ? '[DRY RUN] ' : ''}✓ Created front desk number ${e164}`);
  }
}

async function ensurePoolNumbers(
  orgId: string,
  poolNumbers: string[] | undefined,
  poolCount: number | undefined,
  dryRun: boolean,
  report: SetupReport
): Promise<void> {
  if (!poolNumbers && !poolCount) {
    report.warnings.push('No pool numbers specified (--poolNumbers or --poolCount)');
    return;
  }

  if (poolCount && !poolNumbers) {
    report.errors.push('--poolCount requires explicit --poolNumbers list (do not auto-generate)');
    return;
  }

  if (!poolNumbers || poolNumbers.length === 0) {
    report.warnings.push('Pool numbers list is empty');
    return;
  }

  // Verify count matches if specified
  if (poolCount && poolNumbers.length !== poolCount) {
    report.errors.push(`--poolCount=${poolCount} but --poolNumbers has ${poolNumbers.length} numbers`);
    return;
  }

  for (const e164 of poolNumbers) {
    const existing = await prisma.messageNumber.findFirst({
      where: {
        orgId,
        numberClass: 'pool',
        e164,
      },
    });

    if (existing) {
      if (existing.status !== 'active') {
        if (!dryRun) {
          await prisma.messageNumber.update({
            where: { id: existing.id },
            data: { status: 'active' },
          });
        }
        report.updated.pool++;
        console.log(`  ✓ Updated pool number ${e164} to active`);
      } else {
        console.log(`  ✓ Pool number ${e164} already exists and is active`);
      }
    } else {
      if (!dryRun) {
        await prisma.messageNumber.create({
          data: {
            orgId,
            numberClass: 'pool',
            e164,
            provider: 'twilio',
            providerNumberSid: `POOL-${Date.now()}`, // Placeholder
            status: 'active',
          },
        });
      }
      report.created.pool++;
      console.log(`  ${dryRun ? '[DRY RUN] ' : ''}✓ Created pool number ${e164}`);
    }
  }
}

async function ensureSitterMaskedNumbers(
  orgId: string,
  dryRun: boolean,
  report: SetupReport
): Promise<void> {
  // Find all active sitters
  const activeSitters = await prisma.sitter.findMany({
    where: { active: true },
    include: { user: true },
  });

  if (activeSitters.length === 0) {
    report.warnings.push('No active sitters found');
    return;
  }

  // Find unused sitter masked numbers
  const usedNumberIds = await prisma.sitterMaskedNumber.findMany({
    where: { status: 'active' },
    select: { messageNumberId: true },
  });
  const usedIds = new Set(usedNumberIds.map(n => n.messageNumberId));

  const unusedNumbers = await prisma.messageNumber.findMany({
    where: {
      orgId,
      numberClass: 'sitter',
      status: 'active',
      id: { notIn: Array.from(usedIds) },
    },
  });

  const sittersWithoutNumbers: string[] = [];

  for (const sitter of activeSitters) {
    const existing = await prisma.sitterMaskedNumber.findFirst({
      where: {
        sitterId: sitter.id,
        status: 'active',
      },
      include: { messageNumber: true },
    });

    if (existing) {
      console.log(`  ✓ Sitter ${sitter.id} already has masked number ${existing.messageNumber.e164}`);
    } else {
      // Need to allocate a number
      if (unusedNumbers.length === 0) {
        sittersWithoutNumbers.push(sitter.id);
        continue;
      }

      const numberToAllocate = unusedNumbers.shift()!;

      if (!dryRun) {
        await prisma.sitterMaskedNumber.create({
          data: {
            orgId,
            sitterId: sitter.id,
            messageNumberId: numberToAllocate.id,
            status: 'active',
          },
        });
      }
      report.created.sitterMasked++;
      console.log(`  ${dryRun ? '[DRY RUN] ' : ''}✓ Allocated number ${numberToAllocate.e164} to sitter ${sitter.id}`);
    }
  }

  if (sittersWithoutNumbers.length > 0) {
    report.errors.push(
      `No unused SITTER_MASKED numbers available. Sitters missing numbers: ${sittersWithoutNumbers.join(', ')}`
    );
  }
}

async function main() {
  const options = await parseArgs();
  const report: SetupReport = {
    created: { frontDesk: 0, pool: 0, sitterMasked: 0 },
    updated: { frontDesk: 0, pool: 0, sitterMasked: 0 },
    warnings: [],
    errors: [],
  };

  console.log('🔧 Master Spec V1 Database Setup\n');
  console.log('='.repeat(60));

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Resolve org ID
  const orgId = await resolveOrgId(options);
  console.log(`📋 Target Organization: ${orgId}\n`);

  // Validate required inputs
  if (!options.frontDeskE164) {
    report.errors.push('--frontDeskE164 is required');
  }

  if (report.errors.length > 0) {
    console.error('❌ Errors:\n');
    report.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  // Setup front desk number
  console.log('1️⃣  Setting up Front Desk Number...');
  await ensureFrontDeskNumber(
    orgId,
    options.frontDeskE164!,
    options.provider || 'twilio',
    options.dryRun || false,
    report
  );

  // Setup pool numbers
  console.log('\n2️⃣  Setting up Pool Numbers...');
  await ensurePoolNumbers(
    orgId,
    options.poolNumbers,
    options.poolCount,
    options.dryRun || false,
    report
  );

  // Setup sitter masked numbers
  console.log('\n3️⃣  Setting up Sitter Masked Numbers...');
  await ensureSitterMaskedNumbers(orgId, options.dryRun || false, report);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SETUP SUMMARY\n');

  console.log('Created:');
  console.log(`  - Front Desk Numbers: ${report.created.frontDesk}`);
  console.log(`  - Pool Numbers: ${report.created.pool}`);
  console.log(`  - Sitter Masked Numbers: ${report.created.sitterMasked}`);

  console.log('\nUpdated:');
  console.log(`  - Front Desk Numbers: ${report.updated.frontDesk}`);
  console.log(`  - Pool Numbers: ${report.updated.pool}`);
  console.log(`  - Sitter Masked Numbers: ${report.updated.sitterMasked}`);

  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    report.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }

  console.log('\n✅ Setup complete!');
}

main()
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
