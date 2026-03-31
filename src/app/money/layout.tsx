import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Money - Snout OS',
  description: 'Payments, finance, reports, and analytics',
};

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
