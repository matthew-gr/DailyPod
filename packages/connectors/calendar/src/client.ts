import { google, type calendar_v3 } from "googleapis";
import type { CalendarEvent, Attendee } from "@dailypod/types";
import type { GoogleAuthConfig } from "./auth.js";
import { createAuthClient } from "./auth.js";

export interface FetchEventsOptions {
  calendarId?: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}

function parseAttendees(
  raw: calendar_v3.Schema$EventAttendee[] | undefined
): Attendee[] {
  if (!raw) return [];
  return raw
    .filter((a) => a.email && !a.resource)
    .map((a) => ({
      email: a.email!,
      name: a.displayName || undefined,
      responseStatus: (a.responseStatus as Attendee["responseStatus"]) || undefined,
      organizer: a.organizer || undefined,
    }));
}

function parseEvent(
  raw: calendar_v3.Schema$Event,
  calendarId: string
): CalendarEvent | null {
  const id = raw.id;
  const title = raw.summary;
  if (!id || !title) return null;

  const startTime = raw.start?.dateTime || raw.start?.date;
  const endTime = raw.end?.dateTime || raw.end?.date;
  if (!startTime || !endTime) return null;

  // Extract meeting link from conferenceData or hangoutLink
  let meetingLink = raw.hangoutLink || undefined;
  if (!meetingLink && raw.conferenceData?.entryPoints) {
    const videoEntry = raw.conferenceData.entryPoints.find(
      (e) => e.entryPointType === "video"
    );
    meetingLink = videoEntry?.uri || undefined;
  }

  return {
    id,
    title,
    startTime,
    endTime,
    attendees: parseAttendees(raw.attendees),
    description: raw.description || "",
    location: raw.location || undefined,
    meetingLink,
    isRecurring: !!raw.recurringEventId,
    recurrenceId: raw.recurringEventId || undefined,
    calendarId,
  };
}

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;

  constructor(authConfig: GoogleAuthConfig) {
    const auth = createAuthClient(authConfig);
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async fetchEvents(options: FetchEventsOptions): Promise<CalendarEvent[]> {
    const calendarId = options.calendarId || "primary";
    const maxResults = options.maxResults || 50;

    const response = await this.calendar.events.list({
      calendarId,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];

    return events
      .map((e) => parseEvent(e, calendarId))
      .filter((e): e is CalendarEvent => e !== null);
  }
}
