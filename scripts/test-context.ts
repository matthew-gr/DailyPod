/**
 * Test context resolution for multiple meetings from today.
 * Usage: npx tsx scripts/test-context.ts
 */

import { resolve } from "node:path";
import { loadConfig } from "@dailypod/config";
import { loadGuide } from "@dailypod/guide";
import { GoogleCalendarClient } from "@dailypod/calendar";
import { rankMeetings } from "@dailypod/meeting-ranker";
import { resolveMeetingContext } from "@dailypod/meeting-context";

const config = loadConfig();
const guide = await loadGuide(resolve(config.paths.guidePath));

const calClient = new GoogleCalendarClient({
  clientId: config.google.clientId,
  clientSecret: config.google.clientSecret,
  refreshToken: config.google.refreshToken,
});

const date = "2026-04-09";
const dateStart = new Date(`${date}T00:00:00`);
const dateEnd = new Date(`${date}T23:59:59`);

console.log("Fetching events...\n");
const events = await calClient.fetchEvents({
  calendarId: "primary",
  timeMin: dateStart.toISOString(),
  timeMax: dateEnd.toISOString(),
});

const ranked = rankMeetings(events, guide);

// Test the top 5 meetings that have attendees (real meetings)
const realMeetings = ranked.filter((m) => m.event.attendees.length > 0);

for (const meeting of realMeetings.slice(0, 5)) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`Meeting: ${meeting.event.title}`);
  console.log(`Score: ${meeting.score.total.toFixed(1)} | ${meeting.score.reasoning}`);
  console.log(`Attendees: ${meeting.event.attendees.map((a) => a.name || a.email).join(", ")}`);
  console.log(`Recurring: ${meeting.event.isRecurring}`);
  console.log(`${"─".repeat(70)}`);

  try {
    const result = await resolveMeetingContext(meeting, {
      authConfig: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        refreshToken: config.google.refreshToken,
      },
      lookbackDays: 90,
      maxDocs: 8,
      minRelevanceScore: 10,
    });

    console.log(`Engagement: ${result.engagement.engagementLevel} (${result.engagement.transcriptCount} transcripts, ${result.engagement.notesCount} notes, ${result.engagement.totalRelated} total)`);
    console.log(`Documents found:`);

    if (result.documents.length === 0) {
      console.log("  (none)");
    } else {
      for (const doc of result.documents.slice(0, 6)) {
        console.log(`  [${doc.relevanceScore.toString().padStart(3)}] ${doc.title}`);
        console.log(`        ${doc.relevanceReason}`);
      }
    }
  } catch (err) {
    console.log(`  ERROR: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${"═".repeat(70)}`);
console.log("Done.");
