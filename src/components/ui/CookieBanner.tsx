'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui';

const CONSENT_COOKIE = 'snout_consent';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeMs: number) {
  const expires = new Date(Date.now() + maxAgeMs).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookie(CONSENT_COOKIE)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    setCookie(CONSENT_COOKIE, 'true', ONE_YEAR_MS);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-default bg-surface-primary/95 backdrop-blur-sm p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Cookie className="w-5 h-5 text-text-tertiary shrink-0" />
          <p className="text-sm text-text-secondary">
            This site uses cookies to ensure you get the best experience.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/privacy"
            className="flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition"
          >
            Learn more
          </Link>
          <Button variant="primary" size="md" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
