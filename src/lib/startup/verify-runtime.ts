/**
 * Runtime verification - fail fast on critical misconfigurations.
 * Called once on server boot. Do not use in edge runtime.
 */

import { PrismaClient } from '@prisma/client';
import { getRuntimeEnvName, isRedisRequiredEnv } from '@/lib/runtime-env';

const isProduction = process.env.NODE_ENV === 'production';

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export async function verifyRuntime(): Promise<VerifyResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let prisma: PrismaClient | null = null;
  const envName = getRuntimeEnvName();

  const maybeWarnDbPushGuidance = (message: string) => {
    if (envName === 'prod' && /db push/i.test(message)) {
      console.warn(
        '[runtime] Unsafe guidance detected in production: "db push". Use `pnpm prisma migrate deploy` instead.'
      );
    }
  };
  const pushError = (message: string) => {
    maybeWarnDbPushGuidance(message);
    errors.push(message);
  };
  const pushWarning = (message: string) => {
    maybeWarnDbPushGuidance(message);
    warnings.push(message);
  };

  // 1. DATABASE_URL + Prisma connect
  if (!process.env.DATABASE_URL) {
    pushError('DATABASE_URL is required');
  } else {
    try {
      prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      pushError(`Database unreachable: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Redis is required on staging/prod because workers and realtime depend on it.
  if (isRedisRequiredEnv() && !process.env.REDIS_URL && process.env.CI !== 'true') {
    pushError(`REDIS_URL is required in ${envName} for queues/realtime`);
  }

  // 2b. Staging/prod schema sanity guardrail.
  if (prisma && isRedisRequiredEnv()) {
    try {
      const requiredColumns = [
        { tableName: 'Booking', columnName: 'orgId' },
        { tableName: 'EventLog', columnName: 'orgId' },
        { tableName: 'CommandCenterAttentionState', columnName: 'itemKey' },
      ];

      const missing: string[] = [];
      for (const check of requiredColumns) {
        const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
          `SELECT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_name = $1
               AND column_name = $2
           ) AS "exists"`,
          check.tableName,
          check.columnName
        );
        if (!rows?.[0]?.exists) {
          missing.push(`${check.tableName}.${check.columnName}`);
        }
      }

      if (missing.length > 0) {
        pushError(
          `Schema sanity check failed (missing columns: ${missing.join(', ')}). ` +
            `Run 'pnpm prisma migrate deploy' against ${envName} DATABASE_URL before starting Next.js.`
        );
      }
    } catch (e) {
      pushError(
        `Schema sanity check query failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // 3. Stripe: if any Stripe key present, recommend both. Warn only so staging can start without webhook secret.
  const isSmokeOrE2E =
    process.env.SMOKE === 'true' ||
    (process.env.CI === 'true' && process.env.ENABLE_E2E_LOGIN === 'true');
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
  const hasStripeWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
  if (hasStripeKey || hasStripeWebhook) {
    if (!hasStripeKey && !isSmokeOrE2E) {
      pushError('STRIPE_SECRET_KEY required when Stripe webhook is configured');
    }
    if (!hasStripeWebhook && !isSmokeOrE2E) {
      pushWarning('STRIPE_WEBHOOK_SECRET not set; Stripe webhooks will not work');
    }
  }

  // 4. S3: if any S3 var present, require all
  const hasS3Bucket = !!process.env.S3_BUCKET;
  const hasS3Region = !!process.env.S3_REGION;
  const hasS3Access = !!process.env.S3_ACCESS_KEY_ID;
  const hasS3Secret = !!process.env.S3_SECRET_ACCESS_KEY;
  const anyS3 = hasS3Bucket || hasS3Region || hasS3Access || hasS3Secret;
  if (anyS3) {
    if (!hasS3Bucket) pushError('S3_BUCKET required when S3 is configured');
    if (!hasS3Region) pushError('S3_REGION required when S3 is configured');
    if (!hasS3Access) pushError('S3_ACCESS_KEY_ID required when S3 is configured');
    if (!hasS3Secret) pushError('S3_SECRET_ACCESS_KEY required when S3 is configured');
  }

  // 5. NEXTAUTH in production
  if (isProduction) {
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
      pushWarning('NEXTAUTH_SECRET should be at least 32 characters in production');
    }
  }

  if (prisma) {
    await prisma.$disconnect().catch(() => {});
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
