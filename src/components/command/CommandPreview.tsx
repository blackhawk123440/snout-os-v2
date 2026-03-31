/**
 * CommandPreview Component
 * UI Constitution V1 - Phase 3
 *
 * Shows safety preview before command execution.
 * Blocks execution for dangerous commands until confirmation.
 */

'use client';

import { ReactNode, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Command, CommandContext } from '@/commands/types';
import { tokens } from '@/lib/design-tokens';
import { Button } from '@/components/ui/Button';
import { Flex } from '@/components/ui/Flex';

export interface CommandPreviewProps {
  command: Command;
  context: CommandContext;
  onExecute: () => void;
  onCancel: () => void;
}

export function CommandPreview({
  command,
  context,
  onExecute,
  onCancel,
}: CommandPreviewProps) {
  const [confirmed, setConfirmed] = useState(false);

  const preview = command.preview(context);

  return (
    <div
      data-testid="command-preview"
      className="flex flex-col gap-4 p-6"
    >
      {/* Danger Warning */}
      {command.danger && (
        <div className="p-4 bg-status-danger-bg border border-status-danger-border rounded-md flex items-start gap-3">
          <AlertTriangle
            className="w-5 h-5 text-status-danger-text flex-shrink-0 mt-[2px]"
          />
          <div className="flex-1">
            <div className="text-base font-bold text-status-danger-text mb-1">
              Dangerous Action
            </div>
            <div className="text-sm text-text-secondary">
              This action cannot be undone. Please confirm before proceeding.
            </div>
          </div>
        </div>
      )}

      {/* Command Info */}
      <div className="flex items-center gap-3 pb-4 border-b border-border-default">
        {command.icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-accent-primary">
            {command.icon}
          </div>
        )}
        <div className="flex-1">
          <div className="text-lg font-bold text-text-primary mb-1">
            {command.label}
          </div>
          <div className="text-sm text-text-secondary">
            {command.description}
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="p-4 bg-surface-secondary rounded-md min-h-[100px]">
        {preview}
      </div>

      {/* Confirmation Checkbox for Dangerous Commands */}
      {command.danger && (
        <label
          className="flex items-center gap-2 cursor-pointer p-3 rounded-md transition-colors duration-fast ease-standard"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.accent.secondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="text-sm text-text-primary">
            I understand this action cannot be undone
          </span>
        </label>
      )}

      {/* Actions */}
      <Flex gap={2} justify="flex-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={command.danger ? 'danger' : 'primary'}
          onClick={onExecute}
          disabled={command.danger && !confirmed}
        >
          {command.danger ? 'Confirm & Execute' : 'Execute'}
        </Button>
      </Flex>
    </div>
  );
}
