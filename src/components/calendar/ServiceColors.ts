export type ServiceType = 'walk' | 'drop_in' | 'house_sitting' | 'pet_taxi' | 'other';

export function classifyService(service: string): ServiceType {
  const s = service.toLowerCase();
  if (s.includes('walk')) return 'walk';
  if (s.includes('drop') || s.includes('visit')) return 'drop_in';
  if (s.includes('house') || s.includes('sitting') || s.includes('24/7') || s.includes('overnight')) return 'house_sitting';
  if (s.includes('taxi') || s.includes('transport')) return 'pet_taxi';
  return 'other';
}

export const SERVICE_COLORS: Record<ServiceType, {
  bg: string;
  border: string;
  text: string;
}> = {
  walk: {
    bg: 'var(--color-status-info-bg)',
    border: 'var(--color-status-info-fill)',
    text: 'var(--color-status-info-text)',
  },
  drop_in: {
    bg: 'var(--color-status-success-bg)',
    border: 'var(--color-status-success-fill)',
    text: 'var(--color-status-success-text)',
  },
  house_sitting: {
    bg: 'var(--color-status-purple-bg)',
    border: 'var(--color-status-purple-fill)',
    text: 'var(--color-status-purple-text)',
  },
  pet_taxi: {
    bg: 'var(--color-status-warning-bg)',
    border: 'var(--color-status-warning-fill)',
    text: 'var(--color-status-warning-text)',
  },
  other: {
    bg: 'var(--color-status-info-bg)',
    border: 'var(--color-status-info-fill)',
    text: 'var(--color-status-info-text)',
  },
};

export function getServiceColor(service: string) {
  return SERVICE_COLORS[classifyService(service)];
}

export const SERVICE_LEGEND: Array<{ label: string; type: ServiceType }> = [
  { label: 'Walk', type: 'walk' },
  { label: 'Drop-in / Visit', type: 'drop_in' },
  { label: 'House sitting', type: 'house_sitting' },
  { label: 'Pet taxi', type: 'pet_taxi' },
];
