/**
 * UI Kit Utility Functions
 * UI Constitution V1
 */

import { tokens } from '@/lib/design-tokens';

/**
 * Merge class names with basic conflict resolution
 * Handles Tailwind class conflicts by keeping the last occurrence
 */
export function cn(...inputs: Array<string | undefined | null | false>): string {
  const classes = inputs
    .filter(Boolean)
    .map(String)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
  
  // Basic conflict resolution: keep last occurrence of conflicting classes
  const seen = new Map<string, number>();
  const resolved: string[] = [];
  
  classes.forEach((cls, index) => {
    // Extract base class (before any variant modifiers)
    const base = cls.split(/[:\[\]]/)[0];
    seen.set(base, index);
    resolved.push(cls);
  });
  
  return resolved.join(' ').trim();
}

/**
 * Get token value by path
 * Example: getToken('colors.surface.primary') => '#ffffff'
 */
export function getToken(path: string): string {
  const parts = path.split('.');
  let value: any = tokens;
  
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) return '';
  }
  
  return typeof value === 'string' ? value : '';
}

/**
 * Get spacing token
 */
export function spacing(level: keyof typeof tokens.spacing): string {
  return tokens.spacing[level];
}

/**
 * Get color token
 */
export function color(category: 'surface' | 'text' | 'border' | 'accent', key: string): string {
  const categoryTokens = tokens.colors[category] as Record<string, string>;
  return categoryTokens?.[key] || '';
}

/**
 * Get radius token
 */
export function radius(size: keyof typeof tokens.radius): string {
  return tokens.radius[size];
}

/**
 * Get shadow token
 */
export function shadow(size: keyof typeof tokens.shadow): string {
  return tokens.shadow[size];
}

/**
 * Get blur token
 */
export function blur(size: keyof typeof tokens.blur): string {
  return tokens.blur[size];
}

/**
 * Get z-index token
 */
export function z(layer: keyof typeof tokens.z.layer): number {
  return tokens.z.layer[layer];
}

/**
 * Get motion duration token
 */
export function motionDuration(speed: keyof typeof tokens.motion.duration): string {
  return tokens.motion.duration[speed];
}

/**
 * Get motion easing token
 */
export function motionEasing(type: keyof typeof tokens.motion.easing): string {
  return tokens.motion.easing[type];
}

/**
 * Generate CSS custom property reference
 */
export function cssVar(name: string): string {
  return `var(--${name})`;
}

/**
 * Merge style objects safely
 */
export function mergeStyles(...styles: Array<React.CSSProperties | undefined>): React.CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}

/**
 * Generate ID for aria-describedby patterns
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
