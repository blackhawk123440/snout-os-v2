'use client';

/**
 * MotionDiv - Subtle fade/slide wrapper. Respects prefers-reduced-motion.
 */

import { motion } from 'framer-motion';
import { fadeIn, fadeSlideIn, getTransition } from '@/lib/motion';

type Variant = 'fadeIn' | 'fadeSlideIn';

interface MotionDivProps extends React.ComponentProps<typeof motion.div> {
  variant?: Variant;
}

const variants = {
  fadeIn,
  fadeSlideIn,
};

export function MotionDiv({ variant = 'fadeIn', children, ...props }: MotionDivProps) {
  const v = variants[variant];
  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={v.transition()}
      {...props}
    >
      {children}
    </motion.div>
  );
}
