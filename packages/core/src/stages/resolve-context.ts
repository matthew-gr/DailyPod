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

  // === STEP 1: If we have a selected meeting, try to map it to a client ===
  if (data.selectedMeeting) {
    const event = data.selectedMeeting.event;
    const emails = event.attendees.map((a) => a.email);
    const lookupResult = lookupClientFolder(sheet, emails, event.title, ["growrwanda.com"]);

    if (lookupResult) {
      log.info(`Mapped "${event.title}" -> client "${lookupResult.client}" (folder: ${lookupResult.driveFolderName})`);

      data.clientMapping = {
        client: lookupResult.client,
        driveFolderId: lookupResult.driveFolderId,
        driveFolderName: lookupResult.driveFolderName,
      };

      try {
        const projectContextResult = await loadProjectContext(
          authConfig,
          lookupResult.driveFolderId,
          lookupResult.driveFolderName,
        );

        if (projectContextResult) {
          log.info(`Loaded project context: ${projectContextResult.source} (${projectContextResult.text.length} chars)`);

          data.meetingContext = {
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

          data.relatedDocuments = [doc];
        } else {
          log.info("No project context found for matched client — will try other meetings or load project summaries");
          // Don't return — fall through to try runner-ups or load summaries
        }
      } catch (err) {
        log.warn(`Failed to load project context: ${err instanceof Error ? err.message : err}`);
      }

      // If we got meeting context, save and return
      if (data.meetingContext) {
        await store.saveArtifact(context.runId, "related-documents", data.relatedDocuments);
        await store.saveArtifact(context.runId, "meeting-context", data.meetingContext);
        await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
        return;
      }
      // Otherwise fall through to runner-ups and then project summaries
    }

    // Try runner-up meetings (runs if selected meeting had no mapping OR had mapping but no state.md)
    if (!data.meetingContext) {
      log.info("Trying runner-up meetings for context...");
      for (const scoredMeeting of data.scoredMeetings.slice(1, 4)) {
        const runnerEmails = scoredMeeting.event.attendees.map((a) => a.email);
        const runnerLookup = lookupClientFolder(sheet, runnerEmails, scoredMeeting.event.title, ["growrwanda.com"]);

        if (runnerLookup) {
          log.info(`Runner-up mapped: "${scoredMeeting.event.title}" -> "${runnerLookup.client}"`);
          data.selectedMeeting = scoredMeeting;
          data.clientMapping = {
            client: runnerLookup.client,
            driveFolderId: runnerLookup.driveFolderId,
            driveFolderName: runnerLookup.driveFolderName,
          };

          try {
            const result = await loadProjectContext(authConfig, runnerLookup.driveFolderId, runnerLookup.driveFolderName);
            if (result) {
              log.info(`Loaded runner-up context: ${result.source} (${result.text.length} chars)`);
              data.meetingContext = {
                meetingTitle: scoredMeeting.event.title,
                meetingTime: scoredMeeting.event.startTime,
                attendeeSummary: scoredMeeting.event.attendees.map((a) => a.name || a.email.split("@")[0]).join(", "),
                summary: result.text,
                keyInsights: [],
                pendingItems: [],
                suggestedPrepQuestions: [],
                relatedDocuments: [{ title: result.fileName, relevance: `source: ${result.source}` }],
              };
              data.relatedDocuments = [{
                id: result.fileId, externalFileId: result.fileId, title: result.fileName,
                sourceType: "doc", lastModified: new Date().toISOString(),
                relevanceScore: 100, relevanceReason: `Primary context: ${result.source}`,
                extractedText: result.text,
              }];

              await store.saveArtifact(context.runId, "related-documents", data.relatedDocuments);
              await store.saveArtifact(context.runId, "meeting-context", data.meetingContext);
              await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
              return;
            }
          } catch (err) {
            log.warn(`Failed to load runner-up context: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  }

  // === STEP 2: No valid meeting or no mapping — load project summaries as fallback ===
  log.info("No meeting with mapped context — loading active project summaries");
  data.selectedMeeting = null;

  try {
    const topEntries = sheet.entries
      .filter((e) => e.matchType === "domain" && e.driveFolderId && e.driveFolderId !== "DROP")
      .sort((a, b) => b.meetingCount - a.meetingCount)
      .slice(0, 8);

    // De-duplicate by folder
    const seen = new Set<string>();
    const uniqueEntries = topEntries.filter((e) => {
      if (seen.has(e.driveFolderId)) return false;
      seen.add(e.driveFolderId);
      return true;
    }).slice(0, 5).map((e) => ({
      client: e.client,
      driveFolderId: e.driveFolderId,
      driveFolderName: e.driveFolderName,
    }));

    log.info(`Loading project summaries from top ${uniqueEntries.length} clients: ${uniqueEntries.map((e) => e.client).join(", ")}`);

    const summaries = await loadMultipleProjectContexts(authConfig, uniqueEntries, 3);
    data.projectSummaries = summaries.map((s) => ({
      client: s.client,
      summary: s.summary,
      source: s.source as "state.md" | "latest-transcript" | "drive-search",
    }));

    log.info(`Loaded ${data.projectSummaries.length} project summaries for general update`);

    await store.saveArtifact(context.runId, "project-summaries" as any, data.projectSummaries);
  } catch (err) {
    log.warn(`Failed to load project summaries: ${err instanceof Error ? err.message : err}`);
  }
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

  if (data.scoredMeetings.length > 1 && result.engagement.engagementLevel === "none") {
    log.info("Selected meeting has no Drive engagement — checking runner-up...");

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
        log.info(`Runner-up "${runnerUp.event.title}" has ${runnerUpResult.engagement.engagementLevel} engagement — promoting`);
        data.selectedMeeting = runnerUp;
        data.relatedDocuments = runnerUpResult.documents;
        data.meetingContext = runnerUpResult.context;
      }
    } catch (err) {
      log.warn(`Failed to check runner-up: ${err instanceof Error ? err.message : err}`);
    }
  }

  await store.saveArtifact(context.runId, "related-documents", data.relatedDocuments);
  await store.saveArtifact(context.runId, "meeting-context", data.meetingContext);
  await store.saveArtifact(context.runId, "selected-meeting", data.selectedMeeting);
}
