'use client';

import Link from 'next/link';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { Card, Button } from '@/components/ui';

const DIAGNOSTICS_LINKS = [
  { label: 'Automation failures', href: '/ops/automation-failures', desc: 'Failed automation jobs with retry controls' },
  { label: 'Queue failures', href: '/ops/failures', desc: 'Failed background jobs with retry controls' },
  { label: 'Message failures', href: '/ops/message-failures', desc: 'Failed SMS deliveries with retry' },
  { label: 'Payout operations', href: '/ops/payouts', desc: 'Sitter payout transfers and status' },
  { label: 'Calendar repair', href: '/ops/calendar-repair', desc: 'Fix calendar sync issues for sitters' },
  { label: 'Finance reconciliation', href: '/ops/finance/reconciliation', desc: 'Compare internal records with Stripe' },
  { label: 'AI operations', href: '/ops/ai', desc: 'AI feature controls, budget, and templates' },
  { label: 'System verification', href: '/ops/proof', desc: 'Test API connectivity and worker health' },
];

export default function OpsDiagnosticsPage() {
  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Diagnostics"
          subtitle="System health, failure recovery, and verification tools"
        />
        <Section>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DIAGNOSTICS_LINKS.map((item) => (
              <Card key={item.href}>
                <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.desc}</p>
                <div className="mt-3">
                  <Link href={item.href}>
                    <Button variant="secondary" size="sm">Open</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
