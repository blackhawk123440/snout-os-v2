'use client';

import Link from 'next/link';
import { MessageCircle, Phone, ChevronRight } from 'lucide-react';
import { LayoutWrapper } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { AppCard, AppCardBody, AppCardHeader } from '@/components/app';

const FAQ = [
  {
    question: 'How do I cancel a booking?',
    answer: 'Go to your booking details and tap "Cancel booking". Cancellations within 24 hours may incur a fee.',
    href: '/client/bookings',
  },
  {
    question: "How do I update my pet's info?",
    answer: 'Go to My Pets, select your pet, and edit any field including feeding, medications, and vet info.',
    href: '/client/pets',
  },
  {
    question: 'How do I change my address?',
    answer: 'Go to your Profile and update your home address, entry instructions, and parking notes.',
    href: '/client/profile',
  },
  {
    question: 'How do I set up recurring visits?',
    answer: 'Go to Recurring to create a regular schedule. Your visits will be automatically booked.',
    href: '/client/recurring',
  },
  {
    question: 'How do I view my invoices?',
    answer: 'Go to Billing to see all invoices, payment history, and make payments.',
    href: '/client/billing',
  },
];

export default function ClientSupportPage() {
  const { data: branding } = useQuery({
    queryKey: ['support-branding'],
    queryFn: async () => {
      const res = await fetch('/api/settings/branding');
      return res.ok ? res.json() : null;
    },
    staleTime: 300000,
  });

  const businessName = branding?.businessName || 'your pet care provider';
  const businessPhone = branding?.phone || null;

  return (
    <LayoutWrapper variant="narrow">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary leading-tight lg:text-2xl">
            Support
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Get help with your account
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
            <AppCardHeader title="Help should feel calm and obvious" />
            <AppCardBody className="space-y-2 text-sm text-text-secondary">
              <p>Support works best when clients can either solve common questions quickly or reach the care team without wondering which channel to use.</p>
              <p>This page keeps both paths together: direct contact plus clear answers to the questions that come up most often.</p>
            </AppCardBody>
          </AppCard>
          <AppCard>
            <AppCardHeader title="Best next moves" />
            <AppCardBody className="space-y-2 text-sm text-text-secondary">
              <p>Use messages for visit-specific help or account questions.</p>
              <p>Use the FAQs below when you want the fastest route to the right page.</p>
            </AppCardBody>
          </AppCard>
        </div>

        {/* Contact options */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/client/messages"
            className="rounded-2xl bg-surface-primary shadow-sm p-5 hover:shadow-md transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-secondary mb-3">
              <MessageCircle className="h-5 w-5 text-accent-primary" />
            </div>
            <p className="text-sm font-semibold text-text-primary">Send us a message</p>
            <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
              Message {businessName} directly through your inbox.
            </p>
          </Link>

          {businessPhone ? (
            <a
              href={`tel:${businessPhone}`}
              className="rounded-2xl bg-surface-primary shadow-sm p-5 hover:shadow-md transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-secondary mb-3">
                <Phone className="h-5 w-5 text-accent-primary" />
              </div>
              <p className="text-sm font-semibold text-text-primary">Call us</p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                {businessPhone}
              </p>
            </a>
          ) : (
            <div className="rounded-2xl bg-surface-primary shadow-sm p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-secondary mb-3">
                <Phone className="h-5 w-5 text-accent-primary" />
              </div>
              <p className="text-sm font-semibold text-text-primary">Call us</p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                Contact {businessName} for phone support.
              </p>
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
              Frequently asked questions
            </h2>
          </div>
          <div className="divide-y divide-border-muted">
            {FAQ.map((item) => (
              <Link
                key={item.question}
                href={item.href}
                className="flex items-start gap-3 px-5 py-4 min-h-[48px] hover:bg-surface-secondary transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{item.question}</p>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{item.answer}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}
