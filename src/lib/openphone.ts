interface OpenPhoneMessage {
  to: string[];
  content: string;
  from: string;
}

interface OpenPhoneResponse {
  id: string;
  status: string;
  error?: string;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const apiKey = process.env.OPENPHONE_API_KEY;
    const numberId = process.env.OPENPHONE_NUMBER_ID;
    
    if (!apiKey || !numberId) {
      console.error("[sendSMS] OpenPhone API credentials not configured");
      console.error(`[sendSMS] API Key: ${apiKey ? 'Present' : 'Missing'}, Number ID: ${numberId ? 'Present' : 'Missing'}`);
      return false;
    }

    console.log(`[sendSMS] Sending from number ID: ${numberId} to: ${to}`);
    console.log(`[sendSMS] API endpoint: https://api.openphone.com/v1/phone-numbers/${numberId}/messages`);

    const payload: OpenPhoneMessage = {
      to: [to],
      content: message,
      from: numberId
    };

    const response = await fetch(`https://api.openphone.com/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[sendSMS] Response status: ${response.status}`);
    console.log(`[sendSMS] Response body: ${responseText.substring(0, 200)}`);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        const errorMessage = errorData.message || errorData.error || errorData.error_message || `HTTP ${response.status}`;
        console.error("[sendSMS] OpenPhone API error:", errorMessage);
        console.error("[sendSMS] Full error response:", errorData);
      } catch (e) {
        console.error("[sendSMS] OpenPhone API error:", response.status, response.statusText);
        console.error("[sendSMS] Raw response:", responseText);
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error("[sendSMS] Failed to send SMS:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Send SMS from a specific OpenPhone number
 * This function is used to send SMS from the owner's OpenPhone number to clients
 */
export async function sendSMSFromOpenPhone(fromNumberId: string, to: string, message: string): Promise<boolean> {
  try {
    const apiKey = process.env.OPENPHONE_API_KEY;
    
    if (!apiKey) {
      console.error("[sendSMSFromOpenPhone] OpenPhone API key not configured");
      return false;
    }

    if (!fromNumberId) {
      console.error("[sendSMSFromOpenPhone] OpenPhone number ID not provided");
      return false;
    }

    console.log(`[sendSMSFromOpenPhone] Sending from number ID: ${fromNumberId} to: ${to}`);
    console.log(`[sendSMSFromOpenPhone] API endpoint: https://api.openphone.com/v1/phone-numbers/${fromNumberId}/messages`);

    const payload: OpenPhoneMessage = {
      to: [to],
      content: message,
      from: fromNumberId
    };

    const response = await fetch(`https://api.openphone.com/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[sendSMSFromOpenPhone] Response status: ${response.status}`);
    console.log(`[sendSMSFromOpenPhone] Response body: ${responseText.substring(0, 200)}`);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        const errorMessage = errorData.message || errorData.error || errorData.error_message || `HTTP ${response.status}`;
        console.error("[sendSMSFromOpenPhone] OpenPhone API error:", errorMessage);
        console.error("[sendSMSFromOpenPhone] Full error response:", errorData);
      } catch (e) {
        console.error("[sendSMSFromOpenPhone] OpenPhone API error:", response.status, response.statusText);
        console.error("[sendSMSFromOpenPhone] Raw response:", responseText);
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error("[sendSMSFromOpenPhone] Failed to send SMS:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get OpenPhone contact URL for a phone number
 */
export function getOpenPhoneContactUrl(phone: string): string {
  // Format phone number (remove + and spaces)
  const formattedPhone = phone.replace(/\D/g, '');
  // OpenPhone URLs are typically: https://app.openphone.com/messages/[phone]
  return `https://app.openphone.com/messages/${formattedPhone}`;
}

// Re-export phone formatting for backwards compatibility
export { formatPhoneForAPI as formatPhoneNumber } from "@/lib/phone-format";