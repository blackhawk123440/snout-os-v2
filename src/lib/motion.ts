/**
 * Motion utility layer - Enterprise-grade, subtle animations.
 * Must match UI_CONSTITUTION.md: no bounce, no springy effects, max 4px translate.
 * All motion respects prefers-reduced-motion.
 */

export const MOTION = {
  duration: {
    fast: 0.15,
    normal: 0.2,
    slow: 0.3,
  },
  easing: {
    easeOut: [0.33, 1, 0.68, 1] as const,
    easeInOut: [0.65, 0, 0.35, 1] as const,
  },
} as const;

/** Check if user prefers reduced motion (system or media query) */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Base transition - respects reduced motion */
export function getTransition(duration = MOTION.duration.normal) {
  if (prefersReducedMotion()) return { duration: 0 };
  return { duration, ease: MOTION.easing.easeOut };
}

/** fadeIn: opacity only */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: () => getTransition(MOTION.duration.normal),
};

/** fadeSlideIn: opacity + 4px translate max */
export const fadeSlideIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: () => getTransition(MOTION.duration.normal),
};

/** press: scale 0.99 for button feedback */
export const press = {
  whileTap: { scale: 0.99 },
  transition: () => getTransition(0.2),
};

/** pressY: translateY 1px for button feedback (alternative) */
export const pressY = {
  whileTap: { y: 1 },
  transition: () => getTransition(0.2),
};

/** Motion props for framer-motion components */
export const motionProps = {
  fadeIn,
  fadeSlideIn,
  press,
  pressY,
} as const;
