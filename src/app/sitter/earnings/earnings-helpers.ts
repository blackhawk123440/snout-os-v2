export interface TransferLike {
  amount: number;
  status: string;
  createdAt: string;
}

export function calculateTransferSummary(transfers: TransferLike[], now: Date = new Date()) {
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pendingCents = transfers
    .filter((t) => t.status !== 'paid')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const paid30dCents = transfers
    .filter((t) => t.status === 'paid' && new Date(t.createdAt) >= thirtyDaysAgo)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const lastPaidAt = transfers
    .filter((t) => t.status === 'paid')
    .map((t) => new Date(t.createdAt))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const nextPayoutDate = lastPaidAt ? new Date(lastPaidAt.getTime() + 7 * 24 * 60 * 60 * 1000) : null;

  return {
    pendingCents,
    paid30dCents,
    nextPayoutDate,
    hasPaidHistory: !!lastPaidAt,
  };
}
