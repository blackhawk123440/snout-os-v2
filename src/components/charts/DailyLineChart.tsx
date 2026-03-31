'use client';

import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { tokens } from '@/lib/design-tokens';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export type DailyPoint = { date: string; amount?: number; count?: number };

interface DailyLineChartProps {
  daily: DailyPoint[];
  valueLabel: string;
  valueKey: 'amount' | 'count';
  maxPoints?: number;
}

export function DailyLineChart({ daily, valueLabel, valueKey, maxPoints = 90 }: DailyLineChartProps) {
  const slice = daily.slice(-maxPoints);
  const labels = slice.map((d) => d.date.slice(5));
  const data = slice.map((d) => (valueKey === 'amount' ? (d.amount ?? 0) : (d.count ?? 0)));

  return (
    <div className="min-h-[200px] px-4 py-3">
      <Line
        data={{
          labels,
          datasets: [{
            label: valueLabel,
            data,
            borderColor: tokens.colors.primary?.DEFAULT ?? '#0d9488',
            backgroundColor: (tokens.colors.primary as Record<string, string>)?.[100] ?? 'rgba(13,148,136,0.1)',
            tension: 0.2,
            fill: true,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true },
            x: { ticks: { maxTicksLimit: 10 } },
          },
        }}
      />
    </div>
  );
}
