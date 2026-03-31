/**
 * CommandProvider Component
 * UI Constitution V1 - Phase 3
 * 
 * Initializes command registry and provides command context.
 */

'use client';

import { useEffect } from 'react';
import { registerAllCommands } from '@/commands/commands';
import { CommandPalette } from './command/CommandPalette';
import { ToastProvider } from './ui/Toast';

let commandsRegistered = false;

export function CommandProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register commands once on mount
    if (!commandsRegistered) {
      try {
        registerAllCommands();
        commandsRegistered = true;
        console.log('✅ Command registry initialized');
      } catch (error) {
        console.error('❌ Failed to initialize command registry:', error);
      }
    }
  }, []);

  return (
    <ToastProvider>
      {children}
      <CommandPalette />
    </ToastProvider>
  );
}
