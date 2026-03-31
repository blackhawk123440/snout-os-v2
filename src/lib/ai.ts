import OpenAI from 'openai';
import { prisma } from './db';
import { governedAICall } from './ai/governed-call';
import { getPromptTemplate } from './ai/governance';

function substituteTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

export const ai = {
  async generateDailyDelight(petId: string, bookingId: string, tone?: 'warm' | 'playful' | 'professional', callerOrgId?: string) {
    const pet = callerOrgId
      ? await (prisma as any).pet.findFirst({
          where: { id: petId, orgId: callerOrgId },
          include: { booking: { include: { client: true } } },
        })
      : await prisma.pet.findUnique({
          where: { id: petId },
          include: { booking: { include: { client: true } } },
        });
    if (!pet) return "Couldn't generate report";

    const orgId = callerOrgId ?? pet.booking?.client?.orgId ?? 'default';

    if (!getOpenAI()) return "Mojo had a great day! (OpenAI not configured)";

    const tonePrompt =
      tone === 'playful'
        ? 'Write a playful, fun 2-sentence daily delight report. Use light humor and energy.'
        : tone === 'professional'
          ? 'Write a concise, professional 2-sentence daily delight report. Keep it informative and reassuring.'
          : 'Write a warm, fun 2-sentence daily delight report. Make it emotional and shareable.';

    const template = await getPromptTemplate({ orgId, key: 'daily_delight' });
    const prompt = template
      ? substituteTemplate(template.template, { tonePrompt, petName: pet.name, breed: pet.breed ?? 'pet' })
      : `${tonePrompt} For ${pet.name} (${pet.breed ?? 'pet'}).`;

    const result = await governedAICall({
      orgId,
      featureKey: 'daily_delight',
      promptKey: 'daily_delight',
      promptVersion: template?.version ?? 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const report = result.content ?? "Mojo had a great day!";

    await prisma.petHealthLog.create({
      data: {
        petId,
        orgId,
        note: report,
        type: 'daily',
      },
    });

    return report;
  },

  async matchSitterToPet(petId: string, availableSitters: { id: string; [key: string]: unknown }[], orgId: string = 'default') {
    const pet = await (prisma as any).pet.findFirst({ where: { id: petId, orgId } });
    if (!pet || availableSitters.length === 0) return null;

    const oid = orgId;
    if (!getOpenAI()) return availableSitters[0]?.id ?? null;

    const energyHint = pet.notes ?? 'moderate';
    const sitterIds = availableSitters.map((s) => s.id).join(', ');
    const template = await getPromptTemplate({ orgId: oid, key: 'sitter_match' });
    const defaultPrompt = `Rank these sitter IDs for a ${pet.breed ?? 'pet'} that needs ${energyHint} energy. Sitter IDs: ${sitterIds}. Return only the best sitter ID.`;
    const prompt = template
      ? substituteTemplate(template.template, { breed: pet.breed ?? 'pet', energyHint, sitterIds })
      : defaultPrompt;

    try {
      const result = await governedAICall({
        orgId: oid,
        featureKey: 'sitter_match',
        promptKey: 'sitter_match',
        promptVersion: template?.version ?? 0,
        messages: [{ role: 'user', content: prompt }],
      });
      const bestId = result.content?.trim();
      return availableSitters.find((s) => s.id === bestId)?.id ?? availableSitters[0]?.id ?? null;
    } catch {
      return availableSitters[0]?.id ?? null;
    }
  },

  // dynamic pricing, sentiment analysis, predictive alerts — all here
};

export interface SitterSuggestion {
  sitterId: string;
  firstName: string;
  lastName: string;
  score: number;
  reasons: string[];
}

/**
 * Get AI-ranked sitter suggestions for a booking
 */
export async function getSitterSuggestionsForBooking(
  bookingId: string,
  orgId: string
): Promise<SitterSuggestion[]> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, orgId },
    include: {
      pets: true,
      timeSlots: true,
      sitter: true,
    },
  });

  if (!booking) return [];

  const sitters = await prisma.sitter.findMany({
    where: { orgId, active: true },
    select: { id: true, firstName: true, lastName: true },
  });

  if (sitters.length === 0) return [];

  if (!getOpenAI()) {
    return sitters.slice(0, 5).map((s, i) => ({
      sitterId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      score: 100 - i * 10,
      reasons: ['Available sitter'],
    }));
  }

  const petBreeds = booking.pets.map((p) => p.breed || p.species).join(', ');
  const petNotes = booking.pets.map((p) => p.notes).filter(Boolean).join('; ') || 'none';
  const sitterList = sitters.map((s) => `${s.id}: ${s.firstName} ${s.lastName}`).join('\n');

  const template = await getPromptTemplate({ orgId, key: 'sitter_suggestions' });
  const defaultPrompt = `You are matching sitters to a pet care booking.
Booking: ${booking.service}, pets: ${petBreeds}. Pet notes: ${petNotes}.
Available sitters:
${sitterList}

Return a JSON array of objects: [{ "sitterId": "uuid", "score": 0-100, "reasons": ["reason1", "reason2"] }]
Rank by: fit for breed/energy, proximity (if known), history. Return max 5. Only valid sitter IDs.`;
  const prompt = template
    ? substituteTemplate(template.template, { service: booking.service, petBreeds, petNotes, sitterList })
    : defaultPrompt;

  let raw = '{}';
  try {
    const result = await governedAICall({
      orgId,
      featureKey: 'sitter_suggestions',
      promptKey: 'sitter_suggestions',
      promptVersion: template?.version ?? 0,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
    });
    raw = result.content ?? '{}';
  } catch {
    return sitters.slice(0, 5).map((s, i) => ({
      sitterId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      score: 100 - i * 10,
      reasons: ['Available sitter'],
    }));
  }
  let parsed: { suggestions?: Array<{ sitterId: string; score: number; reasons: string[] }> };
  try {
    parsed = JSON.parse(raw);
    if (!parsed.suggestions) parsed = { suggestions: [parsed as any] };
  } catch {
    parsed = { suggestions: [] };
  }

  const suggestions = (parsed.suggestions || []).slice(0, 5).map((s) => {
    const sitter = sitters.find((x) => x.id === s.sitterId) ?? sitters[0];
    return {
      sitterId: sitter.id,
      firstName: sitter.firstName,
      lastName: sitter.lastName,
      score: typeof s.score === 'number' ? s.score : 80,
      reasons: Array.isArray(s.reasons) ? s.reasons : ['Good match'],
    };
  });

  return suggestions;
}

