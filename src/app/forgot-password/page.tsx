'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Input, Button } from '@/components/ui';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-surface-secondary">
      {/* Left panel — brand (matches login) */}
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
              Forgot your password?<br />No problem.
            </h1>
            <p className="mt-4 text-base text-text-inverse/60 leading-relaxed max-w-sm">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </div>
        </div>
        <p className="text-xs text-text-inverse/30">&copy; {new Date().getFullYear()} Snout OS</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary">
            <span className="text-lg font-bold text-text-inverse">S</span>
          </div>
          <span className="text-xl font-bold text-text-primary tracking-tight">Snout OS</span>
        </div>

        <div className="w-full max-w-sm">
          {sent ? (
            /* Success state */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
                <CheckCircle className="h-6 w-6 text-status-success-text" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Check your email</h2>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                If an account exists for <strong>{email}</strong>, we sent a password reset link.
                Check your inbox and spam folder.
              </p>
              <p className="mt-2 text-sm text-text-tertiary">
                The link expires in 30 minutes.
              </p>
              <div className="mt-8">
                <Link href="/login">
                  <Button variant="secondary" size="md" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* Request form */
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">Reset password</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Enter your email address and we&apos;ll send you a reset link.
                </p>
              </div>

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

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2.5">
                    <Mail className="h-4 w-4 shrink-0 text-status-danger-text" />
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
                  Send reset link
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
