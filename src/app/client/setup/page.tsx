'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Check, Lock, PawPrint, Home, Phone, ArrowRight } from 'lucide-react';

type Step = 'password' | 'pets' | 'home' | 'emergency' | 'complete';
const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'password', label: 'Password', icon: <Lock className="h-4 w-4" /> },
  { key: 'pets', label: 'Pets', icon: <PawPrint className="h-4 w-4" /> },
  { key: 'home', label: 'Home', icon: <Home className="h-4 w-4" /> },
  { key: 'emergency', label: 'Emergency', icon: <Phone className="h-4 w-4" /> },
  { key: 'complete', label: 'Done', icon: <Check className="h-4 w-4" /> },
];

interface PetEntry {
  name: string;
  species: string;
  breed: string;
  weight: string;
}

function emptyPet(): PetEntry {
  return { name: '', species: 'Dog', breed: '', weight: '' };
}

export default function ClientSetupPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState<Step>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token validation
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Step 1: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Pets
  const [pets, setPets] = useState<PetEntry[]>([emptyPet()]);

  // Step 3: Home Access
  const [homeAccess, setHomeAccess] = useState({
    entryInstructions: '',
    keyLocation: '',
    lockboxCode: '',
    doorAlarmCode: '',
    wifiNetwork: '',
    wifiPassword: '',
    parkingNotes: '',
  });

  // Step 4: Emergency Contact
  const [emergencyContact, setEmergencyContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    fetch(`/api/client/setup/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        setTokenValid(data.valid);
        if (data.valid) {
          setClientName(data.clientName || '');
          setClientEmail(data.email || '');
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
      const res = await fetch('/api/client/setup/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set password');

      // Auto-login
      const signInResult = await signIn('credentials', {
        email: data.email || clientEmail,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        console.warn('Auto-login failed, continuing to pets step:', signInResult.error);
      }
      setStep('pets');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updatePet(index: number, field: keyof PetEntry, value: string) {
    setPets(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addPet() {
    setPets(prev => [...prev, emptyPet()]);
  }

  function removePet(index: number) {
    setPets(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  async function handleSavePets() {
    const validPets = pets.filter(p => p.name.trim());
    if (validPets.length === 0) { setStep('home'); return; }
    setLoading(true); setError(null);
    try {
      for (const pet of validPets) {
        const res = await fetch('/api/client/pets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: pet.name.trim(),
            species: pet.species,
            breed: pet.breed.trim() || undefined,
            weight: pet.weight ? parseFloat(pet.weight) : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to add pet');
        }
      }
      setStep('home');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveHomeAccess() {
    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(homeAccess)) {
      if (value.trim()) payload[key] = value.trim();
    }
    if (Object.keys(payload).length === 0) { setStep('emergency'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/client/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save home access info');
      }
      setStep('emergency');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEmergencyContact() {
    if (!emergencyContact.name.trim() || !emergencyContact.phone.trim()) {
      setStep('complete');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/client/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: emergencyContact.name.trim(),
          phone: emergencyContact.phone.trim(),
          relationship: emergencyContact.relationship.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save emergency contact');
      }
      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="animate-pulse text-text-tertiary">Verifying your link...</div>
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
          <h1 className="text-xl font-semibold text-text-primary">Setup link expired</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            This setup link is no longer valid. Contact your pet sitter for a new one.
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
          <h1 className="text-2xl font-bold text-text-primary">Welcome, {clientName.split(' ')[0] || 'there'}!</h1>
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
              <p className="text-sm text-text-tertiary mt-0.5">You&apos;ll use this to sign in to your client portal</p>
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

        {/* ── Step 2: Pets ──────────────────────────────────────── */}
        {step === 'pets' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Add your pets</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Tell us about your furry family members</p>
            </div>
            {pets.map((pet, index) => (
              <div key={index} className="space-y-3 border border-border-default rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Pet {index + 1}</span>
                  {pets.length > 1 && (
                    <button type="button" onClick={() => removePet(index)} className="text-xs text-status-danger-text hover:underline">Remove</button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
                  <input type="text" value={pet.name} onChange={e => updatePet(index, 'name', e.target.value)} placeholder="Pet name" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Species</label>
                  <select value={pet.species} onChange={e => updatePet(index, 'species', e.target.value)} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none">
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Breed (optional)</label>
                  <input type="text" value={pet.breed} onChange={e => updatePet(index, 'breed', e.target.value)} placeholder="e.g. Golden Retriever" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Weight in lbs (optional)</label>
                  <input type="number" value={pet.weight} onChange={e => updatePet(index, 'weight', e.target.value)} placeholder="e.g. 45" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
                </div>
              </div>
            ))}
            <button type="button" onClick={addPet} className="w-full min-h-[44px] rounded-lg border border-dashed border-border-default text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
              + Add another pet
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('home')} className="flex-1 min-h-[44px] rounded-lg border border-border-default bg-surface-primary text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
                Skip for now
              </button>
              <button type="button" onClick={handleSavePets} disabled={loading} className="flex-1 min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 disabled:opacity-50">
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Home Access ───────────────────────────────── */}
        {step === 'home' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Home access details</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Help your sitter access your home safely</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Entry instructions</label>
              <textarea value={homeAccess.entryInstructions} onChange={e => setHomeAccess(prev => ({ ...prev, entryInstructions: e.target.value }))} rows={2} placeholder="e.g. Use the side gate, ring doorbell twice" className="w-full min-h-[80px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none resize-y" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Key location</label>
              <input type="text" value={homeAccess.keyLocation} onChange={e => setHomeAccess(prev => ({ ...prev, keyLocation: e.target.value }))} placeholder="e.g. Under the blue pot on the porch" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Lockbox code</label>
              <input type="text" value={homeAccess.lockboxCode} onChange={e => setHomeAccess(prev => ({ ...prev, lockboxCode: e.target.value }))} placeholder="e.g. 1234" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Door alarm code</label>
              <input type="text" value={homeAccess.doorAlarmCode} onChange={e => setHomeAccess(prev => ({ ...prev, doorAlarmCode: e.target.value }))} placeholder="e.g. 5678" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">WiFi network</label>
              <input type="text" value={homeAccess.wifiNetwork} onChange={e => setHomeAccess(prev => ({ ...prev, wifiNetwork: e.target.value }))} placeholder="Network name" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">WiFi password</label>
              <input type="text" value={homeAccess.wifiPassword} onChange={e => setHomeAccess(prev => ({ ...prev, wifiPassword: e.target.value }))} placeholder="WiFi password" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Parking notes</label>
              <input type="text" value={homeAccess.parkingNotes} onChange={e => setHomeAccess(prev => ({ ...prev, parkingNotes: e.target.value }))} placeholder="e.g. Park in driveway, visitor spot #3" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('emergency')} className="flex-1 min-h-[44px] rounded-lg border border-border-default bg-surface-primary text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
                Skip for now
              </button>
              <button type="button" onClick={handleSaveHomeAccess} disabled={loading} className="flex-1 min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 disabled:opacity-50">
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Emergency Contact ─────────────────────────── */}
        {step === 'emergency' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Emergency contact</h2>
              <p className="text-sm text-text-tertiary mt-0.5">Someone we can reach if we can&apos;t get ahold of you</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Contact name</label>
              <input type="text" value={emergencyContact.name} onChange={e => setEmergencyContact(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Jane Smith" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Phone number</label>
              <input type="tel" value={emergencyContact.phone} onChange={e => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))} placeholder="(555) 123-4567" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Relationship (optional)</label>
              <input type="text" value={emergencyContact.relationship} onChange={e => setEmergencyContact(prev => ({ ...prev, relationship: e.target.value }))} placeholder="e.g. Spouse, Neighbor, Parent" className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('complete')} className="flex-1 min-h-[44px] rounded-lg border border-border-default bg-surface-primary text-sm font-medium text-text-secondary transition hover:bg-surface-secondary">
                Skip for now
              </button>
              <button type="button" onClick={handleSaveEmergencyContact} disabled={loading} className="flex-1 min-h-[44px] rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90 disabled:opacity-50">
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Complete ───────────────────────────────────── */}
        {step === 'complete' && (
          <div className="rounded-2xl bg-surface-primary shadow-sm p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-tertiary mb-4">
              <Check className="h-7 w-7 text-accent-primary" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">You&apos;re all set!</h2>
            <p className="mt-2 text-sm text-text-secondary max-w-[300px] mx-auto leading-relaxed">
              Your account is ready. You can manage your pets, bookings, and more from your dashboard.
            </p>
            <a href="/client/home" className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-6 rounded-lg bg-accent-primary text-text-inverse text-sm font-semibold transition hover:brightness-90">
              View your dashboard
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
