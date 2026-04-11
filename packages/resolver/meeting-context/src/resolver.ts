import type {
  ScoredMeeting,
  RetrievedDocument,
  MeetingContext,
} from "@dailypod/types";
import { GoogleDriveClient } from "@dailypod/drive";
import type { GoogleAuthConfig } from "@dailypod/calendar";
import { buildSearchQueries } from "./query-builder.js";
import { scoreDocRelevance, countEngagementSignals } from "./relevance-scorer.js";

export interface ResolverConfig {
  authConfig: GoogleAuthConfig;
  /** Only search docs modified in the last N days */
  lookbackDays?: number;
  /** Max total docs to keep after scoring */
  maxDocs?: number;
  /** Minimum relevance score to keep a doc */
  minRelevanceScore?: number;
}

export interface ResolverResult {
  documents: RetrievedDocument[];
  engagement: {
    transcriptCount: number;
    notesCount: number;
    totalRelated: number;
    engagementLevel: "high" | "medium" | "low" | "none";
  };
  context: MeetingContext;
}

export async function resolveMeetingContext(
  meeting: ScoredMeeting,
  config: ResolverConfig
): Promise<ResolverResult> {
  const lookbackDays = config.lookbackDays || 90;
  const maxDocs = config.maxDocs || 10;
  const minScore = config.minRelevanceScore || 10;

  const drive = new GoogleDriveClient(config.authConfig);

  // Build search queries from meeting metadata
  const queries = buildSearchQueries(meeting);

  // Calculate lookback date
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

  // Search Drive
  const rawDocs = await drive.searchFiles({
    queries,
    modifiedAfter: lookbackDate.toISOString(),
    maxPerQuery: 8,
  });

  // Re-score docs for relevance to this specific meeting
  const scoredDocs = rawDocs
    .map((doc) => scoreDocRelevance(doc, meeting.event))
    .filter((doc) => doc.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxDocs);

  // Measure engagement signals
  const engagement = countEngagementSignals(scoredDocs);

  // Extract text from top docs (up to 3) for context building
  const topDocs = scoredDocs.slice(0, 3);
  for (const doc of topDocs) {
    if (!doc.extractedText) {
      // Determine mime type from sourceType for export
      const mimeType =
        doc.sourceType === "doc"
          ? "application/vnd.google-apps.document"
          : doc.sourceType === "slide"
            ? "application/vnd.google-apps.presentation"
            : doc.sourceType === "sheet"
              ? "application/vnd.google-apps.spreadsheet"
              : undefined;

      doc.extractedText = await drive.extractText(doc.externalFileId, mimeType);
    }
  }

  // Build context object
  const context = buildContext(meeting, scoredDocs, engagement);

  return { documents: scoredDocs, engagement, context };
}

function buildContext(
  meeting: ScoredMeeting,
  docs: RetrievedDocument[],
  engagement: ReturnType<typeof countEngagementSignals>
): MeetingContext {
  const event = meeting.event;

  // Summarize attendees
  const attendeeNames = event.attendees
    .map((a) => a.name || a.email.split("@")[0])
    .slice(0, 8);
  const attendeeSummary =
    attendeeNames.length > 0
      ? `${attendeeNames.join(", ")}${event.attendees.length > 8 ? ` (+${event.attendees.length - 8} more)` : ""}`
      : "No attendees listed";

  // Build document reference list
  const relatedDocuments = docs.slice(0, 5).map((d) => ({
    title: d.title,
    relevance: d.relevanceReason,
  }));

  // Extract prior context from doc text
  const docTexts = docs
    .filter((d) => d.extractedText && d.extractedText.length > 50)
    .map((d) => d.extractedText!)
    .slice(0, 3);

  // For now, build a simple summary from available data.
  // Module 5 (LLM) will produce a richer summary.
  const summaryParts: string[] = [];

  summaryParts.push(`Meeting: "${event.title}" at ${event.startTime}`);
  summaryParts.push(`Attendees: ${attendeeSummary}`);

  if (event.isRecurring) {
    summaryParts.push("This is a recurring meeting.");
  }

  if (engagement.transcriptCount > 0) {
    summaryParts.push(
      `Found ${engagement.transcriptCount} prior transcript${engagement.transcriptCount !== 1 ? "s" : ""} — suggests active, ongoing engagement.`
    );
  }

  if (engagement.notesCount > 0) {
    summaryParts.push(
      `Found ${engagement.notesCount} related notes/agendas.`
    );
  }

  if (docs.length === 0) {
    summaryParts.push("No related documents found in Drive.");
  }

  if (event.description && event.description.length > 10) {
    summaryParts.push(`Description: ${event.description.slice(0, 300)}`);
  }

  return {
    meetingTitle: event.title,
    meetingTime: event.startTime,
    attendeeSummary,
    summary: summaryParts.join("\n"),
    keyInsights: [], // populated by analyze-context stage
    pendingItems: [], // populated by analyze-context stage
    suggestedPrepQuestions: [], // populated by analyze-context stage
    relatedDocuments,
  };
}
