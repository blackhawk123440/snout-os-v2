'use client';

/**
 * OnboardingChecklist - Enterprise setup card with progress.
 * Collapsed by default so it doesn't dominate the Today page; expand to see tasks.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import type { OnboardingChecklist, OnboardingItem } from '@/lib/onboarding';

export function OnboardingChecklist() {
  const [data, setData] = useState<OnboardingChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !data || data.total === 0) return null;
  if (data.completed >= data.total) return null;

  const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

  return (
    <div className="mb-4 rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-neutral-900">Setup</span>
        <span className="text-xs text-neutral-500">{data.completed} of {data.total} complete</span>
        <span className="shrink-0 text-neutral-400" aria-hidden>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {expanded && (
        <>
          <div className="border-t border-neutral-100 px-3 pb-2 pt-0">
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-accent-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <ul className="space-y-2 border-t border-neutral-100 px-3 pb-3 pt-2">
            {data.items.map((item) => (
              <OnboardingItemRow key={item.key} item={item} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function OnboardingItemRow({ item }: { item: OnboardingItem }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {item.done ? (
        <span className="text-emerald-600" aria-hidden="true">
          <CheckCircle2 className="w-4 h-4" />
        </span>
      ) : (
        <span className="text-neutral-400" aria-hidden="true">
          <Circle className="w-1.5 h-1.5" />
        </span>
      )}
      <span className={item.done ? 'text-neutral-500' : 'text-neutral-900'}>
        {item.label}
      </span>
      {!item.done && (
        <Link
          href={item.href}
          className="ml-auto text-xs font-medium text-accent-primary hover:underline"
        >
          {item.label.includes('Connect') || item.label.includes('Add') ? 'Go' : 'Complete'}
        </Link>
      )}
    </li>
  );
}
