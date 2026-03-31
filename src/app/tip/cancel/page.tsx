"use client";

import Link from "next/link";

// Original tipping system colors
const TIP_COLORS = {
  pink: '#FCE1EF',
  light: '#FEECF4',
  brown: '#442F21',
};

export default function TipCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: TIP_COLORS.brown }}>
      <div className="max-w-md w-full">
        <h2 className="text-2xl font-semibold mb-4" style={{ color: TIP_COLORS.brown }}>Payment canceled</h2>
        <p className="mb-4" style={{ color: TIP_COLORS.brown }}>No charge was made.</p>
        <Link
          href="/tip/payment"
          style={{ color: TIP_COLORS.brown, textDecoration: 'underline' }}
        >
          Try again
        </Link>
      </div>
    </div>
  );
}

