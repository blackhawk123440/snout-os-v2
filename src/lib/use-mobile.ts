'use client';

import { useState, useEffect } from 'react';

/**
 * useMobile Hook
 * 
 * Returns true if the current viewport is mobile-sized (typically < 768px).
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

