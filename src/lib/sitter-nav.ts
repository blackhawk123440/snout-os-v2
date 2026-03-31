/**
 * Sitter Dashboard Navigation Registry
 *
 * Source of truth for sitter app structure.
 *
 * Architecture:
 * - Bottom nav: 5 primary tabs (Home, Today, Messages, Earnings, Profile)
 * - Profile → More section: secondary pages (Calendar, Pets, Reports, Performance, Training, Call Out)
 * - Home is the dashboard overview; Today is the operational check-in/out work view
 */

export type FeatureStatus = 'live' | 'coming_soon' | 'beta';

export const SITTER_TABS = [
  { id: 'home', label: 'Home', href: '/sitter/dashboard', icon: 'fas fa-th-large' },
  { id: 'today', label: 'Today', href: '/sitter/today', icon: 'fas fa-calendar-day' },
  { id: 'bookings', label: 'Bookings', href: '/sitter/bookings', icon: 'fas fa-clipboard-list' },
  { id: 'messages', label: 'Messages', href: '/sitter/inbox', icon: 'fas fa-inbox' },
  { id: 'reports', label: 'Reports', href: '/sitter/reports', icon: 'fas fa-file-alt' },
  { id: 'earnings', label: 'Earnings', href: '/sitter/earnings', icon: 'fas fa-wallet' },
  { id: 'profile', label: 'Profile', href: '/sitter/profile', icon: 'fas fa-user' },
] as const;

/** Mobile bottom nav — 5 core items for touch ergonomics. */
export const SITTER_BOTTOM_TABS = [
  SITTER_TABS[0], // Home (dashboard)
  SITTER_TABS[1], // Today (work view)
  SITTER_TABS[3], // Messages
  SITTER_TABS[5], // Earnings
  SITTER_TABS[6], // Profile
] as const;

/** Secondary pages accessible from Profile → More section. */
export const SITTER_MORE_LINKS = [
  { href: '/sitter/calendar', label: 'Calendar', icon: 'fas fa-calendar-alt' },
  { href: '/sitter/pets', label: 'Pets', icon: 'fas fa-paw' },
  { href: '/sitter/reports', label: 'Reports', icon: 'fas fa-file-alt' },
  { href: '/sitter/performance', label: 'Performance', icon: 'fas fa-chart-line' },
  { href: '/sitter/training', label: 'Training', icon: 'fas fa-graduation-cap' },
  { href: '/sitter/callout', label: 'Call Out', icon: 'fas fa-phone' },
] as const;

/** @deprecated Use SITTER_MORE_LINKS instead. Kept for backward compat. */
export const SITTER_PROFILE_LINKS = SITTER_MORE_LINKS;

/** Feature status per module. Keys match route/feature identifiers. */
export const FEATURE_STATUS: Record<string, FeatureStatus> = {
  dashboard: 'live',
  today: 'live',
  calendar: 'live',
  inbox: 'live',
  earnings: 'live',
  profile: 'live',
  jobs: 'live',
  pets: 'live',
  reports: 'live',
  availability: 'live',
  performance: 'live',
  training: 'live',
  route_optimization: 'coming_soon',
  ai_suggested_reply: 'coming_soon',
  instant_payout: 'coming_soon',
  badges: 'coming_soon',
  offline_mode: 'coming_soon',
  verification: 'coming_soon',
  documents: 'coming_soon',
  recurring_blocks: 'coming_soon',
  messages: 'coming_soon',
};

export function getFeatureStatus(key: string): FeatureStatus {
  return FEATURE_STATUS[key] ?? 'coming_soon';
}

export function getStatusPill(status: FeatureStatus): { label: string; className: string } {
  switch (status) {
    case 'live':
      return { label: 'Live', className: 'bg-status-success-bg text-status-success-text' };
    case 'beta':
      return { label: 'Beta', className: 'bg-status-info-bg text-status-info-text' };
    case 'coming_soon':
    default:
      return { label: 'Coming soon', className: 'bg-status-warning-bg text-status-warning-text' };
  }
}
