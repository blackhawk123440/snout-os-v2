/**
 * Shared Navigation Configuration
 * 
 * Central source of truth for application navigation items.
 * Used by AppShell and TopBar for consistent navigation across all pages.
 */

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: number;
  children?: NavItem[];
}

/**
 * Canonical owner portal navigation (enterprise-grade).
 * Matches OwnerAppShell structure: Messaging (Inbox, Sitters, Numbers, Routing, Twilio Setup); Platform = Integrations, Settings; no Automations in nav; no Sitter Profile.
 * Used by AppShell when isOwner. OwnerAppShell uses OWNER_SIDEBAR_SECTIONS with sections and single-expand behavior.
 */
export const ownerNavigation: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'fas fa-chart-line' },
  { label: 'Calendar', href: '/calendar', icon: 'fas fa-calendar-alt' },
  { label: 'Bookings', href: '/bookings', icon: 'fas fa-calendar-check' },
  { label: 'Clients', href: '/clients', icon: 'fas fa-users' },
  { label: 'Team', href: '/sitters', icon: 'fas fa-user-friends' },
  { label: 'Messages', href: '/messaging', icon: 'fas fa-comments' },
  { label: 'Money', href: '/money', icon: 'fas fa-dollar-sign' },
  { label: 'Settings', href: '/settings', icon: 'fas fa-cog' },
  { label: 'Ops / Diagnostics', href: '/ops/diagnostics', icon: 'fas fa-stethoscope' },
];

export const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'fas fa-tachometer-alt' },
  { label: 'Bookings', href: '/bookings', icon: 'fas fa-calendar-check' },
  { label: 'Clients', href: '/clients', icon: 'fas fa-users' },
  { label: 'Team', href: '/sitters', icon: 'fas fa-user-friends' },
  { label: 'Messages', href: '/messaging', icon: 'fas fa-comments' },
  { label: 'Money', href: '/money', icon: 'fas fa-dollar-sign' },
  { label: 'Settings', href: '/settings', icon: 'fas fa-cog' },
];
