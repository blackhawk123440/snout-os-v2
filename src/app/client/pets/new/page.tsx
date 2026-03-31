'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutWrapper } from '@/components/layout';
import { AppPageHeader } from '@/components/app';
import { AppCard, AppCardBody } from '@/components/app';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui';
import { useCreateClientPet } from '@/lib/api/client-hooks';

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Fish', 'Reptile', 'Other'];
const GENDER_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
];

export default function NewPetPage() {
  const router = useRouter();
  const createPet = useCreateClientPet();
  const [form, setForm] = useState({
    name: '',
    species: 'Dog',
    breed: '',
    weight: '',
    gender: '',
    birthday: '',
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.species) return;
    if (form.weight && parseFloat(form.weight) <= 0) {
      toastError('Weight must be a positive number');
      return;
    }
    if (form.birthday && new Date(form.birthday) >= new Date(new Date().toDateString())) {
      toastError('Birthday must be in the past');
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      species: form.species,
    };
    if (form.breed.trim()) body.breed = form.breed.trim();
    if (form.weight) body.weight = parseFloat(form.weight);
    if (form.gender) body.gender = form.gender;
    if (form.birthday) body.birthday = form.birthday;

    try {
      const data = await createPet.mutateAsync(body);
      toastSuccess(`${form.name} added!`);
      router.push(`/client/pets/${data.id}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to add pet');
    }
  };

  const inputClass =
    'w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus';
  const labelClass = 'block text-sm font-medium text-text-primary mb-1';

  return (
    <LayoutWrapper variant="narrow">
      <AppPageHeader
        title="Add a pet"
        subtitle="Tell us about your furry family member"
        action={
          <button
            type="button"
            onClick={() => router.back()}
            className="min-h-[44px] text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        }
      />
      <AppCard>
        <AppCardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="pet-name" className={labelClass}>Name *</label>
              <input
                id="pet-name"
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Luna"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="pet-species" className={labelClass}>Species *</label>
              <select
                id="pet-species"
                required
                value={form.species}
                onChange={(e) => set('species', e.target.value)}
                className={inputClass}
              >
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pet-breed" className={labelClass}>Breed</label>
              <input
                id="pet-breed"
                type="text"
                maxLength={100}
                value={form.breed}
                onChange={(e) => set('breed', e.target.value)}
                placeholder="Golden Retriever"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pet-weight" className={labelClass}>Weight (lbs)</label>
                <input
                  id="pet-weight"
                  type="number"
                  min={0}
                  max={500}
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => set('weight', e.target.value)}
                  placeholder="65"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pet-gender" className={labelClass}>Gender</label>
                <select
                  id="pet-gender"
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  className={inputClass}
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pet-birthday" className={labelClass}>Birthday</label>
              <input
                id="pet-birthday"
                type="date"
                value={form.birthday}
                onChange={(e) => set('birthday', e.target.value)}
                className={inputClass}
              />
            </div>

            <Button type="submit" variant="primary" size="md" disabled={createPet.isPending || !form.name.trim()} isLoading={createPet.isPending} className="w-full">
              Add pet
            </Button>
          </form>
        </AppCardBody>
      </AppCard>
    </LayoutWrapper>
  );
}
