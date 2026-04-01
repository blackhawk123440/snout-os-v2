/**
 * Client Portal Navigation Registry
 */

export const CLIENT_TABS = [
  { id: 'home', label: 'Home', href: '/client/home', icon: 'fas fa-home' },
  { id: 'bookings', label: 'Bookings', href: '/client/bookings', icon: 'fas fa-calendar-check' },
  { id: 'messages', label: 'Messages', href: '/client/messages', icon: 'fas fa-inbox' },
  { id: 'pets', label: 'Pets', href: '/client/pets', icon: 'fas fa-paw' },
  { id: 'billing', label: 'Billing', href: '/client/billing', icon: 'fas fa-credit-card' },
  { id: 'profile', label: 'Profile', href: '/client/profile', icon: 'fas fa-user' },
  { id: 'recurring', label: 'Recurring', href: '/client/recurring', icon: 'fas fa-sync' },
  { id: 'reports', label: 'Reports', href: '/client/reports', icon: 'fas fa-file-alt' },
  { id: 'support', label: 'Support', href: '/client/support', icon: 'fas fa-question-circle' },
] as const;

/** Mobile bottom nav — limited to 5 core items for touch ergonomics. */
export const CLIENT_BOTTOM_TABS = [
  CLIENT_TABS[0], // Home
  CLIENT_TABS[1], // Bookings
  CLIENT_TABS[2], // Messages
  CLIENT_TABS[3], // Pets
  CLIENT_TABS[5], // Profile
] as const;

export const CLIENT_NAV_GROUPS = [
  { label: 'Core', items: [CLIENT_TABS[0], CLIENT_TABS[1], CLIENT_TABS[2], CLIENT_TABS[3], CLIENT_TABS[4], CLIENT_TABS[5]] },
  { label: 'More', items: [CLIENT_TABS[6], CLIENT_TABS[7]] },
  { label: 'Support', items: [CLIENT_TABS[8]] },
] as const;
