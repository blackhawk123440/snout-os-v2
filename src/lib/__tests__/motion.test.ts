/**
 * Motion utility tests - Wave 3 reduced-motion compliance.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prefersReducedMotion, getTransition } from '../motion';

describe('motion', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    vi.stubGlobal('matchMedia', originalMatchMedia);
  });

  it('prefersReducedMotion returns false when media does not match', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    expect(prefersReducedMotion()).toBe(false);
  });

  it('prefersReducedMotion returns true when media matches', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    expect(prefersReducedMotion()).toBe(true);
  });

  it('getTransition returns duration 0 when reduced motion', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const t = getTransition(0.25);
    expect(t.duration).toBe(0);
  });

  it('getTransition returns normal duration when not reduced motion', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const t = getTransition(0.25);
    expect(t.duration).toBe(0.25);
  });
});
