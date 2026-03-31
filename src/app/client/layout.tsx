import type { Metadata } from 'next';
import { ClientAppShell } from '@/components/layout/ClientAppShell';

export const metadata: Metadata = {
  title: 'Client Portal - Snout OS',
  description: 'Your pet care portal',
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientAppShell>{children}</ClientAppShell>;
}
