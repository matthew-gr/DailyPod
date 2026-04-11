import type {
  CalendarEvent,
  ScoredMeeting,
  MeetingScore,
  BriefingGuide,
  VIPContact,
} from "@dailypod/types";

// --- Weights (easy to tune) ---
const WEIGHTS = {
  proximity: 15,
  attendeeImportance: 15,
  titleRelevance: 15,
  recurrence: 10,
  hasRelatedDocs: 5,
  guideMatch: 10,
  vipMatch: 30,       // VIP contacts are the strongest signal
};

// --- Low-value title patterns to penalize ---
const LOW_VALUE_PATTERNS = [
  /^lunch$/i,
  /block$/i,
  /^focus time$/i,
  /^busy$/i,
  /^ooo$/i,
  /^out of office$/i,
  /^commute$/i,
  /^travel$/i,
  /^personal$/i,
  /^gym$/i,
  /^break$/i,
  /^no meeting/i,
  /^family/i,
  /^evening/i,
  /^morning routine/i,
  /^language learn/i,
  /^reach out to/i,
  /^reminder/i,
  /^you're in/i,
  /^welcome to/i,
];

// --- High-value title keywords ---
const HIGH_VALUE_KEYWORDS = [
  "review",
  "strategy",
  "planning",
  "decision",
  "client",
  "board",
  "leadership",
  "exec",
  "kickoff",
  "launch",
  "pitch",
  "proposal",
  "budget",
  "quarterly",
  "all-hands",
  "1:1",
  "one-on-one",
  "interview",
  "debrief",
  "retrospective",
  "standup",
  "weekly",
];

// ─── Scoring functions ───

function scoreProximity(event: CalendarEvent, now: Date): number {
  const start = new Date(event.startTime);
  const hoursAway = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursAway < 0) return 0; // already passed
  if (hoursAway <= 2) return 1.0;
  if (hoursAway <= 4) return 0.85;
  if (hoursAway <= 8) return 0.6;
  if (hoursAway <= 12) return 0.4;
  return 0.2;
}

function scoreAttendeeImportance(event: CalendarEvent): number {
  const count = event.attendees.length;

  if (count === 0) return 0.0; // solo block / personal item
  if (count === 1) return 0.5; // 1:1
  if (count <= 4) return 0.8; // small group — likely high value
  if (count <= 10) return 0.6; // medium group
  return 0.4; // large group
}

function scoreTitleRelevance(event: CalendarEvent): number {
  const title = event.title.toLowerCase();

  for (const pattern of LOW_VALUE_PATTERNS) {
    if (pattern.test(title)) return 0.0;
  }

  let keywordHits = 0;
  for (const keyword of HIGH_VALUE_KEYWORDS) {
    if (title.includes(keyword.toLowerCase())) {
      keywordHits++;
    }
  }

  if (keywordHits >= 2) return 1.0;
  if (keywordHits === 1) return 0.7;
  if (event.description && event.description.length > 50) return 0.5;

  return 0.3;
}

/**
 * Recurrence scoring is now context-dependent:
 * - Recurring + VIP attendees = HIGH (ongoing important relationship, prior transcripts likely)
 * - Recurring + no VIPs = moderate (routine, but still real meeting)
 * - One-off + VIP = HIGH (special occasion with key person)
 * - One-off + no VIP = moderate
 */
function scoreRecurrence(event: CalendarEvent, hasVIP: boolean): number {
  if (event.isRecurring && hasVIP) return 1.0;  // recurring client meeting — very important
  if (!event.isRecurring && hasVIP) return 0.8;  // one-off with VIP
  if (!event.isRecurring) return 0.6;             // one-off, no VIP
  return 0.4;                                     // recurring, no VIP — routine
}

/**
 * VIP matching — the most important signal.
 * Returns 0-1 score plus list of matched VIP names for reasoning.
 */
function scoreVIPMatch(
  event: CalendarEvent,
  vipContacts: VIPContact[]
): { score: number; matchedNames: string[] } {
  if (vipContacts.length === 0 || event.attendees.length === 0) {
    return { score: 0, matchedNames: [] };
  }

  const attendeeEmails = new Set(
    event.attendees.map((a) => a.email.toLowerCase())
  );
  const attendeeNames = new Set(
    event.attendees
      .filter((a) => a.name)
      .map((a) => a.name!.toLowerCase())
  );

  const matchedNames: string[] = [];

  for (const vip of vipContacts) {
    // Match by email (primary)
    if (vip.email && attendeeEmails.has(vip.email.toLowerCase())) {
      matchedNames.push(vip.name || vip.email);
      continue;
    }

    // Match by name (fallback)
    if (vip.name) {
      const vipNameLower = vip.name.toLowerCase();
      for (const attendeeName of attendeeNames) {
        if (
          attendeeName.includes(vipNameLower) ||
          vipNameLower.includes(attendeeName)
        ) {
          matchedNames.push(vip.name);
          break;
        }
      }
    }
  }

  if (matchedNames.length === 0) return { score: 0, matchedNames: [] };

  // Scale: 1 VIP = 0.7, 2+ VIPs = 1.0
  const score = matchedNames.length >= 2 ? 1.0 : 0.7;
  return { score, matchedNames };
}

