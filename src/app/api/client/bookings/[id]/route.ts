import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { buildClientFacingSitterProfile } from '@/lib/sitter-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const booking = await db.booking.findFirst({
      where: { id, clientId: ctx.clientId },
      include: {
        pets: { select: { id: true, name: true, species: true } },
        sitter: { select: { firstName: true, lastName: true, currentTierId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const paidCharge = await db.stripeCharge.findFirst({
      where: {
        bookingId: booking.id,
        status: 'succeeded',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        currency: true,
        paymentIntentId: true,
      },
    });

    // Resolve sitter tier name
    let sitterInfo: { name: string; tier: string | null } | null = null;
    if (booking.sitter) {
      let tierName: string | null = null;
      if (booking.sitter.currentTierId) {
        const tier = await db.sitterTier.findUnique({
          where: { id: booking.sitter.currentTierId },
          select: { name: true },
        });
        tierName = tier?.name ?? null;
      }
      // Build client-facing trust profile from SRS snapshot
      let sitterProfile: { tierLabel: string | null; statements: string[] } | null = null;
      try {
        const sitterId = (booking as any).sitterId;
        if (sitterId) {
          const snapshot = await (db as any).sitterTierSnapshot.findFirst({
            where: { orgId: ctx.orgId, sitterId },
            orderBy: { asOfDate: 'desc' },
            select: { tier: true, rolling30dBreakdownJson: true, visits30d: true },
          });
          if (snapshot) {
            const completedVisits = await db.booking.count({
              where: { sitterId, status: 'completed' },
            });
            sitterProfile = buildClientFacingSitterProfile(snapshot, completedVisits);
          }
        }
      } catch { /* SRS data optional — degrade gracefully */ }

      sitterInfo = {
        name: `${booking.sitter.firstName} ${booking.sitter.lastName}`.trim(),
        tier: tierName,
        ...(sitterProfile ? { profile: sitterProfile } : {}),
      };
    }

    // Find associated report (if visit is completed and report exists)
    const report = await db.report.findFirst({
      where: { bookingId: booking.id },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
    return NextResponse.json({
      id: booking.id,
      service: booking.service,
      startAt: toIso(booking.startAt),
      endAt: toIso(booking.endAt),
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      totalPrice: Number(booking.totalPrice),
      address: booking.address,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pets: (booking.pets || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        species: p.species,
      })),
      pricingSnapshot: booking.pricingSnapshot || null,
      sitter: sitterInfo,
      checkedInAt: await (async () => {
        const ve = await db.visitEvent.findFirst({
          where: { bookingId: booking.id },
          select: { checkInAt: true },
          orderBy: { createdAt: 'desc' },
        });
        return ve?.checkInAt ? toIso(ve.checkInAt) : null;
      })(),
      reportId: report?.id ?? null,
      paymentProof: paidCharge
        ? {
            status: 'paid',
            amount: Number(paidCharge.amount) / 100,
            paidAt: toIso(paidCharge.createdAt),
            bookingReference: booking.id,
            invoiceReference: paidCharge.id,
            paymentIntentId: paidCharge.paymentIntentId ?? null,
            currency: paidCharge.currency || 'usd',
            receiptLink: null,
            inferred: false,
          }
        : booking.paymentStatus === 'paid'
          ? {
              status: 'paid',
              amount: Number(booking.totalPrice),
              paidAt: toIso(booking.updatedAt),
              bookingReference: booking.id,
              invoiceReference: 'legacy-import',
              paymentIntentId: null,
              currency: 'usd',
              receiptLink: null,
              inferred: true,
            }
          : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load booking', message },
      { status: 500 }
    );
  }
}
