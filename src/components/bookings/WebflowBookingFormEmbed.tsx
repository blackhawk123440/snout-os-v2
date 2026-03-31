/**
 * WebflowBookingFormEmbed Component
 * 
 * Embeds the external Webflow booking form for create and edit modes.
 * Supports prefill via URL params or postMessage.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { BookingFormValues } from '@/lib/bookings/booking-form-mapper';

export interface WebflowBookingFormEmbedProps {
  mode: 'create' | 'edit';
  bookingId?: string;
  initialValues?: Partial<BookingFormValues>;
  apiUrl?: string;
  createdFrom?: string;
  sourceUrl?: string;
  inline?: boolean;
  onSuccess?: (result: { bookingId: string; booking?: unknown; payload?: unknown }) => void;
  onCancel?: () => void;
}

const DEFAULT_FORM_URL = '/booking-form';

export const WebflowBookingFormEmbed: React.FC<WebflowBookingFormEmbedProps> = ({
  mode,
  bookingId,
  initialValues,
  apiUrl,
  createdFrom,
  sourceUrl = DEFAULT_FORM_URL,
  inline = false,
  onSuccess,
  onCancel,
}) => {
  const isMobile = useMobile();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const minInlineHeight = isMobile ? 760 : 680;
  const maxInlineHeight = 2600;
  const resolvedInlineHeight = Math.min(maxInlineHeight, Math.max(minInlineHeight, iframeHeight));

  useEffect(() => {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const trustedOrigins = new Set<string>(['https://booking-form-u01h.onrender.com']);
    if (baseOrigin) trustedOrigins.add(baseOrigin);
    try {
      if (baseOrigin) {
        trustedOrigins.add(new URL(sourceUrl, baseOrigin).origin);
      }
    } catch {
      // Keep fallback origins only.
    }

    // Listen for postMessage from embedded form
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (!trustedOrigins.has(event.origin)) {
        return;
      }

      // Handle form submission success
      if (event.data?.type === 'BOOKING_FORM_SUBMIT') {
        const bookingData = event.data.booking?.booking || event.data.booking;
        const newBookingId = bookingData?.id || event.data.bookingId || bookingId;
        if (newBookingId && onSuccess) {
          onSuccess({
            bookingId: newBookingId,
            booking: bookingData,
            payload: event.data.payload,
          });
        }
      }

      // Handle form cancel
      if (event.data?.type === 'BOOKING_FORM_CANCELLED') {
        if (onCancel) {
          onCancel();
        }
      }

      // Dynamic iframe height updates
      if (event.data?.type === 'iframe-resize' && typeof event.data.height === 'number') {
        setIframeHeight(Math.ceil(event.data.height));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [bookingId, onSuccess, onCancel, sourceUrl]);

  useEffect(() => {
    // Send prefill data to embedded form if in edit mode
    if (mode === 'edit' && iframeRef.current && initialValues) {
      const iframe = iframeRef.current;
      iframe.onload = () => {
        // Wait for iframe to be ready, then send prefill data
        setTimeout(() => {
          iframe.contentWindow?.postMessage({
            type: 'PREFILL_BOOKING_FORM',
            bookingId,
            data: initialValues,
          }, '*');
        }, 500);
      };
    }
  }, [mode, bookingId, initialValues]);

  // Build URL with query params for prefill (fallback if postMessage doesn't work)
  const buildFormUrl = () => {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(sourceUrl, baseOrigin);
    if (apiUrl) url.searchParams.set('apiUrl', apiUrl);
    if (createdFrom) url.searchParams.set('createdFrom', createdFrom);
    if (mode === 'edit' && bookingId) {
      url.searchParams.set('mode', 'edit');
      url.searchParams.set('bookingId', bookingId);
      if (initialValues) {
        // Add prefill params
        if (initialValues.firstName) url.searchParams.set('firstName', initialValues.firstName);
        if (initialValues.lastName) url.searchParams.set('lastName', initialValues.lastName);
        if (initialValues.phone) url.searchParams.set('phone', initialValues.phone);
        if (initialValues.email) url.searchParams.set('email', initialValues.email);
        if (initialValues.address) url.searchParams.set('address', initialValues.address);
        if (initialValues.service) url.searchParams.set('service', initialValues.service);
        if (initialValues.startAt) url.searchParams.set('startAt', initialValues.startAt);
        if (initialValues.endAt) url.searchParams.set('endAt', initialValues.endAt);
      }
    } else {
      url.searchParams.set('mode', 'create');
    }
    return url.toString();
  };

  const iframeContent = (
    <iframe
      ref={iframeRef}
      src={buildFormUrl()}
      onLoad={() => setIsLoaded(true)}
      style={{
        width: '100%',
        height: inline ? `${resolvedInlineHeight}px` : '100%',
        display: 'block',
        border: 'none',
        borderRadius: inline ? tokens.borderRadius.xl : tokens.borderRadius.md,
        backgroundColor: '#fff',
      }}
      title="Booking Form"
      allow="camera; microphone"
    />
  );

  if (inline) {
    return (
      <Card padding={false} className="relative overflow-hidden rounded-lg">
        <div style={{ minHeight: `${resolvedInlineHeight}px` }}>
          {!isLoaded && (
            <div className="absolute inset-0 z-10 animate-pulse bg-surface-secondary" aria-hidden />
          )}
          {iframeContent}
        </div>
      </Card>
    );
  }

  if (isMobile) {
    // Mobile: Full screen modal
    return (
      <Modal
        isOpen={true}
        onClose={onCancel || (() => {})}
        title={mode === 'edit' ? 'Edit Booking' : 'New Booking'}
        size="full"
      >
        <div style={{ height: 'calc(100vh - 120px)', padding: tokens.spacing[2] }}>
          {iframeContent}
        </div>
      </Modal>
    );
  }

  // Desktop: Modal with fixed size
  return (
    <Modal
      isOpen={true}
      onClose={onCancel || (() => {})}
      title={mode === 'edit' ? 'Edit Booking' : 'New Booking'}
      size="xl"
    >
      <div style={{ height: '80vh', minHeight: '600px' }}>
        {iframeContent}
      </div>
    </Modal>
  );
};

