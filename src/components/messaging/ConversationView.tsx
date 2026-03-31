/**
 * Conversation View Component
 *
 * Displays messages in a conversation thread
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Badge, EmptyState, Skeleton, Select, Modal, Textarea } from '@/components/ui';
import { ArrowLeft, UserPlus, Send } from 'lucide-react';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  status: string;
  bookingId: string | null;
  createdAt: Date | string;
  // Phase 4.1: Anti-poaching fields
  wasBlocked?: boolean;
  antiPoachingFlagged?: boolean;
  antiPoachingAttempt?: {
    id: string;
    violationType: string;
    detectedContent: string;
    action: string;
    resolvedAt: string | null;
    resolvedByUserId: string | null;
  } | null;
  redactedBody?: string | null;
}

interface ConversationViewProps {
  threadId?: string; // New messaging system uses threadId
  participantPhone?: string; // Legacy: used if threadId not provided
  participantName: string;
  bookingId?: string | null;
  role?: 'owner' | 'sitter';
  onBack?: () => void;
}

export default function ConversationView({
  threadId,
  participantPhone,
  participantName,
  bookingId,
  role = 'owner',
  onBack,
}: ConversationViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gate 2: Assignment state
  const [assignedSitterId, setAssignedSitterId] = useState<string | null>(null);
  const [assignedSitterName, setAssignedSitterName] = useState<string | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [sitters, setSitters] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSitterId, setSelectedSitterId] = useState('');
  const [assigning, setAssigning] = useState(false);
  // Phase 4.1: Window status and anti-poaching
  const [activeWindow, setActiveWindow] = useState<{ startAt: string; endAt: string } | null>(null);
  const [sitterHasActiveWindow, setSitterHasActiveWindow] = useState<boolean>(true); // default true so send enabled until we know
  const [nextUpcomingWindow, setNextUpcomingWindow] = useState<{ startAt: string; endAt: string } | null>(null);
  const [numberClass, setNumberClass] = useState<string>('');
  const [showForceSendModal, setShowForceSendModal] = useState(false);
  const [selectedBlockedEvent, setSelectedBlockedEvent] = useState<Message | null>(null);
  const [forceSendReason, setForceSendReason] = useState('');
  const [forceSending, setForceSending] = useState(false);

  useEffect(() => {
    fetchMessages();
    fetchSitters(); // Gate 2: Load sitters for assignment
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchMessages/fetchSitters in interval; threadId/participantPhone/bookingId trigger refetch
  }, [threadId, participantPhone, bookingId]);

  const fetchSitters = async () => {
    try {
      const response = await fetch('/api/sitters?page=1&pageSize=200');
      if (response.ok) {
        const data = await response.json();
        setSitters(data.items || []);
      }
    } catch (err) {
      // Silently fail - sitters not critical
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      // Use new messaging endpoints if threadId is available (Gate 1)
      if (threadId) {
        const endpoint = `/api/messages/threads/${threadId}`;
        console.log('[ConversationView] Fetching thread from:', endpoint);
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        // Phase 4.1: Transform new format with anti-poaching fields
        const transformedMessages = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          direction: msg.direction,
          from: msg.actorType === 'client' ? participantPhone || '' : 'owner',
          to: msg.actorType === 'client' ? 'owner' : participantPhone || '',
          body: msg.body,
          status: msg.deliveryStatus,
          bookingId: bookingId || null,
          createdAt: msg.createdAt,
          wasBlocked: msg.wasBlocked,
          antiPoachingFlagged: msg.antiPoachingFlagged,
          antiPoachingAttempt: msg.antiPoachingAttempt,
          redactedBody: msg.redactedBody,
        }));
        setMessages(transformedMessages);
        // Gate 2 & Phase 4.1: Update assignment state and metadata
        if (data.thread) {
          setAssignedSitterId(data.thread.assignedSitterId || null);
          setAssignedSitterName(data.thread.assignedSitterName || null);
          setAssignmentHistory(data.thread.assignmentHistory || []);
          setActiveWindow(data.thread.activeWindow);
          setSitterHasActiveWindow(data.thread.sitterHasActiveWindow ?? true);
          setNextUpcomingWindow(data.thread.nextUpcomingWindow || null);
          setNumberClass(data.thread.numberClass || '');
        }
        setError(null);
        setLoading(false);
        return;
      }

      // Fallback to legacy endpoint if threadId not available
      const params = new URLSearchParams({ role });
      if (bookingId) {
        params.append('bookingId', bookingId);
      }

      const response = await fetch(`/api/conversations/${encodeURIComponent(participantPhone || '')}?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || sending || !threadId) return;
    if (role === 'sitter' && !sitterHasActiveWindow) return;

    setSending(true);
    setError(null);

    try {
      const endpoint = `/api/messages/send`;
      const payload = { threadId, text: messageText };
      console.log('[ConversationView] Sending message to:', endpoint, payload);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error) {
          setError(data.error);
          setSending(false);
          return;
        }
        if (participantPhone && role === 'owner') {
          const legacyResponse = await fetch(`/api/conversations/${encodeURIComponent(participantPhone)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: messageText,
              bookingId,
              role,
            }),
          });
          if (!legacyResponse.ok) {
            throw new Error('Failed to send message');
          }
          setMessageText('');
          await fetchMessages();
          setSending(false);
          return;
        }
        throw new Error('Failed to send message');
      }

      setMessageText('');
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleAssign = async () => {
    if (!threadId || !selectedSitterId || assigning) return;

    setAssigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/threads/${threadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitterId: selectedSitterId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign sitter');
      }

      // Refresh thread data
      await fetchMessages();
      setShowAssignModal(false);
      setSelectedSitterId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign sitter');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Skeleton height={400} />
      </Card>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border-default">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        )}
        <div className="flex-1">
          <div className="font-semibold text-lg text-text-primary">
            {participantName}
          </div>
          <div className="text-sm text-text-secondary flex items-center gap-2 flex-wrap">
            <span>{participantPhone}</span>
            {/* Phase 4.1: Number class badge */}
            {numberClass && (
              <Badge
                variant={
                  numberClass === 'front_desk' ? 'default' :
                  numberClass === 'sitter' ? 'info' :
                  'default'
                }
              >
                {numberClass === 'front_desk' ? 'Front Desk' :
                 numberClass === 'sitter' ? 'Sitter' :
                 'Pool'}
              </Badge>
            )}
            {/* Phase 4.1: Assignment status */}
            {assignedSitterName && (
              <Badge variant="info">
                Assigned: {assignedSitterName}
              </Badge>
            )}
            {/* Phase 4.1: Active window indicator */}
            {activeWindow && (
              <Badge variant="info">
                Active Window: {new Date(activeWindow.startAt).toLocaleTimeString()} - {new Date(activeWindow.endAt).toLocaleTimeString()}
              </Badge>
            )}
            {/* Phase 4.2: Sitter window status - show next upcoming when no active */}
            {role === 'sitter' && !activeWindow && nextUpcomingWindow && (
              <Badge variant="warning">
                Next window: {new Date(nextUpcomingWindow.startAt).toLocaleString()} – {new Date(nextUpcomingWindow.endAt).toLocaleTimeString()}
              </Badge>
            )}
            {role === 'sitter' && !activeWindow && !nextUpcomingWindow && (
              <Badge variant="warning">
                No active window – messaging disabled
              </Badge>
            )}
          </div>
        </div>
        {/* Gate 2: Assign button (owner only) */}
        {role === 'owner' && threadId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedSitterId(assignedSitterId || '');
              setShowAssignModal(true);
            }}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            {assignedSitterId ? 'Reassign' : 'Assign'}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No messages yet"
            description="Start the conversation by sending a message"
          />
        ) : (
          messages.map((message) => {
            const isOutbound = message.direction === 'outbound';
            const isBlocked = message.wasBlocked === true;
            const hasAntiPoaching = message.antiPoachingFlagged === true;

            return (
              <div
                key={message.id}
                className={`flex mb-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-2xl max-w-[70%] ${
                    isBlocked
                      ? 'bg-status-danger-bg border-2 border-status-danger-border text-text-primary'
                      : isOutbound
                        ? 'bg-surface-inverse text-text-inverse rounded-br-sm'
                        : 'bg-surface-tertiary text-text-primary rounded-bl-sm'
                  }`}
                >
                  {/* Phase 4.1: Blocked message indicator */}
                  {isBlocked && (
                    <div className="mb-2 p-2 bg-status-danger-bg rounded-sm text-sm">
                      {role === 'sitter' ? (
                        <div className="font-semibold">
                          Your message could not be sent. Please avoid sharing phone numbers, emails, external links, or social handles. Use the app for all client communication.
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold mb-1">
                            ⚠️ Message Blocked - Anti-Poaching Violation
                          </div>
                          {message.antiPoachingAttempt && (
                            <div className="text-xs mb-1">
                              Violation: {message.antiPoachingAttempt.violationType}
                            </div>
                          )}
                          {message.id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedBlockedEvent(message);
                                setShowForceSendModal(true);
                              }}
                              className="mt-2"
                            >
                              Force Send
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <div className="mb-1">
                    {isBlocked && role === 'sitter'
                      ? 'Message blocked'
                      : isBlocked && message.redactedBody
                        ? message.redactedBody
                        : message.body}
                  </div>
                  <div className="text-xs opacity-70 text-right flex justify-between items-center">
                    <span>{formatTime(message.createdAt)}</span>
                    {hasAntiPoaching && !isBlocked && (
                      <Badge variant="warning" className="text-xs">
                        ⚠️
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border-default">
        {/* Phase 4.2: Sitter send gating - friendly UX when outside window */}
        {role === 'sitter' && !sitterHasActiveWindow && (
          <div className="mb-2 p-3 bg-status-warning-bg border border-status-warning-border rounded-md text-sm text-status-warning-text">
            Messages can only be sent during your active booking windows.
            {nextUpcomingWindow && (
              <span> Your next window for this client is {new Date(nextUpcomingWindow.startAt).toLocaleString()} – {new Date(nextUpcomingWindow.endAt).toLocaleTimeString()}.</span>
            )}
          </div>
        )}
        {error && (
          <div className="mb-2 p-2 bg-status-danger-bg text-status-danger-text rounded-md text-sm">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={role === 'sitter' && !sitterHasActiveWindow ? 'Messaging disabled outside booking window' : 'Type a message...'}
            className="flex-1"
            disabled={role === 'sitter' && !sitterHasActiveWindow}
          />
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!messageText.trim() || sending || (role === 'sitter' && !sitterHasActiveWindow)}
            leftIcon={<Send className="w-4 h-4" />}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>

      {/* Gate 2: Assignment Modal */}
      {showAssignModal && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedSitterId('');
          }}
          title={assignedSitterId ? "Reassign Sitter" : "Assign Sitter"}
          size="sm"
        >
          <div className="flex flex-col gap-4">
            <Select
              label="Select Sitter"
              value={selectedSitterId}
              onChange={(e) => setSelectedSitterId(e.target.value)}
              options={[
                { value: '', label: 'Unassign (no sitter)' },
                ...sitters.map(s => ({
                  value: s.id,
                  label: `${s.firstName} ${s.lastName}`,
                })),
              ]}
            />
            {assignmentHistory.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">
                  Assignment History
                </div>
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                  {assignmentHistory.slice(0, 5).map((audit) => (
                    <div key={audit.id} className="text-xs text-text-secondary">
                      {new Date(audit.createdAt).toLocaleDateString()}: {audit.fromSitterName || 'Unassigned'} → {audit.toSitterName || 'Unassigned'}
                      {audit.reason && (
                        <div className="text-xs italic mt-1">
                          Reason: {audit.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedSitterId('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAssign}
                disabled={assigning}
                isLoading={assigning}
              >
                {assignedSitterId ? 'Reassign' : 'Assign'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Phase 4.1: Force Send Modal */}
      {showForceSendModal && selectedBlockedEvent && (
        <Modal
          isOpen={showForceSendModal}
          onClose={() => {
            setShowForceSendModal(false);
            setSelectedBlockedEvent(null);
            setForceSendReason('');
          }}
          title="Force Send Blocked Message"
          size="md"
        >
          <div className="flex flex-col gap-4">
            {/* Blocked content preview (redacted) */}
            <div>
              <div className="text-sm font-semibold mb-2">
                Blocked Content Preview (Redacted):
              </div>
              <Card className="p-3 bg-status-danger-bg border-status-danger-border">
                <div className="text-sm text-text-secondary italic">
                  {selectedBlockedEvent.redactedBody || selectedBlockedEvent.body}
                </div>
              </Card>
            </div>

            {/* Violation reasons list */}
            {selectedBlockedEvent.antiPoachingAttempt && (
              <div>
                <div className="text-sm font-semibold mb-2">
                  Violation Reasons:
                </div>
                <div className="p-3 bg-surface-tertiary rounded-md">
                  <div className="mb-2">
                    <strong>Type:</strong> {selectedBlockedEvent.antiPoachingAttempt.violationType}
                  </div>
                  <div className="mb-2">
                    <strong>Detected Content:</strong> {selectedBlockedEvent.antiPoachingAttempt.detectedContent}
                  </div>
                  <div>
                    <strong>Action:</strong> {selectedBlockedEvent.antiPoachingAttempt.action}
                  </div>
                </div>
              </div>
            )}

            {/* Explicit reason input (required) */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Reason for Force Send <span className="text-status-danger-text">*</span>
              </label>
              <Textarea
                value={forceSendReason}
                onChange={(e) => setForceSendReason(e.target.value)}
                placeholder="Explain why this message should be sent despite the anti-poaching violation..."
                rows={4}
                required
              />
              <div className="text-xs text-text-secondary mt-1">
                This action will be logged and audited.
              </div>
            </div>

            {/* Confirmation message */}
            <div className="p-3 bg-status-warning-bg rounded-md border border-status-warning-border">
              <div className="text-sm font-semibold mb-1">
                ⚠️ Confirmation Required
              </div>
              <div className="text-sm">
                This action will override the anti-poaching block and send the message.
                Your reason will be logged for audit purposes.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowForceSendModal(false);
                  setSelectedBlockedEvent(null);
                  setForceSendReason('');
                }}
                disabled={forceSending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!forceSendReason.trim() || !selectedBlockedEvent.id) return;

                  setForceSending(true);
                  try {
                    const response = await fetch(`/api/messages/events/${selectedBlockedEvent.id}/force-send`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: forceSendReason }),
                    });

                    if (!response.ok) {
                      throw new Error('Failed to force send message');
                    }

                    // Refresh messages
                    await fetchMessages();
                    setShowForceSendModal(false);
                    setSelectedBlockedEvent(null);
                    setForceSendReason('');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to force send message');
                  } finally {
                    setForceSending(false);
                  }
                }}
                disabled={!forceSendReason.trim() || forceSending}
              >
                {forceSending ? 'Sending...' : 'Force Send'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
