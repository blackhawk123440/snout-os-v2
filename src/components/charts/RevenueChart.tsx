'use client';

import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { tokens } from '@/lib/design-tokens';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface RevenueChartProps {
  daily: { date: string; amount: number }[];
  aiCommentary?: string;
}

export function RevenueChart({ daily, aiCommentary }: RevenueChartProps) {
  const labels = daily.slice(-30).map((d) => d.date.slice(5));
  const data = daily.slice(-30).map((d) => d.amount);

  return (
    <>
      <div style={{ padding: 16, minHeight: 200 }}>
        <Line
          data={{
            labels,
            datasets: [{
              label: 'Revenue ($)',
              data,
              borderColor: tokens.colors.primary.DEFAULT,
              backgroundColor: tokens.colors.primary[100],
              tension: 0.2,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
          }}
        />
      </div>
      {aiCommentary && (
        <div style={{
          padding: 16,
          paddingTop: 0,
          fontSize: 14,
          color: tokens.colors.text.secondary,
          fontStyle: 'italic',
        }}>
          {aiCommentary}
        </div>
      )}
    </>
  );
}
