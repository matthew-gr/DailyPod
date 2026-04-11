import type { CalendarEvent, RetrievedDocument } from "@dailypod/types";

/**
 * Re-score Drive documents based on how relevant they are to a specific meeting.
 *
 * Scoring signals:
 * - Title overlap with meeting title
 * - Attendee name in doc title
 * - Recency (more recent = more relevant)
 * - Doc type (transcripts/notes > slides > sheets)
 * - "transcript" or "notes" in title (strong signal for meeting prep)
 */
export function scoreDocRelevance(
  doc: RetrievedDocument,
  event: CalendarEvent
): RetrievedDocument {
  let score = 0;
  const reasons: string[] = [];

  const docTitle = doc.title.toLowerCase();
  const meetingTitle = event.title.toLowerCase().replace(/<>/g, " ");

  // Title overlap — check significant words
  const meetingWords = meetingTitle
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let titleHits = 0;
  for (const word of meetingWords) {
    if (docTitle.includes(word)) titleHits++;
  }
  if (meetingWords.length > 0) {
    const overlapRatio = titleHits / meetingWords.length;
    if (overlapRatio >= 0.5) {
      score += 30;
      reasons.push(`title overlap (${titleHits}/${meetingWords.length} words)`);
    } else if (titleHits > 0) {
      score += 15;
      reasons.push(`partial title match (${titleHits} words)`);
    }
  }

  // Attendee name in doc title
  for (const attendee of event.attendees) {
    const name = (attendee.name || "").toLowerCase();
    const emailPrefix = attendee.email.split("@")[0].toLowerCase();
    if (name && docTitle.includes(name.split(" ")[0])) {
      score += 15;
      reasons.push(`attendee name: ${attendee.name}`);
      break;
    }
    if (docTitle.includes(emailPrefix)) {
      score += 10;
      reasons.push(`attendee email prefix: ${emailPrefix}`);
      break;
    }
  }

  // Transcript/notes signal
  if (docTitle.includes("transcript")) {
    score += 25;
    reasons.push("transcript");
  } else if (docTitle.includes("notes") || docTitle.includes("agenda")) {
    score += 20;
    reasons.push("notes/agenda");
  } else if (docTitle.includes("summary") || docTitle.includes("recap")) {
    score += 18;
    reasons.push("summary/recap");
  }

  // Recency boost — only if there's already a content match (title/attendee/transcript)
  // Prevents random recently-modified files from qualifying
  if (score > 0 && doc.lastModified) {
    const daysAgo = (Date.now() - new Date(doc.lastModified).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 7) {
      score += 15;
      reasons.push("modified this week");
    } else if (daysAgo <= 30) {
      score += 8;
      reasons.push("modified this month");
    }
  }

  // Doc type boost
  if (doc.sourceType === "doc") {
    score += 5;
  } else if (doc.sourceType === "slide") {
    score += 3;
  }

  return {
    ...doc,
    relevanceScore: score,
    relevanceReason: reasons.length > 0 ? reasons.join(", ") : "weak match",
  };
}

/**
 * Count how many docs look like transcripts or meeting notes.
 * High count = high prior engagement with this meeting.
 */
export function countEngagementSignals(docs: RetrievedDocument[]): {
  transcriptCount: number;
  notesCount: number;
  totalRelated: number;
  engagementLevel: "high" | "medium" | "low" | "none";
} {
  let transcriptCount = 0;
  let notesCount = 0;

  for (const doc of docs) {
    const title = doc.title.toLowerCase();
    if (title.includes("transcript")) transcriptCount++;
    if (title.includes("notes") || title.includes("agenda") || title.includes("summary")) notesCount++;
  }

  const totalRelated = docs.length;
  let engagementLevel: "high" | "medium" | "low" | "none";

  if (transcriptCount >= 3 || totalRelated >= 5) {
    engagementLevel = "high";
  } else if (transcriptCount >= 1 || totalRelated >= 2) {
    engagementLevel = "medium";
  } else if (totalRelated >= 1) {
    engagementLevel = "low";
  } else {
    engagementLevel = "none";
  }

  return { transcriptCount, notesCount, totalRelated, engagementLevel };
}
