'use client';

import { Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { SitterCard, SitterCardHeader, SitterCardBody, SitterPageHeader } from '@/components/sitter';
import { useSitterPerformance } from '@/lib/api/sitter-portal-hooks';

interface SrsPayload {
  tier: string;
  score: number;
  rolling26w?: number | null;
  provisional: boolean;
  atRisk: boolean;
  atRiskReason?: string;
  visits30d: number;
  breakdown: Record<string, number>;
  nextActions: string[];
  compensation?: { basePay: number; nextReviewDate?: string } | null;
  perks?: string[];
  avgResponseTimeMinutes?: number;
  last5ResponseTimes?: number[];
  responseTimeTrend?: number;
  completedBookings30d?: number;
  avgClientRating?: number;
  reviewCount?: number;
  tierThresholds?: Record<string, number>;
}

const METRICS = [
  { key: 'responsiveness', label: 'Responsiveness', max: 20 },
  { key: 'acceptance', label: 'Acceptance', max: 12 },
  { key: 'completion', label: 'Completion', max: 8 },
  { key: 'timeliness', label: 'Timeliness', max: 20 },
  { key: 'accuracy', label: 'Accuracy', max: 20 },
  { key: 'engagement', label: 'Engagement', max: 10 },
  { key: 'conduct', label: 'Conduct', max: 10 },
];

const TIER_BENEFITS = [
  { tier: 'foundation', label: 'Foundation', commission: '70%', perks: ['Basic assignments'] },
  { tier: 'reliant', label: 'Reliant', commission: '75%', perks: ['Priority booking', 'Reduced oversight'] },
  { tier: 'trusted', label: 'Trusted', commission: '80%', perks: ['Holiday pay', 'Mentorship access', 'Priority booking'] },
  { tier: 'preferred', label: 'Preferred', commission: '85%', perks: ['Top priority', 'Holiday pay', 'Mentorship', 'Pool leadership'] },
];

const tierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'preferred': return 'bg-status-warning-bg text-status-warning-text border-status-warning-border';
    case 'trusted': return 'bg-status-info-bg text-status-info-text border-status-info-border';
    case 'reliant': return 'bg-status-success-bg text-status-success-text border-status-success-border';
    default: return 'bg-surface-tertiary text-text-secondary border-border-default';
  }
};

