/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['var(--font-jakarta)', 'var(--font-inter)', '-apple-system', 'sans-serif'],
      },
      // UI Constitution: color.surface.*
        colors: {
          surface: {
            base: 'var(--color-surface-base)',
            'frosted-low': 'var(--color-surface-frosted-low)',
            'frosted-mid': 'var(--color-surface-frosted-mid)',
            'frosted-high': 'var(--color-surface-frosted-high)',
            overlay: 'var(--color-surface-overlay)',
            modal: 'var(--color-surface-modal)',
            // Legacy aliases
            primary: 'var(--color-surface-primary)',
            secondary: 'var(--color-surface-secondary)',
            tertiary: 'var(--color-surface-tertiary)',
            inverse: 'var(--color-surface-inverse)',
            elevated: 'var(--color-surface-elevated)',
          },
        // UI Constitution: color.text.*
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          brand: 'var(--color-text-brand)',
        },
        // UI Constitution: color.border.*
          border: {
            default: 'var(--color-border-default)', // Phase 8: Refined opacity
            muted: 'var(--color-border-muted)',
            strong: 'var(--color-border-strong)',
            focus: 'var(--color-border-focus)',
            accent: 'var(--color-border-accent)',
          },
        // UI Constitution: color.accent.*
        accent: {
          primary: 'var(--color-accent-primary)',
          secondary: 'var(--color-accent-secondary)',
          tertiary: 'var(--color-accent-tertiary)',
        },
        // Status colors (theme-aware)
        status: {
          success: {
            bg: 'var(--color-status-success-bg)',
            border: 'var(--color-status-success-border)',
            text: 'var(--color-status-success-text)',
            'text-secondary': 'var(--color-status-success-text-secondary)',
            fill: 'var(--color-status-success-fill)',
            'fill-muted': 'var(--color-status-success-fill-muted)',
          },
          warning: {
            bg: 'var(--color-status-warning-bg)',
            border: 'var(--color-status-warning-border)',
            text: 'var(--color-status-warning-text)',
            'text-secondary': 'var(--color-status-warning-text-secondary)',
            fill: 'var(--color-status-warning-fill)',
          },
          danger: {
            bg: 'var(--color-status-danger-bg)',
            border: 'var(--color-status-danger-border)',
            text: 'var(--color-status-danger-text)',
            'text-secondary': 'var(--color-status-danger-text-secondary)',
            fill: 'var(--color-status-danger-fill)',
            'fill-hover': 'var(--color-status-danger-fill-hover)',
            'text-on-fill': 'var(--color-status-danger-text-on-fill)',
          },
          info: {
            bg: 'var(--color-status-info-bg)',
            border: 'var(--color-status-info-border)',
            text: 'var(--color-status-info-text)',
            fill: 'var(--color-status-info-fill)',
          },
          purple: {
            bg: 'var(--color-status-purple-bg)',
            border: 'var(--color-status-purple-border)',
            text: 'var(--color-status-purple-text)',
            fill: 'var(--color-status-purple-fill)',
          },
        },
        // Legacy support
        primary: '#432f21',
        primaryLight: '#fce1ef',
        primaryLighter: '#fef7fb',
        gray: '#6b7280',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      // UI Constitution: spacing.0..12
      spacing: {
        0: 'var(--spacing-0)',
        1: 'var(--spacing-1)',
        2: 'var(--spacing-2)',
        3: 'var(--spacing-3)',
        4: 'var(--spacing-4)',
        5: 'var(--spacing-5)',
        6: 'var(--spacing-6)',
        7: 'var(--spacing-7)',
        8: 'var(--spacing-8)',
        9: 'var(--spacing-9)',
        10: 'var(--spacing-10)',
        11: 'var(--spacing-11)',
        12: 'var(--spacing-12)',
      },
      // UI Constitution: radius.sm md lg xl
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      // UI Constitution: blur.none sm md
          blur: {
            none: 'var(--blur-none)',
            sm: 'var(--blur-sm)', // Phase 8: Increased from 4px to 8px
            md: 'var(--blur-md)', // Phase 8: Increased from 8px to 16px
            lg: 'var(--blur-lg)', // Phase 8: Increased from 16px to 24px
            xl: 'var(--blur-xl)', // Phase 8: New - 40px
          },
      // UI Constitution: shadow.sm md lg
          boxShadow: {
            none: 'var(--shadow-none)',
            xs: 'var(--shadow-xs)', // Phase 8: New - micro elevation
            sm: 'var(--shadow-sm)', // Phase 8: Refined - softer
            md: 'var(--shadow-md)', // Phase 8: Refined - softer
            lg: 'var(--shadow-lg)', // Phase 8: Refined - softer
            xl: 'var(--shadow-xl)', // Phase 8: New - extra large
          },
      // UI Constitution: z.layer.*
      zIndex: {
        'layer-base': 'var(--z-layer-base)',
        'layer-elevated': 'var(--z-layer-elevated)',
        'layer-floating': 'var(--z-layer-floating)',
        'layer-overlay': 'var(--z-layer-overlay)',
        'layer-modal': 'var(--z-layer-modal)',
        'layer-tooltip': 'var(--z-layer-tooltip)',
      },
      // Motion tokens
      transitionDuration: {
        fast: 'var(--motion-duration-fast)',
        normal: 'var(--motion-duration-normal)',
        slow: 'var(--motion-duration-slow)',
      },
          transitionTimingFunction: {
            standard: 'var(--motion-easing-standard)', // Phase 8: Refined curve
            emphasized: 'var(--motion-easing-emphasized)', // Phase 8: Refined curve
            decelerated: 'var(--motion-easing-decelerated)',
            accelerated: 'var(--motion-easing-accelerated)',
            spring: 'var(--motion-easing-spring)', // Phase 8: New - iOS-style spring
          },
    },
  },
  plugins: [],
}
