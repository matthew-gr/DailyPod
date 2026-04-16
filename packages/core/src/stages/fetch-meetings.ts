import { GoogleCalendarClient } from "@dailypod/calendar";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const fetchMeetingsStage: PipelineStage = {
  name: "fetch-meetings",

  async execute(context: RunContext): Promise<void> {
    const { config, runConfig, logger, store, data } = context;
    const log = logger.child("fetch-meetings");

    const client = new GoogleCalendarClient({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      refreshToken: config.google.refreshToken,
    });

    // Fetch events for the target date only (no lookahead into next day)
    // Google Calendar API accepts date-only strings and respects the calendar's timezone
    const timeMin = `${runConfig.date}T00:00:00Z`;
    const timeMax = `${runConfig.date}T23:59:59Z`;

    // If user has a timezone, adjust boundaries to cover their full local day
    const tz = context.timezone;
    let fetchMin = timeMin;
    let fetchMax = timeMax;

    if (tz && tz !== "UTC") {
      // Widen the window to account for timezone offset
      // e.g. Africa/Kigali is UTC+2: their midnight = 22:00 UTC previous day
      // Fetch a wide window and filter by the user's local date
      const start = new Date(`${runConfig.date}T00:00:00Z`);
      start.setHours(start.getHours() - 14); // cover UTC-12 to UTC+14
      const end = new Date(`${runConfig.date}T23:59:59Z`);
      end.setHours(end.getHours() + 14);
      fetchMin = start.toISOString();
      fetchMax = end.toISOString();
    }

    log.info(`Fetching events from ${fetchMin} to ${fetchMax} (tz: ${tz || "UTC"})`);

    const events = await client.fetchEvents({
      calendarId: runConfig.calendarId,
      timeMin: fetchMin,
      timeMax: fetchMax,
    });

    // Filter to only events that start on the target date in the user's timezone
    const targetDate = runConfig.date; // YYYY-MM-DD
    const filteredEvents = events.filter((event) => {
      const eventDate = getDateInTimezone(event.startTime, tz || "UTC");
      return eventDate === targetDate;
    });

    log.info(`Found ${events.length} events, ${filteredEvents.length} on target date ${targetDate}`);

    for (const event of filteredEvents) {
      log.debug(`  ${event.startTime} — ${event.title} (${event.attendees.length} attendees)`);
    }

    data.meetings = filteredEvents;

    await store.saveArtifact(context.runId, "meetings", filteredEvents);
  },
};

/**
 * Get the YYYY-MM-DD date string for a given ISO timestamp in a specific timezone.
 */
function getDateInTimezone(isoTime: string, timezone: string): string {
  try {
    const d = new Date(isoTime);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d); // Returns YYYY-MM-DD in en-CA locale
  } catch {
    // Fallback: just extract the date portion
    return isoTime.slice(0, 10);
  }
}
