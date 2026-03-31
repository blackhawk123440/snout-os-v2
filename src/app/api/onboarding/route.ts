/**
 * GET /api/onboarding
 * Returns onboarding checklist for current user's role.
 * Completion inferred from DB state (no new tables).
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface OnboardingChecklist {
  items: OnboardingItem[];
  completed: number;
  total: number;
}

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    if (ctx.role === 'owner' || ctx.role === 'admin') {
      const [stripeConnected, sitterCount, bookingCount, calendarConnected] = await Promise.all([
        db.stripeCharge.count({ where: {} }).then((c) => c > 0),
        db.sitter.count({ where: {} }),
        db.booking.count({ where: {} }),
        db.sitter.findFirst({ where: { googleAccessToken: { not: null } } }).then((s) => !!s),
      ]);

      const items: OnboardingItem[] = [
        { key: 'stripe', label: 'Connect Stripe', done: stripeConnected, href: '/integrations' },
        { key: 'sitter', label: 'Add first sitter', done: sitterCount > 0, href: '/sitters' },
        { key: 'booking', label: 'Create first booking', done: bookingCount > 0, href: '/bookings/new' },
        { key: 'calendar', label: 'Connect calendar', done: calendarConnected, href: '/calendar/accounts' },
      ];
      const completed = items.filter((i) => i.done).length;
      return NextResponse.json({ items, completed, total: items.length } satisfies OnboardingChecklist);
    }

    if (ctx.role === 'sitter' && ctx.sitterId) {
      const [profileComplete, stripeConnected, availabilitySet, hasMessageOrVisit] = await Promise.all([
        db.sitter.findFirst({
          where: { id: ctx.sitterId },
          select: { firstName: true, lastName: true, phone: true },
        }).then((s) => !!(s?.firstName && s?.lastName)),
        db.sitterStripeAccount.findFirst({
          where: { sitterId: ctx.sitterId },
          select: { id: true, payoutsEnabled: true },
        }).then((a) => !!(a?.payoutsEnabled)),
        db.sitterAvailabilityRule.count({ where: { sitterId: ctx.sitterId } }).then((c) => c > 0),
        Promise.all([
          db.messageEvent.count({ where: { thread: { assignedSitterId: ctx.sitterId } } }),
          db.booking.count({ where: { sitterId: ctx.sitterId, status: 'completed' } }),
        ]).then(([msg, vis]) => msg > 0 || vis > 0),
      ]);

      const items: OnboardingItem[] = [
        { key: 'profile', label: 'Complete profile', done: profileComplete, href: '/sitter/profile' },
        { key: 'payouts', label: 'Connect payouts', done: stripeConnected, href: '/sitter/profile' },
        { key: 'availability', label: 'Set availability', done: availabilitySet, href: '/sitter/availability' },
        { key: 'first_visit', label: 'Send first message or complete first visit', done: hasMessageOrVisit, href: '/sitter/inbox' },
      ];
      const completed = items.filter((i) => i.done).length;
      return NextResponse.json({ items, completed, total: items.length } satisfies OnboardingChecklist);
    }

    if (ctx.role === 'client' && ctx.clientId) {
      const [petCount, bookingCount, reportCount] = await Promise.all([
        db.pet.count({ where: { booking: { clientId: ctx.clientId } } }),
        db.booking.count({ where: { clientId: ctx.clientId } }),
        db.report.count({
          where: { booking: { clientId: ctx.clientId } },
        }),
      ]);

      const items: OnboardingItem[] = [
        { key: 'pet', label: 'Add pet', done: petCount > 0, href: '/client/pets' },
        { key: 'booking', label: 'Create booking', done: bookingCount > 0, href: '/client/bookings' },
        { key: 'report', label: 'View first report', done: reportCount > 0, href: '/client/reports' },
      ];
      const completed = items.filter((i) => i.done).length;
      return NextResponse.json({ items, completed, total: items.length } satisfies OnboardingChecklist);
    }

    return NextResponse.json({ items: [], completed: 0, total: 0 } satisfies OnboardingChecklist);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load onboarding', message }, { status: 500 });
  }
}
