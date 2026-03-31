'use client';

/**
 * MotionButton - Primary CTA with subtle press feedback.
 * Use only for primary CTAs where micro-interaction matters.
 * Wraps Button with framer-motion whileTap (scale 0.99).
 * Respects prefers-reduced-motion (no animation when set).
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '@/lib/motion';
import { Button, type ButtonProps } from '@/components/ui/Button';

export function MotionButton(props: ButtonProps) {
  const [reduceMotion, setReduceMotion] = useState(true); // default true for SSR; then actual value
  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
  }, []);
  const tapProps = reduceMotion ? {} : { whileTap: { scale: 0.99 }, transition: { duration: 0.15 } };
  return (
    <motion.div {...tapProps} style={{ display: 'inline-block' }}>
      <Button {...props} />
    </motion.div>
  );
}
