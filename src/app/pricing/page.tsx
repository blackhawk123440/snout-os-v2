'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';

export default function Pricing() {
  const router = useRouter();
  const [personalMode] = useState(process.env.NEXT_PUBLIC_PERSONAL_MODE === 'true');

  const tiers = [
    { name: 'Solo', price: 29, features: ['1 location', 'Basic AI reports', 'Unlimited clients'] },
    { name: 'Pro', price: 99, features: ['Up to 5 locations', 'Full AI delight + matching', 'Loyalty program'] },
    { name: 'Enterprise', price: 299, features: ['Unlimited locations', 'White-label', 'Dedicated support', '15% marketplace fee'] },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-24">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h1 className="text-6xl font-bold mb-4">Simple pricing that grows with you</h1>
        <p className="text-2xl text-zinc-400 mb-16">Start free for 14 days. No credit card required.</p>

        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map(tier => (
            <div key={tier.name} className="bg-zinc-900 rounded-3xl p-10 border border-zinc-800 hover:border-amber-500 transition">
              <h3 className="text-3xl font-semibold mb-2">{tier.name}</h3>
              <div className="text-6xl font-bold mb-8">${tier.price}<span className="text-xl font-normal">/mo</span></div>
              <ul className="space-y-4 text-left mb-12">
                {tier.features.map(f => (
                  <li key={f} className="flex items-center gap-3">✅ {f}</li>
                ))}
              </ul>
              <Button
                variant="primary"
                className="w-full py-4 rounded-2xl bg-white text-black font-semibold hover:bg-amber-400"
                disabled={personalMode && tier.name === 'Solo'}
                onClick={() => router.push('/login')}
              >
                {personalMode && tier.name === 'Solo' ? 'Already using Solo' : 'Start free trial'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
