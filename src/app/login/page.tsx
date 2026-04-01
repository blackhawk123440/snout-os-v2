'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Input, Button } from '@/components/ui';
import { Lock } from 'lucide-react';

type SessionUser = {
  role?: string;
  sitterId?: string | null;
  clientId?: string | null;
};

const getRedirectForRole = (user: SessionUser): string => {
  const normalizedRole = String(user.role || '').toUpperCase();
  if (normalizedRole === 'CLIENT' || !!user.clientId) return '/client/home';
  if (normalizedRole === 'SITTER' || !!user.sitterId) return '/sitter/dashboard';
  if (normalizedRole === 'OWNER' || normalizedRole === 'ADMIN') return '/dashboard';
  return '/dashboard';
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await signIn('credentials', {
        redirect: false,
        email: normalizedEmail,
        password,
      });

      if (!result?.ok || result.error) {
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      const callbackUrl = searchParams.get('callbackUrl');
      const safeCallbackUrl =
        callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
          ? callbackUrl
          : null;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' });
      const session = await sessionRes.json().catch(() => null);
      const redirectTarget =
        safeCallbackUrl || getRedirectForRole((session?.user || {}) as SessionUser);
      // Hard navigation so useSession picks up the fresh session cookie.
      // router.replace does a soft navigation where the NextAuth client cache
      // may still hold stale "unauthenticated" state, causing the app shell to
      // render skeletons indefinitely on first login.
      window.location.href = redirectTarget;
    } catch {
      setError('Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-surface-secondary">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] shrink-0 flex-col justify-between bg-surface-inverse p-10">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary">
              <span className="text-lg font-bold text-text-inverse">S</span>
            </div>
            <span className="text-xl font-bold text-text-inverse tracking-tight">Snout OS</span>
          </div>

          {/* Tagline */}
          <div className="mt-16">
            <h1 className="text-3xl font-bold text-text-inverse tracking-tight leading-tight">
              The operating system<br />for pet care businesses.
            </h1>
            <p className="mt-4 text-base text-text-inverse/60 leading-relaxed max-w-sm">
              Dispatch, scheduling, client management, messaging, and payments — in one platform.
            </p>
          </div>

          {/* Feature list */}
          <div className="mt-12 space-y-4">
            {[
              'Real-time dispatch and daily operations board',
              'Automated client communications via SMS',
              'Sitter performance tracking and tier management',
              'Integrated payments and payroll',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
                </div>
                <p className="text-sm text-text-inverse/70">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-text-inverse/30">
          &copy; {new Date().getFullYear()} Snout OS
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo (hidden on desktop) */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary">
            <span className="text-lg font-bold text-text-inverse">S</span>
          </div>
          <span className="text-xl font-bold text-text-primary tracking-tight">Snout OS</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Enter your credentials to access your workspace.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              fullWidth
              size="md"
            />

            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              fullWidth
              size="md"
            />

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2.5">
                <Lock className="h-4 w-4 shrink-0 text-status-danger-text" />
                <p className="text-sm font-medium text-status-danger-text">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
            >
              Sign in
            </Button>
          </form>

          {/* Footer links */}
          <div className="mt-8 border-t border-border-default pt-6">
            <p className="text-center text-xs text-text-tertiary">
              Protected workspace. Unauthorized access is prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
