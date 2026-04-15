import { resolveMeetingContext } from "@dailypod/meeting-context";
import { loadMappingSheet, lookupClientFolder } from "@dailypod/mapping";
import { loadProjectContext, loadMultipleProjectContexts } from "@dailypod/project-context";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";
import type { MeetingContext, RetrievedDocument } from "@dailypod/types";

export const resolveContextStage: PipelineStage = {
  name: "resolve-context",

  async execute(context: RunContext): Promise<void> {
    if (context.advancedClientResolution) {
      await resolveAdvanced(context);
    } else {
      await resolveDefault(context);
    }
  },
};

async function resolveAdvanced(context: RunContext): Promise<void> {
  const { config, logger, store, data } = context;
  const log = logger.child("resolve-context");

  const authConfig = {
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    refreshToken: config.google.refreshToken,
  };

  if (!context.mappingSheetId) {
    log.warn("Advanced client resolution enabled but no mappingSheetId — falling back to default");
    await resolveDefault(context);
    return;
  }

  log.info("Loading client mapping sheet...");
  const sheet = await loadMappingSheet(authConfig, context.mappingSheetId);
  log.info(`Loaded ${sheet.entries.length} mapping entries (${sheet.byDomain.size} domains, ${sheet.byEmail.size} emails)`);

  // Try the selected meeting first, then runner-ups
  const meetingsToTry = data.scoredMeetings.slice(0, 4);

  for (const scoredMeeting of meetingsToTry) {
    const event = scoredMeeting.event;
    const emails = event.attendees.map((a) => a.email);
    const lookupResult = lookupClientFolder(sheet, emails, event.title, ["growrwanda.com"]);

    if (!lookupResult) {
      log.info(`No mapping found for "${event.title}" — trying next meeting`);
      continue;
    }

    log.info(`Mapped "${event.title}" -> client "${lookupResult.client}" (folder: ${lookupResult.driveFolderName}, domain: ${lookupResult.matchedDomain})`);

    // Set the client mapping on pipeline data
    data.clientMapping = {
      client: lookupResult.client,
      driveFolderId: lookupResult.driveFolderId,
      driveFolderName: lookupResult.driveFolderName,
    };

    // Update selected meeting to the one we matched
    data.selectedMeeting = scoredMeeting;

    // Load project context (state.md or latest transcript)
    try {
      const projectContextResult = await loadProjectContext(
        authConfig,
        lookupResult.driveFolderId,
        lookupResult.driveFolderName,
      );

      if (projectContextResult) {
        log.info(`Loaded project context: ${projectContextResult.source} (${projectContextResult.text.length} chars)`);

        const meetingContext: MeetingContext = {
          meetingTitle: event.title,
          meetingTime: event.startTime,
          attendeeSummary: event.attendees.map((a) => a.name || a.email.split("@")[0]).join(", "),
          summary: projectContextResult.text,
          keyInsights: [],
          pendingItems: [],
          suggestedPrepQuestions: [],
          relatedDocuments: [{ title: projectContextResult.fileName, relevance: `source: ${projectContextResult.source}` }],
        };

        const doc: RetrievedDocument = {
          id: projectContextResult.fileId,
          externalFileId: projectContextResult.fileId,
          title: projectContextResult.fileName,
          sourceType: "doc",
          lastModified: new Date().toISOString(),
          relevanceScore: 100,
          relevanceReason: `Primary context: ${projectContextResult.source}`,
          extractedText: projectContextResult.text,
        };

        data.meetingContext = meetingContext;
        data.relatedDocuments = [doc];
      } else {
        log.info("No project context found (no state.md or transcript)");
      }
    } catch (err) {
      log.warn(`Failed to load project context: ${err instanceof Error ? err.message : err}`);
    }

    // Save artifacts
    await store.saveArtifact(context.runId, "related-documents", data.relatedDocuments);
    await store.saveArtifact(context.runId, "meeting-context", data.meetingContext);
    await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
    return;
  }

  // No mapping found for any meeting — try loading project summaries for no-meeting fallback
  log.info("No client mapping found for any meeting — loading project summaries as fallback");
  data.selectedMeeting = null;

  try {
    // Get top entries sorted by meeting count (entries are already in sheet order)
    const topEntries = sheet.entries
      .filter((e) => e.matchType === "domain")
      .sort((a, b) => b.meetingCount - a.meetingCount)
      .slice(0, 5)
      .map((e) => ({
        client: e.client,
        driveFolderId: e.driveFolderId,
        driveFolderName: e.driveFolderName,
      }));

    // De-duplicate by client
    const seen = new Set<string>();
    const uniqueEntries = topEntries.filter((e) => {
      if (seen.has(e.client)) return false;
      seen.add(e.client);
      return true;
    });

    const summaries = await loadMultipleProjectContexts(authConfig, uniqueEntries, 5);
    data.projectSummaries = summaries.map((s) => ({
      client: s.client,
      summary: s.summary,
      source: s.source as "state.md" | "latest-transcript" | "drive-search",
    }));

    log.info(`Loaded ${data.projectSummaries.length} project summaries for fallback`);
  } catch (err) {
    log.warn(`Failed to load project summaries: ${err instanceof Error ? err.message : err}`);
  }

  // Fall back to default resolution
  await resolveDefault(context);
}

async function resolveDefault(context: RunContext): Promise<void> {
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
  if (data.scoredMeetings.length > 1 && result.engagement.engagementLevel === "none") {
    log.info("Selected meeting has no Drive engagement — checking if another meeting has better engagement...");

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
  await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
}
