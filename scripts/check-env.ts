#!/usr/bin/env tsx
/**
 * Environment variable check script.
 * Run: pnpm exec tsx scripts/check-env.ts [--prod]
 * --prod: enforce production-required vars (REDIS_URL, NEXTAUTH_SECRET length, etc.)
 */

import "dotenv/config";

const isProd = process.argv.includes("--prod");

const required = ["DATABASE_URL"] as const;
const requiredForAuth = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;
const prodRequired = ["REDIS_URL"] as const;
const stripeWhenConfigured = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;
const s3WhenConfigured = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

function check(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

const missing: string[] = [];

for (const key of required) {
  if (!check(key)) missing.push(key);
}

if (isProd) {
  for (const key of requiredForAuth) {
    if (!check(key)) missing.push(key);
  }
  for (const key of prodRequired) {
    if (!check(key)) missing.push(`${key} (required in production)`);
  }
  if (check("NEXTAUTH_SECRET") && (process.env.NEXTAUTH_SECRET?.length ?? 0) < 32) {
    missing.push("NEXTAUTH_SECRET should be at least 32 characters in production");
  }
}

const hasStripe = check("STRIPE_SECRET_KEY") || check("STRIPE_WEBHOOK_SECRET");
if (hasStripe) {
  for (const key of stripeWhenConfigured) {
    if (!check(key)) missing.push(`${key} (required when Stripe is configured)`);
  }
}

const hasS3 = check("S3_BUCKET") || check("S3_REGION") || check("S3_ACCESS_KEY_ID") || check("S3_SECRET_ACCESS_KEY");
if (hasS3) {
  for (const key of s3WhenConfigured) {
    if (!check(key)) missing.push(`${key} (required when S3 is configured)`);
  }
}

if (missing.length > 0) {
  console.error("Missing or invalid environment variables:");
  missing.forEach((m) => console.error("  -", m));
  process.exit(1);
}

console.log("Environment check passed.");
if (isProd) {
  console.log("(Production mode: REDIS_URL and NEXTAUTH_SECRET length enforced)");
}
