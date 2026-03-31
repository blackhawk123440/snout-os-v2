/**
 * GDPR client data export. Builds a JSON bundle of all client data.
 * Used by both owner/admin export and client self-export.
 */

import type { PrismaClient } from '@prisma/client';

const toIso = (d: Date | null | undefined) =>
  d instanceof Date ? d.toISOString() : d ? String(d) : null;

export interface ClientExportBundle {
  exportedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    address: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  pets: Array<{
    id: string;
    name: string;
    species: string;
    breed: string | null;
    notes: string | null;
  }>;
  bookings: Array<{
    id: string;
    service: string;
    startAt: string;
    endAt: string;
    status: string;
    totalPrice: number;
    paymentStatus: string;
  }>;
  reports: Array<{
    id: string;
    content: string;
    mediaUrls: string | null;
    visitStarted: string | null;
    visitCompleted: string | null;
    createdAt: string | null;
    bookingId: string | null;
  }>;
  messages: Array<{
    threadId: string;
    events: Array<{
      id: string;
      body: string;
      direction: string;
      actorType: string;
      createdAt: string | null;
    }>;
  }>;
  payments: {
    charges: Array<{
      id: string;
      amount: number;
      status: string;
      createdAt: string | null;
      bookingId: string | null;
    }>;
    refunds: Array<{
      id: string;
      amount: number;
      status: string;
      chargeId: string;
      createdAt: string | null;
    }>;
  };
}

export async function buildClientExportBundle(
  db: PrismaClient | { [k: string]: unknown },
  orgId: string,
  clientId: string
): Promise<ClientExportBundle> {
  const client = await (db as any).client.findFirst({
    where: { id: clientId, orgId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  const [bookings, pets, reports, threads, charges] = await Promise.all([
    (db as any).booking.findMany({
      where: { orgId, clientId },
      select: {
        id: true,
        service: true,
        startAt: true,
        endAt: true,
        status: true,
        totalPrice: true,
        paymentStatus: true,
      },
      orderBy: { startAt: 'desc' },
    }),
    (db as any).pet.findMany({
      where: { orgId, booking: { clientId } },
      select: { id: true, name: true, species: true, breed: true, notes: true },
    }),
    (db as any).report.findMany({
      where: { orgId, booking: { clientId } },
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        visitStarted: true,
        visitCompleted: true,
        createdAt: true,
        bookingId: true,
      },
    }),
    (db as any).messageThread.findMany({
      where: { orgId, clientId },
      select: { id: true },
    }),
    (db as any).stripeCharge.findMany({
      where: { orgId, clientId },
      select: { id: true, amount: true, status: true, createdAt: true, bookingId: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ]);

  const chargeIds = charges.map((c: { id: string }) => c.id);
  const refunds =
    chargeIds.length > 0
      ? await (db as any).stripeRefund.findMany({
          where: { chargeId: { in: chargeIds } },
          select: { id: true, amount: true, status: true, chargeId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      : [];

  const threadIds = threads.map((t: { id: string }) => t.id);
  const events =
    threadIds.length > 0
      ? await (db as any).messageEvent.findMany({
          where: { orgId, threadId: { in: threadIds } },
          select: { id: true, threadId: true, body: true, direction: true, actorType: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

  const eventsByThread = new Map<string, typeof events>();
  for (const e of events) {
    const list = eventsByThread.get(e.threadId) || [];
    list.push(e);
    eventsByThread.set(e.threadId, list);
  }

  const messages = threadIds.map((tid: string) => ({
    threadId: tid,
    events: (eventsByThread.get(tid) || []).map((e: any) => ({
      id: e.id,
      body: e.body,
      direction: e.direction,
      actorType: e.actorType,
      createdAt: toIso(e.createdAt),
    })),
  }));

  return {
    exportedAt: new Date().toISOString(),
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      address: client.address,
      createdAt: toIso(client.createdAt),
      updatedAt: toIso(client.updatedAt),
    },
    pets: pets.map((p: any) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      notes: p.notes,
    })),
    bookings: bookings.map((b: any) => ({
      id: b.id,
      service: b.service,
      startAt: toIso(b.startAt),
      endAt: toIso(b.endAt),
      status: b.status,
      totalPrice: b.totalPrice,
      paymentStatus: b.paymentStatus,
    })),
    reports: reports.map((r: any) => ({
      id: r.id,
      content: r.content,
      mediaUrls: r.mediaUrls,
      visitStarted: toIso(r.visitStarted),
      visitCompleted: toIso(r.visitCompleted),
      createdAt: toIso(r.createdAt),
      bookingId: r.bookingId,
    })),
    messages,
    payments: {
      charges: charges.map((c: any) => ({
        id: c.id,
        amount: c.amount,
        status: c.status,
        createdAt: toIso(c.createdAt),
        bookingId: c.bookingId,
      })),
      refunds: refunds.map((r: any) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        chargeId: r.chargeId,
        createdAt: toIso(r.createdAt),
      })),
    },
  };
}
