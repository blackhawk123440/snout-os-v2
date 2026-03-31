/**
 * CommandPalette Component
 * UI Constitution V1 - Phase 3
 * 
 * Global command palette UI. Opens with Cmd+K / Ctrl+K.
 * Mobile opens as BottomSheet.
 * Uses UI kit components only.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useMobile } from '@/lib/use-mobile';
import { Command } from '@/commands/types';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { CommandList } from './CommandList';
import { CommandEmpty } from './CommandEmpty';
import { CommandPreview } from './CommandPreview';
import { tokens } from '@/lib/design-tokens';

export interface CommandPaletteProps {
  context?: any;
}

export function CommandPalette({ context }: CommandPaletteProps) {
  const isMobile = useMobile();
  const {
    isOpen,
    open,
    close,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    selectCommand,
    selectCommandByIndex,
  } = useCommandPalette(context);

  const [showPreview, setShowPreview] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global: listen for open-command-palette event (e.g. from topbar search)
  useEffect(() => {
    const handler = () => open();
    window.addEventListener('open-command-palette', handler);
    return () => window.removeEventListener('open-command-palette', handler);
  }, [open]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset preview when palette closes
  useEffect(() => {
    if (!isOpen) {
      setShowPreview(false);
      setSelectedCommand(null);
    }
  }, [isOpen]);

  const handleCommandSelect = (index: number) => {
    setSelectedIndex(index);
    const commandResult = filteredCommands[index];
    if (commandResult) {
      setSelectedCommand(commandResult.command);
      setShowPreview(true);
    }
  };

  const handleExecute = async () => {
    if (selectedCommand) {
      await selectCommand(selectedCommand);
      setShowPreview(false);
      setSelectedCommand(null);
    }
  };

  const handleCancel = () => {
    setShowPreview(false);
    setSelectedCommand(null);
  };

  const content = (
    <>
      {/* Search Input */}
      <div style={{ padding: tokens.spacing[4] }}>
        <Input
          ref={inputRef}
          label="Search commands"
          placeholder="Type to search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          autoFocus
        />
      </div>

      {/* Command List or Preview */}
      {showPreview && selectedCommand ? (
        <CommandPreview
          command={selectedCommand}
          context={context || {}}
          onExecute={handleExecute}
          onCancel={handleCancel}
        />
      ) : filteredCommands.length > 0 ? (
        <CommandList
          commands={filteredCommands}
          selectedIndex={selectedIndex}
          onSelect={handleCommandSelect}
          onExecute={(index) => {
            const command = filteredCommands[index]?.command;
            if (command?.danger) {
              handleCommandSelect(index);
            } else {
              selectCommandByIndex(index);
            }
          }}
        />
      ) : (
        <CommandEmpty searchQuery={searchQuery} />
      )}
    </>
  );

  // Telemetry: Log palette opened
  useEffect(() => {
    if (isOpen) {
      console.log('[Command Telemetry]', {
        event: 'palette.opened',
        timestamp: new Date().toISOString(),
      });
    }
  }, [isOpen]);

  // Telemetry: Log search
  useEffect(() => {
    if (isOpen && searchQuery) {
      console.log('[Command Telemetry]', {
        event: 'palette.searched',
        query: searchQuery,
        resultsCount: filteredCommands.length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isOpen, searchQuery, filteredCommands.length]);

  // Mobile: BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={close}
        title="Command Palette"
        dragHandle
        data-testid="command-palette"
      >
        {content}
      </BottomSheet>
    );
  }

  // Desktop: Modal
  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      closeOnBackdropClick
    >
      <div
        data-testid="command-palette"
        style={{
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!showPreview && (
          <div
            style={{
              padding: tokens.spacing[4],
              borderBottom: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <div
              style={{
                fontSize: tokens.typography.fontSize.xl[0],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                marginBottom: tokens.spacing[2],
              }}
            >
              Command Palette
            </div>
            <Input
              ref={inputRef}
              placeholder="Type to search commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              autoFocus
            />
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {showPreview && selectedCommand ? (
            <CommandPreview
              command={selectedCommand}
              context={context || {}}
              onExecute={handleExecute}
              onCancel={handleCancel}
            />
          ) : filteredCommands.length > 0 ? (
            <CommandList
              commands={filteredCommands}
              selectedIndex={selectedIndex}
              onSelect={handleCommandSelect}
              onExecute={(index) => {
                const command = filteredCommands[index]?.command;
                if (command?.danger) {
                  handleCommandSelect(index);
                } else {
                  selectCommandByIndex(index);
                }
              }}
            />
          ) : (
            <CommandEmpty searchQuery={searchQuery} />
          )}
        </div>
      </div>
    </Modal>
  );
}
