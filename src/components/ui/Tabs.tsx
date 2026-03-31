/**
 * Tabs Component
 *
 * Enterprise tab navigation component.
 * On mobile, tabs scroll horizontally with proper spacing.
 */

import React, { useState, createContext, useContext } from 'react';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within Tabs provider');
  }
  return context;
};

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  hideHeader?: boolean; // Hide header, useful when header is rendered separately for sticky behavior
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,
  children,
  hideHeader = false,
}) => {
  const isMobile = useMobile();
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabChange = (tabId: string) => {
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(tabId);
    }
    onTabChange?.(tabId);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div>
        {!hideHeader && (
        <div
          className={cn(
            'flex border-b border-border-default overflow-x-auto overflow-y-hidden shrink-0 pb-[2px]',
            isMobile ? 'gap-1 mb-3 px-3' : 'gap-2 mb-4'
          )}
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => !tab.disabled && handleTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 bg-transparent border-t-0 border-l-0 border-r-0 -mb-[2px] shrink-0 whitespace-nowrap min-h-[2.75rem]',
                  'transition-all duration-150 ease-in-out',
                  isMobile ? 'py-2 px-3 text-sm' : 'py-3 px-4 text-base',
                  isActive ? 'font-semibold' : 'font-normal',
                  tab.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  !tab.disabled && !isActive && 'hover:text-text-primary'
                )}
                style={{
                  borderBottom: isActive ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                  color: isActive ? 'var(--color-text-primary)' : tab.disabled ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)',
                }}
              >
                {tab.icon && <span className="flex items-center">{tab.icon}</span>}
                <span className="leading-normal">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="bg-error text-white rounded-full px-2 py-1 text-xs font-semibold min-w-[1.25rem] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        )}
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const TabPanel: React.FC<TabPanelProps> = ({ id, children, className, style }) => {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;
  return <div className={className} style={style}>{children}</div>;
};
