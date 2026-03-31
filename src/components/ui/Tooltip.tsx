/**
 * Tooltip Component
 * UI Constitution V1 - Control Component
 * 
 * Accessible tooltip with tokenized delay.
 * 
 * @example
 * ```tsx
 * <Tooltip content="This is a tooltip" delay={200}>
 *   <Button>Hover me</Button>
 * </Tooltip>
 * ```
 */

'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { tokens } from '@/lib/design-tokens';
import { cn } from './utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  'data-testid'?: string;
}

export function Tooltip({
  content,
  children,
  delay = 200, // Tokenized delay from motion.duration.fast
  placement = 'top',
  className,
  'data-testid': testId,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
    }

    setPosition({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- updatePosition stable; adding causes resize loop
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      data-testid={testId || 'tooltip-trigger'}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      style={{ display: 'inline-block', position: 'relative' }}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn('tooltip', className)}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: tokens.z.layer.tooltip,
            backgroundColor: tokens.colors.neutral[800],
            color: tokens.colors.text.inverse,
            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            borderRadius: tokens.radius.md,
            fontSize: tokens.typography.fontSize.sm[0],
            boxShadow: tokens.shadow.md,
            pointerEvents: 'none',
            maxWidth: '200px',
            wordWrap: 'break-word',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
