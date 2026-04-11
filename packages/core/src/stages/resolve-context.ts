import { resolveMeetingContext } from "@dailypod/meeting-context";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const resolveContextStage: PipelineStage = {
  name: "resolve-context",

  async execute(context: RunContext): Promise<void> {
    const { config, logger, store, data } = context;
    const log = logger.child("resolve-context");

    if (!data.selectedMeeting) {
      log.warn("No selected meeting — skipping context resolution");
      return;
    }

    log.info(`Resolving context for: "${data.selectedMeeting.event.title}"`);

    const result = await resolveMeetingContext(data.selectedMeeting, {
      authConfig: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        refreshToken: config.google.refreshToken,
      },
      lookbackDays: 90,
      maxDocs: 10,
      minRelevanceScore: 10,
    });

    data.relatedDocuments = result.documents;
    data.meetingContext = result.context;

    log.info(`Found ${result.documents.length} related documents`);
    log.info(`Engagement level: ${result.engagement.engagementLevel} (${result.engagement.transcriptCount} transcripts, ${result.engagement.notesCount} notes)`);

    for (const doc of result.documents.slice(0, 5)) {
      log.info(`  [${doc.relevanceScore}] ${doc.title} — ${doc.relevanceReason}`);
    }

    // ── Re-rank: update the selected meeting's score with doc engagement data ──
    // If the top meeting has low/no engagement but another meeting has high engagement,
    // this is a signal to consider re-selecting.
    if (data.scoredMeetings.length > 1 && result.engagement.engagementLevel === "none") {
      log.info("Selected meeting has no Drive engagement — checking if another meeting has better engagement...");

      // Check the #2 meeting for docs (quick check — just the top runner-up)
      const runnerUp = data.scoredMeetings[1];
      try {
        const runnerUpResult = await resolveMeetingContext(runnerUp, {
          authConfig: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
            refreshToken: config.google.refreshToken,
          },
          lookbackDays: 90,
          maxDocs: 5,
          minRelevanceScore: 10,
        });

        if (
          runnerUpResult.engagement.engagementLevel === "high" ||
          runnerUpResult.engagement.engagementLevel === "medium"
        ) {
          log.info(
            `Runner-up "${runnerUp.event.title}" has ${runnerUpResult.engagement.engagementLevel} engagement ` +
            `(${runnerUpResult.engagement.transcriptCount} transcripts) — promoting to selected meeting`
          );
          data.selectedMeeting = runnerUp;
          data.relatedDocuments = runnerUpResult.documents;
          data.meetingContext = runnerUpResult.context;
        } else {
          log.info("Runner-up also has low engagement — keeping original selection");
        }
      } catch (err) {
        log.warn(`Failed to check runner-up context: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Save artifacts
    await store.saveArtifact(context.runId, "related-documents", data.relatedDocuments);
    await store.saveArtifact(context.runId, "meeting-context", data.meetingContext);
    // Re-save selected meeting in case it changed
    await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
  },
};
