'use client';

import { FormEvent, useState } from 'react';
import { Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';

const inputClass = 'w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus';

export function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        reset();
        setOpen(false);
      }, 2000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">Password</p>
            <p className="text-xs text-text-tertiary">Change your account password</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { reset(); setOpen(true); }}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
      <p className="text-sm font-semibold text-text-primary mb-4">Change password</p>

      {success ? (
        <div className="flex items-center gap-2 rounded-lg bg-status-success-bg px-3 py-2.5">
          <CheckCircle className="h-4 w-4 text-status-success-text" />
          <p className="text-sm font-medium text-status-success-text">Password updated.</p>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="current-pw" className="text-xs font-medium text-text-secondary mb-1 block">Current password</label>
            <input
              id="current-pw"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label htmlFor="new-pw" className="text-xs font-medium text-text-secondary mb-1 block">New password</label>
            <input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirm-pw" className="text-xs font-medium text-text-secondary mb-1 block">Confirm new password</label>
            <input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Type it again"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2.5">
              <Lock className="h-4 w-4 shrink-0 text-status-danger-text" />
              <p className="text-sm font-medium text-status-danger-text">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="primary" size="sm" disabled={loading} isLoading={loading}>
              Update password
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => { reset(); setOpen(false); }} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
