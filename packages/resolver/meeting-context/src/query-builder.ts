import type { CalendarEvent, ScoredMeeting } from "@dailypod/types";

/**
 * Generate search queries from a meeting to find related Drive files.
 *
 * Strategy:
 * 1. Meeting title (strongest signal)
 * 2. Key words from the title (removing common filler)
 * 3. Attendee names (people involved → their docs)
 * 4. Description keywords if present
 */
export function buildSearchQueries(meeting: ScoredMeeting): string[] {
  const event = meeting.event;
  const queries: string[] = [];

  // 1. Full title (cleaned)
  const cleanTitle = cleanMeetingTitle(event.title);
  if (cleanTitle.length > 2) {
    queries.push(cleanTitle);
  }

  // 2. Significant words from title
  const titleWords = extractSignificantWords(cleanTitle);
  if (titleWords.length >= 2) {
    queries.push(titleWords.join(" "));
  }

  // 3. Attendee names (first names are often in doc titles)
  for (const attendee of event.attendees.slice(0, 5)) {
    const name = attendee.name || attendee.email.split("@")[0];
    if (name.length > 2) {
      queries.push(name);
    }
  }

  // 4. Description keywords
  if (event.description) {
    const descWords = extractSignificantWords(event.description);
    if (descWords.length >= 2) {
      queries.push(descWords.slice(0, 4).join(" "));
    }
  }

  // 5. For recurring meetings, add "transcript" + title combo
  if (event.isRecurring) {
    queries.push(`${cleanTitle} transcript`);
    queries.push(`${cleanTitle} notes`);
    queries.push(`${cleanTitle} agenda`);
  }

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  return queries.filter((q) => {
    const lower = q.toLowerCase().trim();
    if (seen.has(lower) || lower.length < 3) return false;
    seen.add(lower);
    return true;
  });
}

const FILLER_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
  "for", "of", "with", "by", "from", "is", "it", "this", "that",
  "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "shall", "can", "need", "must", "weekly",
  "biweekly", "monthly", "daily", "meeting", "call", "sync",
  "check-in", "checkin", "update", "status",
]);

function cleanMeetingTitle(title: string): string {
  return title
    .replace(/<>/g, " ")     // Bryan<>Matt → Bryan Matt
    .replace(/[:\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSignificantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER_WORDS.has(w));
}
