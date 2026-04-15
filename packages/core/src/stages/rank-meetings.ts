import { rankMeetings } from "@dailypod/meeting-ranker";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const rankMeetingsStage: PipelineStage = {
  name: "rank-meetings",

  async execute(context: RunContext): Promise<void> {
    const { logger, store, data, guide } = context;
    const log = logger.child("rank-meetings");

    if (data.meetings.length === 0) {
      log.warn("No meetings to rank");
      data.scoredMeetings = [];
      data.selectedMeeting = null;
      return;
    }

    const scored = rankMeetings(data.meetings, guide);
    data.scoredMeetings = scored;

    log.info(`Ranked ${scored.length} meetings:`);
    for (const sm of scored.slice(0, 5)) {
      log.info(
        `  [${sm.score.total.toFixed(1)}] ${sm.event.title} — ${sm.score.reasoning}`
      );
    }

    // Score floor: meetings need minimum score to qualify for deep-dive
    const SCORE_FLOOR = 20;
    if (scored.length > 0 && scored[0].score.total < SCORE_FLOOR) {
      log.info(`Top meeting "${scored[0].event.title}" scored ${scored[0].score.total.toFixed(1)} — below floor of ${SCORE_FLOOR}. No meeting deep-dive.`);
      data.selectedMeeting = null;
    } else if (scored.length > 0) {
      data.selectedMeeting = scored[0];
      log.info(`Selected: "${scored[0].event.title}" (score: ${scored[0].score.total.toFixed(1)})`);
    }

    // If advanced client resolution is on and no meeting has external attendees mapped, clear selection
    if (context.advancedClientResolution && data.selectedMeeting) {
      const hasExternalAttendees = data.selectedMeeting.event.attendees.some(
        (a) => !a.email.endsWith("@growrwanda.com")
      );
      if (!hasExternalAttendees) {
        log.info("Advanced mode: selected meeting has no external attendees — clearing selection");
        data.selectedMeeting = null;
      }
    }

    await store.saveArtifact(context.runId, "scored-meetings", scored);
    if (data.selectedMeeting) {
      await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
    }
  },
};