export default function SitterPerformancePage() {
  const { data, isLoading: loading, error } = useSitterPerformance();

  const tierLabel = data ? data.tier.charAt(0).toUpperCase() + data.tier.slice(1) : 'Foundation';

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader title="Performance" subtitle="Loading..." />
        <div className="space-y-4">{[1, 2, 3].map((i) => (<SitterCard key={i}><SitterCardBody><div className="h-20 animate-pulse rounded bg-surface-tertiary" /></SitterCardBody></SitterCard>))}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader title="Performance" subtitle="Your metrics" />
        <SitterCard><SitterCardBody><p className="text-sm text-status-danger-text-secondary">Unable to load performance data</p></SitterCardBody></SitterCard>
      </div>
    );
  }

  const thresholds = data.tierThresholds || {};

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader title="Performance" subtitle="Your Service Reliability Score and tier progress" />
      <div className="space-y-4">

        {/* Section 1: Tier Hero */}
        <SitterCard>
          <SitterCardBody>
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl font-bold ${tierColor(data.tier)}`}>
                {tierLabel.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-text-primary">{tierLabel} Tier</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-3 overflow-hidden rounded-full bg-surface-tertiary">
                    <div className="h-full rounded-full bg-accent-primary transition-[width]" style={{ width: `${data.score}%` }} />
                  </div>
                  <span className="text-sm font-bold text-text-primary tabular-nums">{data.score.toFixed(1)}</span>
                </div>
                {data.rolling26w != null && <p className="mt-0.5 text-xs text-text-tertiary">26-week average: {data.rolling26w.toFixed(1)}</p>}
                {data.provisional && <p className="mt-0.5 text-xs text-status-warning-text-secondary">Provisional \u2014 complete 15+ visits to activate</p>}
                {data.atRisk && <p className="mt-0.5 text-xs text-status-danger-text-secondary">At risk: {data.atRiskReason || 'Below tier minimum'}</p>}
              </div>
            </div>
          </SitterCardBody>
        </SitterCard>

        {/* Section 2: Response Time */}
        <SitterCard>
          <SitterCardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-text-tertiary" />
              <h3 className="font-semibold text-text-primary">Response Time</h3>
            </div>
          </SitterCardHeader>
          <SitterCardBody>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-text-primary tabular-nums">{data.avgResponseTimeMinutes?.toFixed(1) || '0'}</p>
              <p className="text-sm text-text-secondary">minutes avg</p>
            </div>
            {data.responseTimeTrend != null && data.responseTimeTrend !== 0 && (
              <p className={`mt-1 text-xs font-medium ${data.responseTimeTrend < 0 ? 'text-status-success-text-secondary' : 'text-status-warning-text-secondary'}`}>
                {data.responseTimeTrend < 0 ? '\u2193' : '\u2191'} {Math.abs(data.responseTimeTrend)}% vs last month
              </p>
            )}
            {data.last5ResponseTimes && data.last5ResponseTimes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-text-tertiary mb-1">Last 5 responses:</p>
                <div className="flex gap-2">
                  {data.last5ResponseTimes.map((t: number, i: number) => (
                    <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${t <= 15 ? 'bg-status-success-bg text-status-success-text' : t <= 30 ? 'bg-status-warning-bg text-status-warning-text' : 'bg-status-danger-bg text-status-danger-text'}`}>
                      {t}m {t <= 15 ? <CheckCircle className="inline w-3 h-3 ml-0.5" /> : <AlertTriangle className="inline w-3 h-3 ml-0.5" />}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-text-tertiary">Tier requires: respond within 15 minutes</p>
          </SitterCardBody>
        </SitterCard>

        {/* Section 3: All 7 Metrics */}
        <SitterCard>
          <SitterCardHeader><h3 className="font-semibold text-text-primary">Score Breakdown</h3></SitterCardHeader>
          <SitterCardBody>
            <div className="space-y-3">
              {METRICS.map((m) => {
                const value = data.breakdown?.[m.key] ?? 0;
                const threshold = thresholds[m.key] ?? m.max * 0.75;
                const meetsThreshold = value >= threshold;
                const pct = Math.min(100, (value / m.max) * 100);
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-text-secondary">{m.label}</span>
                      <span className="text-xs tabular-nums text-text-primary">
                        {value.toFixed(1)}/{m.max} {meetsThreshold ? <CheckCircle className="inline w-3 h-3 ml-0.5 text-status-success-text" /> : <AlertTriangle className="inline w-3 h-3 ml-0.5 text-status-warning-text" />}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
                      <div className={`h-full rounded-full transition-[width] ${meetsThreshold ? 'bg-status-success-fill' : 'bg-status-warning-fill'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SitterCardBody>
        </SitterCard>

        {/* Section 4: Earnings */}
        <SitterCard>
          <SitterCardHeader><h3 className="font-semibold text-text-primary">Earnings & Ratings</h3></SitterCardHeader>
          <SitterCardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border-default bg-surface-secondary p-3">
                <p className="text-xs text-text-tertiary">Visits (30d)</p>
                <p className="text-lg font-semibold text-text-primary">{data.completedBookings30d ?? data.visits30d}</p>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-secondary p-3">
                <p className="text-xs text-text-tertiary">Client rating</p>
                <p className="text-lg font-semibold text-text-primary">
                  {data.avgClientRating ? `${data.avgClientRating} \u2605` : 'N/A'}
                </p>
                {data.reviewCount != null && <p className="text-[10px] text-text-disabled">{data.reviewCount} review{data.reviewCount !== 1 ? 's' : ''}</p>}
              </div>
              {data.compensation && (
                <div className="rounded-xl border border-border-default bg-surface-secondary p-3">
                  <p className="text-xs text-text-tertiary">Commission</p>
                  <p className="text-lg font-semibold text-text-primary">{data.compensation.basePay}%</p>
                </div>
              )}
            </div>
          </SitterCardBody>
        </SitterCard>

        {/* Section 5: How to Level Up */}
        {data.nextActions?.length > 0 && (
          <SitterCard>
            <SitterCardHeader><h3 className="font-semibold text-text-primary">How to Level Up</h3></SitterCardHeader>
            <SitterCardBody>
              <div className="space-y-2">
                {data.nextActions.map((action: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-accent-primary text-sm shrink-0 mt-0.5">{'\u2192'}</span>
                    <p className="text-sm text-text-secondary">{action}</p>
                  </div>
                ))}
              </div>
            </SitterCardBody>
          </SitterCard>
        )}

        {/* Section 6: Tier Benefits Comparison */}
        <SitterCard>
          <SitterCardHeader><h3 className="font-semibold text-text-primary">Tier Benefits</h3></SitterCardHeader>
          <SitterCardBody>
            <div className="space-y-2">
              {TIER_BENEFITS.map((t) => {
                const isCurrent = t.tier === data.tier.toLowerCase();
                const isLocked = TIER_BENEFITS.findIndex((x) => x.tier === t.tier) > TIER_BENEFITS.findIndex((x) => x.tier === data.tier.toLowerCase());
                return (
                  <div key={t.tier} className={`rounded-xl border p-3 ${isCurrent ? 'border-accent-primary bg-accent-tertiary/20' : isLocked ? 'border-border-muted opacity-50' : 'border-border-default'}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${isCurrent ? 'text-accent-primary' : 'text-text-primary'}`}>
                        {t.label} {isCurrent && '\u2190 You'}
                      </p>
                      <span className="text-xs text-text-secondary">{t.commission} commission</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-tertiary">{t.perks.join(' \u00b7 ')}</p>
                  </div>
                );
              })}
            </div>
          </SitterCardBody>
        </SitterCard>
      </div>
    </div>
  );
}
