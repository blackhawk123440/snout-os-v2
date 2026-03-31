import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const clientId = searchParams.get('clientId') || undefined;

  try {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const schedules = await db.recurringSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Enrich with client names
    const clientIds = [...new Set(schedules.map((s: any) => s.clientId).filter(Boolean))];
    const clients = clientIds.length
      ? await db.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const clientMap = new Map(clients.map((c: any) => [c.id, c]));

    const sitterIds = [...new Set(schedules.map((s: any) => s.sitterId).filter(Boolean))];
    const sitters = sitterIds.length
      ? await db.sitter.findMany({
          where: { id: { in: sitterIds as string[] } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const sitterMap = new Map(sitters.map((s: any) => [s.id, s]));

    return NextResponse.json({
      schedules: schedules.map((s: any) => {
        const client = clientMap.get(s.clientId);
        const sitter = s.sitterId ? sitterMap.get(s.sitterId) : null;
        return {
          ...s,
          effectiveFrom: s.effectiveFrom?.toISOString?.() ?? s.effectiveFrom,
          effectiveUntil: s.effectiveUntil?.toISOString?.() ?? null,
          lastGeneratedAt: s.lastGeneratedAt?.toISOString?.() ?? null,
          createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
          clientName: client ? `${client.firstName} ${client.lastName}`.trim() : 'Unknown',
          sitterName: sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : null,
        };
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load schedules', message }, { status: 500 });
  }
}

const CreateScheduleSchema = z.object({
  clientId: z.string().min(1),
  sitterId: z.string().optional(),
  service: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().optional(),
  effectiveFrom: z.string(),
  effectiveUntil: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  totalPrice: z.number().min(0),
  afterHours: z.boolean().optional(),
  holiday: z.boolean().optional(),
  petIds: z.array(z.string()).optional(),
  invoicingMode: z.enum(['per_visit', 'weekly', 'monthly']).optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateScheduleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });

    const db = getScopedDb(ctx);
    const d = parsed.data;

    const schedule = await db.recurringSchedule.create({
      data: {
        orgId: ctx.orgId,
        clientId: d.clientId,
        sitterId: d.sitterId || null,
        service: d.service,
        frequency: d.frequency,
        daysOfWeek: d.daysOfWeek ? JSON.stringify(d.daysOfWeek) : null,
        startTime: d.startTime,
        endTime: d.endTime,
        duration: d.duration ?? null,
        effectiveFrom: new Date(d.effectiveFrom),
        effectiveUntil: d.effectiveUntil ? new Date(d.effectiveUntil) : null,
        address: d.address || null,
        notes: d.notes || null,
        totalPrice: d.totalPrice,
        afterHours: d.afterHours ?? false,
        holiday: d.holiday ?? false,
        petIds: d.petIds ? JSON.stringify(d.petIds) : null,
        invoicingMode: d.invoicingMode || 'per_visit',
      },
    });

    return NextResponse.json({ id: schedule.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create schedule', message }, { status: 500 });
  }
}
