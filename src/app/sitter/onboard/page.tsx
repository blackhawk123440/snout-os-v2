'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Check, Lock, User, Calendar, CreditCard, ArrowRight } from 'lucide-react';
import { AvailabilityGrid } from '@/components/sitter/AvailabilityGrid';

type Step = 'password' | 'profile' | 'availability' | 'stripe' | 'complete';
const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'password', label: 'Password', icon: <Lock className="h-4 w-4" /> },
  { key: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { key: 'availability', label: 'Availability', icon: <Calendar className="h-4 w-4" /> },
  { key: 'stripe', label: 'Payouts', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'complete', label: 'Done', icon: <Check className="h-4 w-4" /> },
];


export default function SitterOnboardPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState<Step>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token validation
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [sitterName, setSitterName] = useState('');
  const [sitterEmail, setSitterEmail] = useState('');

  // Step 1: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Profile
  const [bio, setBio] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');

  // Step 3: Availability — handled by AvailabilityGrid component

  // Step 4: Stripe
  const [stripeConnected, setStripeConnected] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    fetch(`/api/sitter/onboard/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        setTokenValid(data.valid);
        if (data.valid) {
          setSitterName(data.sitterName || '');
          setSitterEmail(data.email || '');
        }
      })
      .catch(() => setTokenValid(false));
  }, [token]);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // ── Step handlers ─────────────────────────────────────────────

  async function handleSetPassword() {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sitter/onboard/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set password');

      // Auto-login
      const signInResult = await signIn('credentials', {
        email: data.email || sitterEmail,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        console.warn('Auto-login failed, continuing to profile step:', signInResult.error);
      }
      setStep('profile');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sitter/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(bio.trim() ? { bio: bio.trim() } : {}),
          ...(personalPhone.trim() ? { personalPhone: personalPhone.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save profile');
      }
      setStep('availability');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Availability is now saved automatically by the AvailabilityGrid component

  async function handleStripeConnect() {
    window.location.href = '/api/sitter/stripe/connect';
  }

  async function handleComplete() {
    setLoading(true); setError(null);
    try {
      await fetch('/api/sitter/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: 'pending_review' }),
      });
      setStep('complete');
    } catch {
      setStep('complete'); // Show completion anyway
    } finally {
      setLoading(false);
    }
  }


  // ── Render ────────────────────────────────────────────────────

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="animate-pulse text-text-tertiary">Verifying invite...</div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
        <div className="w-full max-w-md rounded-2xl bg-surface-primary shadow-sm p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-warning-bg mb-4">
            <Lock className="h-6 w-6 text-status-warning-text" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Invite link expired</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            This invite link is no longer valid. Contact your manager for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Welcome, {sitterName.split(' ')[0] || 'there'}!</h1>
          <p className="mt-1 text-sm text-text-secondary">Let&apos;s get your account set up</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                i < currentStepIndex ? 'bg-accent-primary text-text-inverse' :
                i === currentStepIndex ? 'bg-accent-primary text-text-inverse' :
                'bg-surface-tertiary text-text-tertiary'
              }`}>
                {i < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : s.icon}
              </div>
              <span className={`text-[10px] font-medium ${i <= currentStepIndex ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-status-danger-bg border border-status-danger-border px-4 py-3">
            <p className="text-sm text-status-danger-text">{error}</p>
          </div>
        )}

        {/* ── Step 1: Password ─────────────────────────────────── */}
        {step === 'password' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Create your password</h2>
              <p className="text-sm text-text-tertiary mt-0.5">You&apos;ll use this to sign in to the sitter portal</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Confirm password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Type it again" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <button type="button" onClick={handleSetPassword} disabled={loading || password.length < 8} className="w-full min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 disabled:opacity-50">
              {loading ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        )}

        {/* ── Step 2: Profile ──────────────────────────────────── */}
        {step === 'profile' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Your profile</h2>
              <p className="text-sm text-text-tertiary mt-0.5">{sitterName} · {sitterEmail}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Bio (optional)</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell clients about yourself..." className="w-full min-h-[80px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none resize-y" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Personal phone (optional)</label>
              <input type="tel" value={personalPhone} onChange={e => setPersonalPhone(e.target.value)} placeholder="Your personal number" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <button type="button" onClick={handleSaveProfile} disabled={loading} className="w-full min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 disabled:opacity-50">
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        )}

        {/* ── Step 3: Availability (Rover-style grid) ────────── */}
        {step === 'availability' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">When are you available?</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Tap cells to mark your weekly availability. Changes save automatically.</p>
            </div>
            <AvailabilityGrid compact />
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('stripe')} className="flex-1 min-h-[44px] rounded-lg border border-border-default bg-surface-primary text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
                Skip for now
              </button>
              <button type="button" onClick={() => setStep('stripe')} className="flex-1 min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Stripe ───────────────────────────────────── */}
        {step === 'stripe' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Get paid</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Connect your bank account to receive payouts</p>
            </div>
            {stripeConnected ? (
              <div className="flex items-center gap-2 rounded-lg bg-status-success-bg px-4 py-3">
                <Check className="h-4 w-4 text-status-success-text" />
                <span className="text-sm font-medium text-status-success-text">Bank account connected</span>
              </div>
            ) : (
              <>
                <button type="button" onClick={handleStripeConnect} className="w-full min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Connect with Stripe
                </button>
                <p className="text-xs text-text-tertiary text-center">
                  You won&apos;t receive payouts until your bank account is connected.
                </p>
              </>
            )}
            <button type="button" onClick={handleComplete} disabled={loading} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
              {stripeConnected ? 'Continue' : 'Skip for now'}
              <ArrowRight className="inline h-3.5 w-3.5 ml-1" />
            </button>
          </div>
        )}

        {/* ── Step 5: Complete ─────────────────────────────────── */}
        {step === 'complete' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-tertiary mb-4">
              <Check className="h-7 w-7 text-accent-primary" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">You&apos;re all set!</h2>
            <p className="mt-2 text-sm text-text-secondary max-w-[300px] mx-auto leading-relaxed">
              Your manager will review and activate your account. You&apos;ll get a notification when you&apos;re ready to start.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
