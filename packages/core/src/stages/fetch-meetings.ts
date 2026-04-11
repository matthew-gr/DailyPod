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

    // Fetch events for the target date (full 24h window)
    const dateStart = new Date(`${runConfig.date}T00:00:00`);
    const dateEnd = new Date(`${runConfig.date}T23:59:59`);

    // Also look ahead into tomorrow for early meetings
    dateEnd.setHours(dateEnd.getHours() + 12);

    log.info(`Fetching events from ${dateStart.toISOString()} to ${dateEnd.toISOString()}`);

    const events = await client.fetchEvents({
      calendarId: runConfig.calendarId,
      timeMin: dateStart.toISOString(),
      timeMax: dateEnd.toISOString(),
    });

    log.info(`Found ${events.length} events`);

    for (const event of events) {
      log.debug(`  ${event.startTime} — ${event.title} (${event.attendees.length} attendees)`);
    }

    data.meetings = events;

    await store.saveArtifact(context.runId, "meetings", events);
  },
};
