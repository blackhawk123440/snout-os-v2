/**
 * POST /api/sitter/bookings/[id]/report-assist
 * AI-powered report expansion. Takes bullet points and generates
 * a professional 2-3 sentence visit report.
 * Uses AI governance layer for budget and usage tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { governedAICall } from '@/lib/ai/governed-call';
import { getPromptTemplate } from '@/lib/ai/governance';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id: bookingId } = await params;
    const db = getScopedDb(ctx);

    const booking = await db.booking.findFirst({
      where: { id: bookingId, sitterId: ctx.sitterId },
      select: { id: true, service: true, pets: { select: { name: true, species: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { bulletPoints, petNames } = body as { bulletPoints: string; petNames?: string[] };

    if (!bulletPoints?.trim()) {
      return NextResponse.json({ error: 'No bullet points provided' }, { status: 400 });
    }

    const petNameList = petNames?.length
      ? petNames.join(' and ')
      : booking.pets?.map((p: any) => p.name).filter(Boolean).join(' and ') || 'the pet';

    const template = await getPromptTemplate({ orgId: ctx.orgId, key: 'report_assist' });
    const defaultPrompt = `You are a professional pet sitter writing a visit report for a client. The pet's name is ${petNameList}. The service was ${booking.service}.

Based on these notes from the sitter, write a warm, professional 2-3 sentence visit report that a pet parent would love to read. Use the pet's name. Be specific and personal, not generic.

Sitter's notes:
${bulletPoints}

Write the report now. No headers, no sign-off — just the report paragraph.`;

    const prompt = template?.template
      ? template.template
          .replace('{{petNames}}', petNameList)
          .replace('{{service}}', booking.service || 'visit')
          .replace('{{bulletPoints}}', bulletPoints)
      : defaultPrompt;

    const result = await governedAICall({
      orgId: ctx.orgId,
      featureKey: 'report_assist',
      promptKey: 'report_assist',
      promptVersion: template?.version ?? 0,
      messages: [{ role: 'user', content: prompt }],
    });

    return NextResponse.json({
      data: {
        expandedReport: result.content || bulletPoints,
        tokensUsed: (result as any).tokensUsed ?? 0,
      },
    });
  } catch (error: any) {
    console.error('[report-assist] Error:', error);
    if (error?.message?.includes('budget') || error?.message?.includes('limit')) {
      return NextResponse.json({ error: 'AI budget limit reached' }, { status: 402 });
    }
    return NextResponse.json(
      { error: 'Failed to generate report', message: error?.message },
      { status: 500 }
    );
  }
}
