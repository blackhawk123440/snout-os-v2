'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'snout' | 'snout-dark';
export type UIDensity = 'compact' | 'comfortable' | 'spacious';

/** @deprecated Use Theme instead */
export type ThemeMode = 'light' | 'dark';

const VALID_THEMES: Theme[] = ['light', 'dark', 'snout', 'snout-dark'];

interface ThemeContextValue {
  /** Full 4-theme value */
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** Legacy compat — maps snout→light, snout-dark→dark for admin components */
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  density: UIDensity;
  setDensity: (d: UIDensity) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'snout-theme';
const DENSITY_KEY = 'snout-ui-density';

function applyThemeClass(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove('dark', 'theme-snout', 'theme-snout-dark');
  switch (theme) {
    case 'dark':
      html.classList.add('dark');
      break;
    case 'snout':
      html.classList.add('theme-snout');
      break;
    case 'snout-dark':
      html.classList.add('theme-snout-dark');
      break;
    case 'light':
    default:
      break;
  }
}

/** Map full theme to legacy light/dark mode */
function themeToMode(t: Theme): ThemeMode {
  return t === 'dark' || t === 'snout-dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('snout');
  const [density, setDensityState] = useState<UIDensity>('comfortable');
  const [mounted, setMounted] = useState(false);

  // Read saved preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as string | null;
      // Migrate from old key
      const legacySaved = localStorage.getItem('snout-theme-mode') as string | null;
      const d = localStorage.getItem(DENSITY_KEY) as UIDensity | null;

      if (saved && VALID_THEMES.includes(saved as Theme)) {
        setThemeState(saved as Theme);
        applyThemeClass(saved as Theme);
      } else if (legacySaved === 'dark') {
        setThemeState('dark');
        applyThemeClass('dark');
      } else {
        // Default: snout
        applyThemeClass('snout');
      }

      if (d === 'compact' || d === 'comfortable' || d === 'spacious') {
        setDensityState(d);
      }
    } catch {
      applyThemeClass('snout');
    }
    setMounted(true);
  }, []);

  // Apply theme class whenever theme changes (after mount)
  useEffect(() => {
    if (!mounted) return;
    applyThemeClass(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-density', density);
  }, [density, mounted]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  /** Legacy: setMode maps light→snout, dark→dark for admin toggle compat */
  const setMode = useCallback((m: ThemeMode) => {
    setThemeState(m === 'dark' ? 'dark' : 'snout');
  }, []);

  const setDensity = useCallback((d: UIDensity) => {
    setDensityState(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      // ignore
    }
  }, []);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => {
      if (prev === 'snout') return 'snout-dark';
      if (prev === 'snout-dark') return 'snout';
      if (prev === 'light') return 'dark';
      return 'light';
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        mode: themeToMode(theme),
        setMode,
        toggleMode,
        density,
        setDensity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx ?? {
    theme: 'snout' as Theme,
    setTheme: () => {},
    mode: 'light' as ThemeMode,
    density: 'comfortable' as UIDensity,
    setMode: () => {},
    setDensity: () => {},
    toggleMode: () => {},
  };
}
