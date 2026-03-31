/**
 * New Message Modal
 * 
 * Allows owner to start a new conversation with any phone number.
 * Creates or reuses a thread and sends the first message.
 */

'use client';

import { useState } from 'react';
import { Modal, Button, Input, EmptyState } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useCreateThread } from '@/lib/api/hooks';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThreadCreated?: (threadId: string) => void;
}

export function NewMessageModal({ isOpen, onClose, onThreadCreated }: NewMessageModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createThread = useCreateThread();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone number (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedPhone = phoneNumber.replace(/\s|-|\(|\)/g, '');
    
    if (!cleanedPhone.match(phoneRegex)) {
      setError('Please enter a valid phone number (E.164 format, e.g., +15551234567)');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    try {
      const result = await createThread.mutateAsync({
        phoneNumber: cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`,
        initialMessage: message.trim(),
      });

      if (result.threadId) {
        setPhoneNumber('');
        setMessage('');
        onThreadCreated?.(result.threadId);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create conversation');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Conversation"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
          <div>
            <label style={{ display: 'block', marginBottom: tokens.spacing[2], fontWeight: tokens.typography.fontWeight.medium }}>
              Phone Number
            </label>
            <Input
              type="tel"
              placeholder="+15551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={createThread.isPending}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: tokens.typography.fontSize.xs[0], color: tokens.colors.text.secondary, marginTop: tokens.spacing[1] }}>
              Enter phone number in E.164 format (e.g., +15551234567)
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: tokens.spacing[2], fontWeight: tokens.typography.fontWeight.medium }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={createThread.isPending}
              rows={4}
              style={{
                width: '100%',
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.radius.sm,
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                fontSize: tokens.typography.fontSize.sm[0],
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: tokens.spacing[2],
              backgroundColor: tokens.colors.error[50],
              color: tokens.colors.error[800],
              borderRadius: tokens.radius.sm,
              fontSize: tokens.typography.fontSize.sm[0],
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: tokens.spacing[2], justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={createThread.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createThread.isPending || !phoneNumber.trim() || !message.trim()}
            >
              {createThread.isPending ? 'Creating...' : 'Send Message'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
