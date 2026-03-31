/**
 * Sitter Landing Page
 * Canonical entrypoint: /sitter → /sitter/dashboard
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';

export default function SitterPage() {
  const router = useRouter();
  const { isSitter, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isSitter) {
        router.replace('/sitter/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [loading, isSitter, router]);

  return null;
}
