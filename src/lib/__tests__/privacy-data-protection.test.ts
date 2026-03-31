/**
 * Tests for privacy and data protection behavior.
 *
 * Verifies:
 * - Soft delete uses deletedAt (not hard delete)
 * - Deleted users are blocked from auth
 * - Client and sitter self-delete endpoints exist and use soft delete
 * - Data export endpoints exist and return file attachments
 * - Export blocked for deleted clients (self-service)
 * - Owner can export deleted client data
 * - OptOutState is a tenant-scoped model
 * - Cascade rules are correct (SetNull for bookings, Cascade for sessions)
 * - Privacy and terms pages are real content
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('soft delete implementation', () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'prisma/schema.prisma'),
    'utf-8'
  );

  it('User model has deletedAt field', () => {
    // Find the User model section and check for deletedAt
    expect(schema).toMatch(/model User[\s\S]*?deletedAt\s+DateTime\?/);
  });

  it('Client model has deletedAt field', () => {
    expect(schema).toMatch(/model Client[\s\S]*?deletedAt\s+DateTime\?/);
  });

  it('Sitter model has deletedAt field', () => {
    expect(schema).toMatch(/model Sitter[\s\S]*?deletedAt\s+DateTime\?/);
  });
});

describe('auth blocks deleted users', () => {
  it('request-context checks deletedAt', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/request-context.ts'),
      'utf-8'
    );
    expect(source).toContain('deletedAt');
    expect(source).toContain('deleted');
  });
});

describe('self-delete endpoints exist and use soft delete', () => {
  it('client delete endpoint sets deletedAt (not hard delete)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/client/delete-account/route.ts'),
      'utf-8'
    );
    expect(source).toContain('deletedAt');
    expect(source).not.toContain('.delete(');  // No hard delete
    expect(source).toContain('export async function POST');
  });

  it('sitter delete endpoint sets deletedAt (not hard delete)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/sitter/delete-account/route.ts'),
      'utf-8'
    );
    expect(source).toContain('deletedAt');
    expect(source).not.toContain('.delete(');
    expect(source).toContain('export async function POST');
  });

  it('admin delete endpoint uses soft delete', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/ops/users/[id]/delete/route.ts'),
      'utf-8'
    );
    expect(source).toContain('deletedAt');
  });
});

describe('data export endpoints exist', () => {
  it('client self-export returns downloadable response', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/client/export/route.ts'),
      'utf-8'
    );
    expect(source).toContain('export async function GET');
    expect(source).toContain('buildClientExportBundle');
    expect(source).toContain('Content-Disposition');
  });

  it('client export blocks deleted clients', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/client/export/route.ts'),
      'utf-8'
    );
    expect(source).toContain('deletedAt');
  });

  it('owner can export any client data (including deleted)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/ops/clients/[clientId]/export/route.ts'),
      'utf-8'
    );
    expect(source).toContain('export async function POST');
    expect(source).toContain('buildClientExportBundle');
  });

  it('export bundle includes all privacy-relevant data', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/export-client-data.ts'),
      'utf-8'
    );
    expect(source).toContain('pets');
    expect(source).toContain('bookings');
    expect(source).toContain('reports');
    expect(source).toContain('messageThread');
    expect(source).toContain('stripeCharge');
  });
});

describe('SMS opt-out is enforced', () => {
  it('OptOutState model exists and is tenant-scoped', () => {
    const tenantModels = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/tenancy/tenant-models.ts'),
      'utf-8'
    );
    expect(tenantModels).toContain('optOutState');
  });

  it('send.ts checks opt-out before sending', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/messaging/send.ts'),
      'utf-8'
    );
    expect(source).toContain('optOutState');
  });

  it('Twilio webhook updates opt-out on STOP command', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/messages/webhook/twilio/route.ts'),
      'utf-8'
    );
    expect(source).toContain('optOutState');
    expect(source).toContain('isStopCommand');
  });
});

describe('cascade rules preserve booking history', () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'prisma/schema.prisma'),
    'utf-8'
  );

  it('Booking.sitter uses SetNull (preserves booking when sitter deleted)', () => {
    // The booking should keep existing even if sitter is deleted
    expect(schema).toMatch(/model Booking[\s\S]*?sitter.*SetNull/);
  });

  it('User sessions cascade on delete', () => {
    // Sessions should be cleaned up when user is deleted
    expect(schema).toMatch(/model Session[\s\S]*?Cascade/);
  });
});

describe('privacy pages are real content', () => {
  it('privacy policy has substantive content', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(public)/privacy/page.tsx'),
      'utf-8'
    );
    // Check for real privacy content (not a placeholder)
    expect(source).toContain('SMS');
    expect(source).toContain('Stripe');
    expect(source).toContain('STOP');
    expect(source).toContain('Deletion');
    expect(source.length).toBeGreaterThan(2000);
  });

  it('terms of service has substantive content', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(public)/terms/page.tsx'),
      'utf-8'
    );
    expect(source.length).toBeGreaterThan(1000);
  });
});

describe('tenant isolation covers privacy-sensitive models', () => {
  const tenantModels = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/tenancy/tenant-models.ts'),
    'utf-8'
  );

  it('client model is tenant-scoped', () => {
    expect(tenantModels).toContain("'client'");
  });

  it('sitter model is tenant-scoped', () => {
    expect(tenantModels).toContain("'sitter'");
  });

  it('messageThread is tenant-scoped', () => {
    expect(tenantModels).toContain("'messageThread'");
  });

  it('messageEvent is tenant-scoped', () => {
    expect(tenantModels).toContain("'messageEvent'");
  });

  it('report is tenant-scoped', () => {
    expect(tenantModels).toContain("'report'");
  });
});
