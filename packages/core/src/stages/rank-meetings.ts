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

    if (scored.length > 0) {
      data.selectedMeeting = scored[0];
      log.info(`Selected: "${scored[0].event.title}" (score: ${scored[0].score.total.toFixed(1)})`);
    }

    await store.saveArtifact(context.runId, "scored-meetings", scored);
    if (data.selectedMeeting) {
      await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
    }
  },
};
