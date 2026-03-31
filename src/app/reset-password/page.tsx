'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input, Button } from '@/components/ui';
import { Lock, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-surface-secondary"><div className="h-8 w-8 animate-spin rounded-full border-4 border-border-default border-t-accent-primary" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // No token = invalid link
  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface-secondary px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-danger-bg">
            <AlertTriangle className="h-6 w-6 text-status-danger-text" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Invalid reset link</h2>
          <p className="mt-3 text-sm text-text-secondary">
            This link is missing or malformed. Please request a new password reset.
          </p>
          <div className="mt-8">
            <Link href="/forgot-password">
              <Button variant="primary" size="md" className="w-full">Request new reset link</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      setSuccess(true);
      // Redirect to login after brief delay
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-surface-secondary">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] shrink-0 flex-col justify-between bg-surface-inverse p-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary">
              <span className="text-lg font-bold text-text-inverse">S</span>
            </div>
            <span className="text-xl font-bold text-text-inverse tracking-tight">Snout OS</span>
          </div>
          <div className="mt-16">
            <h1 className="text-3xl font-bold text-text-inverse tracking-tight leading-tight">
              Choose a new password.
            </h1>
            <p className="mt-4 text-base text-text-inverse/60 leading-relaxed max-w-sm">
              Make it at least 8 characters. Mix letters, numbers, and symbols for best security.
            </p>
          </div>
        </div>
        <p className="text-xs text-text-inverse/30">&copy; {new Date().getFullYear()} Snout OS</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary">
            <span className="text-lg font-bold text-text-inverse">S</span>
          </div>
          <span className="text-xl font-bold text-text-primary tracking-tight">Snout OS</span>
        </div>

        <div className="w-full max-w-sm">
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
                <CheckCircle className="h-6 w-6 text-status-success-text" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Password updated</h2>
              <p className="mt-3 text-sm text-text-secondary">
                Your password has been changed. Redirecting to sign in...
              </p>
              <div className="mt-8">
                <Link href="/login">
                  <Button variant="primary" size="md" className="w-full">
                    Sign in now
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">New password</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Choose a strong password for your account.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  label="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  fullWidth
                  size="md"
                />

                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Type it again"
                  fullWidth
                  size="md"
                />

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
                  Reset password
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
