import { prisma } from '@/lib/db';
import { whereOrg } from '@/lib/org-scope';

export interface ChurnRiskClient {
  clientId: string;
  clientName: string;
  lastBookingDate: string;
  daysSinceLastBooking: number;
  totalBookings: number;
  lifetimeValue: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export async function detectChurnRisk(orgId: string): Promise<ChurnRiskClient[]> {
  const now = new Date();

  const clients = await (prisma as any).client.findMany({
    where: whereOrg(orgId, { deletedAt: null }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lastBookingAt: true,
      lifetimeValue: true,
    },
  });

  const results: ChurnRiskClient[] = [];

  for (const client of clients) {
    if (!client.lastBookingAt) continue;

    const lastDate = new Date(client.lastBookingAt);
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince < 30) continue; // Not at risk

    const totalBookings = await (prisma as any).booking.count({
      where: whereOrg(orgId, { clientId: client.id }),
    });

    if (totalBookings === 0) continue;

    const riskLevel: 'low' | 'medium' | 'high' =
      daysSince >= 60 ? 'high' : 'medium';

    results.push({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      lastBookingDate: lastDate.toISOString(),
      daysSinceLastBooking: daysSince,
      totalBookings,
      lifetimeValue: client.lifetimeValue || 0,
      riskLevel,
    });
  }

  return results.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    return b.lifetimeValue - a.lifetimeValue;
  });
}
