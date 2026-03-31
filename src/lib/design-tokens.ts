/**
 * Design Tokens - UI Constitution V1
 * 
 * Complete token system for UI Constitution enforcement.
 * All colors, spacing, typography, shadows, radii, motion, and z-index
 * must come from these tokens.
 * 
 * No raw hex values, px, rem, %, vh, vw, rgba values allowed in components.
 */

export const tokens = {
  // ===== COLORS =====
  colors: {
    // Primary brand
    primary: {
      50: '#fef7fb',
      100: '#fef2f8',
      200: '#fce1ef',
      300: '#f9d0e5',
      400: '#f5bfdb',
      500: '#f2aed1',
      600: '#432f21',
      700: '#351f16',
      800: '#27100c',
      900: '#1a0802',
      DEFAULT: '#432f21',
    },
    
    // Neutrals
    neutral: {
      0: '#ffffff',
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      DEFAULT: '#525252',
    },
    
    // Status colors
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      DEFAULT: '#10b981',
    },
    
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      DEFAULT: '#f59e0b',
    },
    
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      DEFAULT: '#ef4444',
    },
    
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      DEFAULT: '#3b82f6',
    },
    
    // UI Constitution required: color.surface.*
    // Phase B2: Reduced pink, stronger contrast, clearer depth hierarchy
    surface: {
      // Base layer (PageShell background) - near-neutral with subtle warmth
      base: '#f8f7f6',
      
      // Frosted layers (varying blur and opacity) - closer to white
      frosted: {
        low: 'rgba(255, 255, 255, 0.85)',    // Panel, subtle elevation
        mid: 'rgba(255, 255, 255, 0.92)',    // FrostedCard, medium elevation
        high: 'rgba(255, 255, 255, 0.96)',   // High elevation cards
      },
      
      // Overlay layers (Drawer, BottomSheet) - pure white
      overlay: '#ffffff',
      
      // Modal layer (full opacity, highest elevation)
      modal: '#ffffff',
      
      // Legacy aliases for backward compatibility - neutralized
      primary: '#ffffff',
      secondary: '#faf9f8',   // Was pink #feecf4, now warm neutral
      tertiary: '#fcfbfa',    // Was pink #fef7fb, now warm neutral  
      inverse: '#432f21',
      elevated: '#ffffff',
    },
    
    // UI Constitution required: color.text.*
    // Phase B7: Micro contrast polish - clearer hierarchy through subtle contrast adjustment
    text: {
      primary: '#432f21',
      secondary: '#525252',
      tertiary: '#6b6b6b',  // Phase B7: Slightly darker for better contrast (was #737373)
      disabled: '#a3a3a3',
      inverse: '#ffffff',
      brand: '#432f21',
    },
    
    // UI Constitution required: color.border.*
    // Phase B7: Micro contrast tuning - sharper, more intentional edges
    border: {
      default: 'rgba(67, 47, 33, 0.17)',      // Phase B7: Increased 5% for sharper definition (was 0.12)
      muted: 'rgba(67, 47, 33, 0.08)',        // Phase B7: Slightly more intentional (was 0.06)
      strong: 'rgba(67, 47, 33, 0.20)',       // Strong visible border
      focus: 'rgba(67, 47, 33, 0.4)',         // Focus ring
      accent: 'rgba(245, 208, 227, 0.5)',     // Desaturated accent border
    },
    
    // UI Constitution required: color.accent.*
    // Phase B2: Accent reserved for active states, selection, highlights only
    accent: {
      primary: '#f5d0e3',     // Slightly desaturated pink for accents
      secondary: '#faf0f5',   // Very subtle pink wash
      tertiary: '#fcf8fa',    // Near-white with hint of warmth
    },
    
    // Legacy aliases for backward compatibility - neutralized backgrounds
    background: {
      primary: '#ffffff',
      secondary: '#faf9f8',   // Was pink, now warm neutral
      tertiary: '#fcfbfa',    // Was pink, now warm neutral
      inverse: '#432f21',
      accent: '#f5d0e3',      // Desaturated accent
    },
  },
  
  // ===== SPACING =====
  // UI Constitution required: spacing.0..12
  // Phase 8: Coherent rhythm - tuned for breathing and hierarchy
  spacing: {
    0: '0',
    0.5: '0.125rem',  // 2px - micro spacing (icon gaps, tight inline)
    1: '0.25rem',     // 4px - micro spacing (small gaps)
    1.5: '0.375rem',  // 6px - micro spacing (input padding tight)
    2: '0.5rem',      // 8px - small spacing (field gaps, card padding tight)
    3: '0.75rem',     // 12px - small spacing (component internal)
    4: '1rem',        // 16px - medium spacing (field spacing, section gaps)
    5: '1.25rem',     // 20px - medium spacing
    6: '1.5rem',      // 24px - large spacing (section separation)
    7: '1.75rem',     // 28px - large spacing
    8: '2rem',        // 32px - extra large spacing (page separation)
    9: '2.25rem',     // 36px
    10: '2.5rem',     // 40px
    11: '2.75rem',    // 44px
    12: '3rem',       // 48px
    16: '4rem',       // 64px - section separation large
  },
  
  // Phase 8: Explicit spacing categories for semantic use
  spacingRhythm: {
    micro: '0.25rem',    // 4px - icon gaps, inline spacing
    small: '0.5rem',     // 8px - field spacing, card padding
    medium: '1rem',      // 16px - section spacing
    large: '1.5rem',     // 24px - page separation
    xlarge: '2rem',      // 32px - major separation
  },
  
  // ===== TYPOGRAPHY =====
  // Phase 8: Tuned hierarchy for clarity and authority
  typography: {
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
    },
    
    fontSize: {
      // Phase 8: Refined sizes with optical balance
      xs: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.01em' }],      // 12px - Caption
      sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],           // 14px - Small body
      base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],        // 16px - Body
      lg: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.015em' }],   // 18px - Subheading
      xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],      // 20px - Section heading
      '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],      // 24px - Large heading
      '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.03em' }],  // 30px - Title
      '4xl': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.035em' }],  // 36px - Display
      '5xl': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.04em' }],       // 48px - Hero
      
      // Phase 8: Explicit semantic sizes
      caption: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.01em' }],
      body: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
      subheading: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.015em' }],
      heading: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
      title: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.03em' }],
      stat: ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.035em' }],      // Numeric display
    },
    
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    letterSpacing: {
      tight: '-0.03em',
      normal: '0',
      wide: '0.025em',
    },
  },
  
  // ===== BORDER RADIUS =====
  // UI Constitution required: radius.sm md lg xl
  // Phase B7: Mechanical tightening - more precise, system-like feel
  radius: {
    none: '0',
    sm: '0.1875rem',    // 3px - Small elements (badges, pills)
    DEFAULT: '0.3125rem', // Phase B7: 5px - Slightly tighter for precision (was 6px)
    md: '0.5rem',       // 8px - Cards, panels
    lg: '0.75rem',      // 12px - Large cards
    xl: '1rem',         // 16px - Extra large cards
    '2xl': '1.25rem',   // 20px - Modal, drawer
    full: '9999px',
  },
  
  // Legacy alias for backward compatibility
  borderRadius: {
    none: '0',
    sm: '0.125rem',     // 2px
    DEFAULT: '0.25rem', // 4px
    md: '0.375rem',     // 6px
    lg: '0.5rem',       // 8px
    xl: '0.75rem',      // 12px
    '2xl': '1rem',      // 16px
    full: '9999px',
  },
  
  // ===== BLUR =====
  // UI Constitution required: blur.none sm md
  // Phase 8: Surface-specific blur strengths
  blur: {
    none: '0',
    sm: '8px',      // Low frosted
    md: '16px',     // Mid frosted (FrostedCard)
    lg: '24px',     // High frosted
    xl: '40px',     // Maximum blur
  },
  
  // ===== SHADOWS =====
  // UI Constitution required: shadow.sm md lg
  // Phase B2: Layered elevation - Panel subtle, Card moderate, Drawer/Modal strong
  shadow: {
    none: 'none',
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',                                      // Panel - very subtle
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',     // Card - subtle lift
    md: '0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)', // FrostedCard - moderate
    lg: '0 12px 20px -4px rgba(0, 0, 0, 0.12), 0 4px 8px -4px rgba(0, 0, 0, 0.06)', // Drawer - strong
    xl: '0 24px 32px -8px rgba(0, 0, 0, 0.16), 0 8px 16px -8px rgba(0, 0, 0, 0.08)', // Modal - strongest
  },
  
  // Legacy alias
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
    DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
    md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.06)',
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
    xl: '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
    none: 'none',
  },
  
  // ===== Z-INDEX =====
  // UI Constitution required: z.layer.*
  z: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    layer: {
      base: 0,
      elevated: 10,
      floating: 100,
      overlay: 1000,
      modal: 1050,
      tooltip: 1070,
    },
  },
  
  // Legacy alias
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
  
  // ===== MOTION =====
  // UI Constitution required: motion.duration.fast normal slow
  // Phase 8: Tuned motion physics - iOS-class curves
  motion: {
    duration: {
      instant: '100ms',    // Immediate feedback (hover, focus)
      fast: '150ms',       // Small transitions (button hover)
      normal: '250ms',     // Standard transitions (modal open, drawer)
      slow: '350ms',       // Large transitions (page transitions)
    },
    // Phase 8: Refined easing curves for premium feel
    easing: {
      // Standard: Balanced, smooth (default for most interactions)
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      // Emphasized: Quick start, smooth end (important actions)
      emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
      // Decelerated: Smooth deceleration (page transitions)
      decelerated: 'cubic-bezier(0, 0, 0.2, 1)',
      // Accelerated: Quick acceleration (dismissals)
      accelerated: 'cubic-bezier(0.4, 0, 1, 1)',
      // Spring: Natural feel (iOS-style spring animations)
      spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
  },
  
  // Legacy alias
  transitions: {
    duration: {
      fast: '150ms',
      DEFAULT: '200ms',
      slow: '300ms',
    },
    timingFunction: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  
  // ===== LAYOUT =====
  // Phase B3: Structural authority - constrained, centered, professional
  layout: {
    appShell: {
      sidebarWidth: '16rem',    // 256px
      sidebarWidthCollapsed: '4rem', // 64px
      topBarHeight: '3.5rem',   // 56px - slightly reduced
      contentMaxWidth: '1240px', // Phase B3: Constrained for authority
      contentPadding: '1.5rem', // 24px
    },
    
    // Phase B3: Page content constraints
    page: {
      maxWidth: '1240px',       // Centered content max
      padding: '1.5rem',        // Horizontal padding
      paddingMobile: '1rem',    // Mobile padding
    },
    
    // Phase B3: Section spacing - tighter, denser
    section: {
      gap: '1.25rem',           // 20px between sections (was 24px)
      headerGap: '0.75rem',     // 12px between header and content
      titleSize: '1.5rem',      // 24px page title
      subtitleSize: '0.875rem', // 14px subtitle
    },
    
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
} as const;

// Type-safe token access helpers
export type ColorToken = keyof typeof tokens.colors;
export type SpacingToken = keyof typeof tokens.spacing;
export type FontSizeToken = keyof typeof tokens.typography.fontSize;
export type FontWeightToken = keyof typeof tokens.typography.fontWeight;
export type RadiusToken = keyof typeof tokens.radius;
export type ShadowToken = keyof typeof tokens.shadow;
export type MotionDurationToken = keyof typeof tokens.motion.duration;
export type MotionEasingToken = keyof typeof tokens.motion.easing;
export type ZLayerToken = keyof typeof tokens.z.layer;

/**
 * Generate CSS variables from tokens
 * This function creates CSS custom properties for use in globals.css
 */
export function generateCSSVariables(): string {
  const vars: string[] = [];
  
  // Color tokens - Surface (Phase 8: Visual depth system)
  vars.push(`  --color-surface-base: ${tokens.colors.surface.base};`);
  Object.entries(tokens.colors.surface.frosted).forEach(([key, value]) => {
    vars.push(`  --color-surface-frosted-${key}: ${value};`);
  });
  vars.push(`  --color-surface-overlay: ${tokens.colors.surface.overlay};`);
  vars.push(`  --color-surface-modal: ${tokens.colors.surface.modal};`);
  
  // Legacy surface aliases
  Object.entries(tokens.colors.surface).forEach(([key, value]) => {
    if (typeof value === 'string' && !key.includes('frosted')) {
      vars.push(`  --color-surface-${key}: ${value};`);
    }
  });
  
  Object.entries(tokens.colors.text).forEach(([key, value]) => {
    vars.push(`  --color-text-${key}: ${value};`);
  });
  
  Object.entries(tokens.colors.border).forEach(([key, value]) => {
    vars.push(`  --color-border-${key}: ${value};`);
  });
  
  Object.entries(tokens.colors.accent).forEach(([key, value]) => {
    vars.push(`  --color-accent-${key}: ${value};`);
  });
  
  // Spacing tokens (Phase 8: Includes new values)
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    const safeKey = key.replace('.', '-');
    vars.push(`  --spacing-${safeKey}: ${value};`);
  });
  
  // Radius tokens
  Object.entries(tokens.radius).forEach(([key, value]) => {
    if (key !== 'DEFAULT') {
      vars.push(`  --radius-${key}: ${value};`);
    }
  });
  vars.push(`  --radius: ${tokens.radius.DEFAULT};`);
  
  // Blur tokens
  Object.entries(tokens.blur).forEach(([key, value]) => {
    vars.push(`  --blur-${key}: ${value};`);
  });
  
  // Shadow tokens (Phase 8: Refined shadows)
  Object.entries(tokens.shadow).forEach(([key, value]) => {
    vars.push(`  --shadow-${key}: ${value};`);
  });
  
  // Z-index tokens
  Object.entries(tokens.z.layer).forEach(([key, value]) => {
    vars.push(`  --z-layer-${key}: ${value};`);
  });
  
  // Motion tokens (Phase 8: Includes instant and spring)
  Object.entries(tokens.motion.duration).forEach(([key, value]) => {
    vars.push(`  --motion-duration-${key}: ${value};`);
  });
  
  Object.entries(tokens.motion.easing).forEach(([key, value]) => {
    vars.push(`  --motion-easing-${key}: ${value};`);
  });
  
  return `:root {\n${vars.join('\n')}\n}`;
}
