"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// Original tipping system colors
const TIP_COLORS = {
  pink: '#FCE1EF',
  light: '#FEECF4',
  brown: '#442F21',
};

function TipSuccessContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentIntent = searchParams.get('payment_intent');
    const sitterId = searchParams.get('sitter_id');

    if (paymentIntent && sitterId) {
      // Call transfer-tip endpoint
      fetch('/api/tip/transfer-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentIntent,
          sitterId: sitterId,
        }),
      }).catch(() => {
        // Silently handle transfer errors
      });
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: TIP_COLORS.pink, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-[500px] w-full text-center" style={{ borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '20px' }}>
        <img
          className="max-w-[140px] mx-auto mb-4"
          src="https://cdn.prod.website-files.com/678d913121365c19cdb8f056/68cb09476e07dfaa65364776_59fdb9b7-cf81-4f59-94e5-d109ed1d96c9.png"
          alt="Snout Services"
        />
        <h1 className="text-2xl font-semibold mb-4" style={{ color: TIP_COLORS.brown }}>
          Thank You!
        </h1>
        <p className="text-lg" style={{ color: TIP_COLORS.brown }}>
          Thank you for your tip, your sitter receives 100%!
        </p>
      </div>
    </div>
  );
}

export default function TipSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <TipSuccessContent />
    </Suspense>
  );
}

