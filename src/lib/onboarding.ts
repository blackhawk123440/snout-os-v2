/**
 * Onboarding - client-side helpers for checklist state.
 * Fetches from /api/onboarding; no new DB tables.
 */

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface OnboardingChecklist {
  items: OnboardingItem[];
  completed: number;
  total: number;
}

export async function fetchOnboarding(): Promise<OnboardingChecklist> {
  const res = await fetch('/api/onboarding');
  if (!res.ok) {
    throw new Error('Failed to load onboarding');
  }
  return res.json();
}