function scoreGuideMatch(event: CalendarEvent, guide: BriefingGuide): number {
  const title = event.title.toLowerCase();
  const description = (event.description || "").toLowerCase();
  const text = `${title} ${description}`;

  let emphasisHits = 0;
  for (const topic of guide.topicsToEmphasize) {
    const words = topic.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && text.includes(word)) {
        emphasisHits++;
        break;
      }
    }
  }

  let downplayHits = 0;
  for (const topic of guide.topicsToDownplay) {
    const words = topic.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && text.includes(word)) {
        downplayHits++;
        break;
      }
    }
  }

  const base = 0.3;
  const emphasisBoost = Math.min(emphasisHits * 0.25, 0.7);
  const downplayPenalty = Math.min(downplayHits * 0.3, 0.5);

  return Math.max(0, Math.min(1, base + emphasisBoost - downplayPenalty));
}

// ─── Reasoning ───

function buildReasoning(
  event: CalendarEvent,
  breakdown: MeetingScore["breakdown"],
  matchedVIPNames: string[]
): string {
  const parts: string[] = [];

  if (matchedVIPNames.length > 0) {
    parts.push(`VIP: ${matchedVIPNames.join(", ")}`);
  }
  if (event.isRecurring) {
    parts.push("recurring (prior transcripts may exist)");
  } else {
    parts.push("one-off");
  }
  if (breakdown.proximity >= 0.85 * WEIGHTS.proximity) {
    parts.push("happening soon");
  }
  if (event.attendees.length > 0) {
    parts.push(`${event.attendees.length} attendee${event.attendees.length !== 1 ? "s" : ""}`);
  }
  if (breakdown.titleRelevance >= 0.7 * WEIGHTS.titleRelevance) {
    parts.push("title signals importance");
  }
  if (breakdown.guideMatch >= 0.5 * WEIGHTS.guideMatch) {
    parts.push("matches guide priorities");
  }

  return parts.length > 0
    ? parts.join(" | ")
    : "No strong signals";
}

// ─── Main ranking function ───

export function rankMeetings(
  events: CalendarEvent[],
  guide: BriefingGuide,
  now?: Date
): ScoredMeeting[] {
  const currentTime = now || new Date();

  const scored: ScoredMeeting[] = events.map((event) => {
    const vipResult = scoreVIPMatch(event, guide.vipContacts);
    const hasVIP = vipResult.matchedNames.length > 0;

    const rawScores = {
      proximity: scoreProximity(event, currentTime),
      attendeeImportance: scoreAttendeeImportance(event),
      titleRelevance: scoreTitleRelevance(event),
      recurrence: scoreRecurrence(event, hasVIP),
      hasRelatedDocs: 0, // filled in later by Module 3
      guideMatch: scoreGuideMatch(event, guide),
      vipMatch: vipResult.score,
    };

    const breakdown: MeetingScore["breakdown"] = {
      proximity: rawScores.proximity * WEIGHTS.proximity,
      attendeeImportance: rawScores.attendeeImportance * WEIGHTS.attendeeImportance,
      titleRelevance: rawScores.titleRelevance * WEIGHTS.titleRelevance,
      recurrence: rawScores.recurrence * WEIGHTS.recurrence,
      hasRelatedDocs: rawScores.hasRelatedDocs * WEIGHTS.hasRelatedDocs,
      guideMatch: rawScores.guideMatch * WEIGHTS.guideMatch,
    };

    // VIP score added on top
    const vipPoints = rawScores.vipMatch * WEIGHTS.vipMatch;

    const total =
      breakdown.proximity +
      breakdown.attendeeImportance +
      breakdown.titleRelevance +
      breakdown.recurrence +
      breakdown.hasRelatedDocs +
      breakdown.guideMatch +
      vipPoints;

    return {
      event,
      score: {
        total,
        breakdown,
        reasoning: buildReasoning(event, breakdown, vipResult.matchedNames),
      },
    };
  });

  return scored.sort((a, b) => b.score.total - a.score.total);
}
