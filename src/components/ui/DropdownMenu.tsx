/**
 * DropdownMenu Component
 * UI Constitution V1 - Control Component
 * 
 * Enterprise-style dropdown menu with grouped actions.
 * Matches Stripe / AWS / Twilio dashboard patterns.
 * 
 * @example
 * ```tsx
 * <DropdownMenu
 *   trigger={<IconButton icon={<i className="fas fa-ellipsis-v" />} />}
 * >
 *   <DropdownMenuGroup label="Actions">
 *     <DropdownMenuItem onClick={handleView}>View Details</DropdownMenuItem>
 *     <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
 *   </DropdownMenuGroup>
 *   <DropdownMenuSeparator />
 *   <DropdownMenuGroup label="Danger Zone">
 *     <DropdownMenuItem onClick={handleDelete} variant="danger">Delete</DropdownMenuItem>
 *   </DropdownMenuGroup>
 * </DropdownMenu>
 * ```
 */

'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from './Tooltip';
import { cn } from './utils';

export interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  className?: string;
  'data-testid'?: string;
}

export interface DropdownMenuGroupProps {
  label?: string;
  children: ReactNode;
}

export interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: 'default' | 'danger';
  icon?: ReactNode;
}

export interface DropdownMenuSeparatorProps {
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  placement = 'bottom-end',
  className,
  'data-testid': testId,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Ensure we only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    // Use requestAnimationFrame to ensure Portal element is in DOM
    const positionMenu = () => {
      if (!menuRef.current || !triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (placement) {
        case 'bottom-start':
          top = triggerRect.bottom + 8;
          left = triggerRect.left;
          break;
        case 'bottom-end':
          top = triggerRect.bottom + 8;
          left = triggerRect.right - menuRect.width;
          break;
        case 'top-start':
          top = triggerRect.top - menuRect.height - 8;
          left = triggerRect.left;
          break;
        case 'top-end':
          top = triggerRect.top - menuRect.height - 8;
          left = triggerRect.right - menuRect.width;
          break;
      }

      // Ensure menu stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width - 16;
      }
      if (left < 16) {
        left = 16;
      }

      if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height - 16;
      }
      if (top < 16) {
        top = 16;
      }

      if (menuRef.current) {
        menuRef.current.style.top = `${top}px`;
        menuRef.current.style.left = `${left}px`;
      }
    };

    // Position immediately and on window resize
    requestAnimationFrame(positionMenu);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true); // Capture scroll events in all containers

    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [isOpen, placement, mounted]);

  return (
    <div
      data-testid={testId || 'dropdown-menu'}
      className={cn('dropdown-menu', className)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', display: 'inline-block' }}
      >
        {trigger}
      </div>

      {isOpen && mounted && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            zIndex: 1000,
            minWidth: '200px',
            maxWidth: '320px',
          }}
          className="bg-surface-overlay border border-border-default rounded-xl shadow-lg p-1 mt-1"
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

export function DropdownMenuGroup({ label, children }: DropdownMenuGroupProps) {
  return (
    <div>
      {label && (
        <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled = false,
  tooltip,
  variant = 'default',
  icon,
}: DropdownMenuItemProps) {
  const item = (
    <div
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-sm rounded-lg',
        'transition-colors duration-150 ease-in-out',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent-secondary',
        !disabled && variant === 'danger' ? 'text-error' : disabled ? 'text-text-disabled' : 'text-text-primary'
      )}
    >
      {icon && (
        <span className="w-4 flex items-center justify-center">
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </div>
  );

  if (disabled && tooltip) {
    return (
      <Tooltip content={tooltip} placement="right">
        {item}
      </Tooltip>
    );
  }

  return item;
}

export function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
  return (
    <div
      className={cn('h-px bg-border-default my-2', className)}
    />
  );
}
