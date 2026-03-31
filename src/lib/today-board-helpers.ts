/**
 * Today Board Helpers (Phase 6.2)
 * 
 * Helper functions for one-click actions in the Today board.
 * Per Master Spec 8.1.5: One click actions (assign sitter, send payment link, resend confirmation, mark complete)
 */

/**
 * Assign sitter to booking (one-click action)
 */
export async function assignSitterToBooking(
  bookingId: string,
  sitterId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sitterId,
        status: "confirmed",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return { success: false, error: errorData.error || "Failed to assign sitter" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign sitter",
    };
  }
}

/**
 * Send payment link (one-click action)
 */
export async function sendPaymentLinkToBooking(
  bookingId: string
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    const response = await fetch("/api/messages/send-payment-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return { success: false, error: errorData.error || "Failed to generate payment link" };
    }

    const data = await response.json();
    return { success: true, link: data.link };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate payment link",
    };
  }
}

/**
 * Resend confirmation (one-click action)
 * Enqueues booking confirmation automation via API
 * Per Master Spec 8.1.5: One click actions - resend confirmation
 */
export async function resendConfirmation(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Phase 6.2: Call resend confirmation API endpoint
    // The API endpoint enqueues booking confirmation automation via automation queue
    const response = await fetch(`/api/bookings/${bookingId}/resend-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return { success: false, error: errorData.error || "Failed to resend confirmation" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resend confirmation",
    };
  }
}

/**
 * Mark booking as complete (one-click action)
 */
export async function markBookingComplete(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      return { success: false, error: errorData.error || "Failed to mark booking complete" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark booking complete",
    };
  }
}

