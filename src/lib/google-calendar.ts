import { google } from "googleapis";

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEvent
): Promise<string | null> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    console.error("Failed to create Google Calendar event:", error);
    return null;
  }
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEvent
): Promise<boolean> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });

    return true;
  } catch (error) {
    console.error("Failed to update Google Calendar event:", error);
    return false;
  }
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return true;
  } catch (error) {
    console.error("Failed to delete Google Calendar event:", error);
    return false;
  }
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin?: string,
  timeMax?: string
): Promise<any[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  } catch (error) {
    console.error("Failed to list Google Calendar events:", error);
    return [];
  }
}