/**
 * Deterministic revenue forecast (moving average) + optional AI commentary.
 * Returns fast; AI commentary only when includeAi=true (don't block on OpenAI).
 */
export async function getRevenueForecast(
  orgId: string,
  rangeDays: number = 90,
  includeAi: boolean = false
): Promise<{ daily: { date: string; amount: number }[]; aiCommentary: string }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - rangeDays);

  const bookings = await prisma.booking.findMany({
    where: {
      orgId,
      status: 'completed',
      paymentStatus: 'paid',
      startAt: { gte: start, lte: end },
    },
    select: { startAt: true, totalPrice: true },
  });

  const byDate = new Map<string, number>();
  for (const b of bookings) {
    const d = b.startAt.toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + b.totalPrice);
  }

  const sortedDates = [...byDate.keys()].sort();
  const daily = sortedDates.map((date) => ({
    date,
    amount: byDate.get(date) ?? 0,
  }));

  const total = daily.reduce((s, d) => s + d.amount, 0);
  const avgDaily = daily.length > 0 ? total / daily.length : 0;

  let aiCommentary = `Historical average: $${avgDaily.toFixed(2)}/day over ${daily.length} days with revenue.`;
  if (includeAi && getOpenAI() && daily.length >= 7) {
    try {
      const template = await getPromptTemplate({ orgId, key: 'revenue_forecast' });
      const defaultContent = `Pet care business revenue last ${rangeDays}d: total $${total.toFixed(2)}, ${daily.length} days with revenue. Avg $${avgDaily.toFixed(2)}/day. In 1-2 sentences, give a brief forecast or trend insight.`;
      const prompt = template
        ? substituteTemplate(template.template, { rangeDays: String(rangeDays), total: total.toFixed(2), daysWithRevenue: String(daily.length), avgDaily: avgDaily.toFixed(2) })
        : defaultContent;

      const result = await governedAICall({
        orgId,
        featureKey: 'revenue_forecast',
        promptKey: 'revenue_forecast',
        promptVersion: template?.version ?? 0,
        messages: [{ role: 'user', content: prompt }],
      });
      aiCommentary = result.content ?? aiCommentary;
    } catch {
      // Fallback to deterministic on OpenAI failure
    }
  }

  return { daily, aiCommentary };
}

export default ai;
