/**
 * Command Categories
 * UI Constitution V1 - Phase 3
 * 
 * Stable command category definitions.
 */

import { CommandCategory } from './types';

/**
 * Category metadata for display
 */
export const categoryMetadata: Record<CommandCategory, { label: string; icon?: string }> = {
  [CommandCategory.Global]: {
    label: 'Global',
    icon: 'fa-globe',
  },
  [CommandCategory.Booking]: {
    label: 'Booking',
    icon: 'fa-calendar',
  },
  [CommandCategory.Client]: {
    label: 'Client',
    icon: 'fa-user',
  },
  [CommandCategory.Sitter]: {
    label: 'Sitter',
    icon: 'fa-user-tie',
  },
  [CommandCategory.Automation]: {
    label: 'Automation',
    icon: 'fa-magic',
  },
  [CommandCategory.System]: {
    label: 'System',
    icon: 'fa-cog',
  },
  [CommandCategory.Navigation]: {
    label: 'Navigation',
    icon: 'fa-route',
  },
};

/**
 * Category order for display
 */
export const categoryOrder: CommandCategory[] = [
  CommandCategory.Navigation,
  CommandCategory.Global,
  CommandCategory.Booking,
  CommandCategory.Client,
  CommandCategory.Sitter,
  CommandCategory.Automation,
  CommandCategory.System,
];
