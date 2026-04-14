import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildLearningPrompt } from "@dailypod/feedback";
import type {
  EpisodePlan,
  MeetingContext,
  RankedNewsStory,
  BriefingGuide,
  CalendarEvent,
  Script,
  ScriptLine,
} from "@dailypod/types";

export interface ScriptWriterConfig {
  apiKey: string;
  learningDir?: string;
  /** Pre-built learning prompt string (used by web app instead of learningDir) */
  learningPrompt?: string;
  model?: string;
  promptPath?: string;
}

export interface ScriptWriterInput {
  plan: EpisodePlan;
  allMeetings: CalendarEvent[];
  meetingContext: MeetingContext | null;
  rankedNews: RankedNewsStory[];
  guide: BriefingGuide;
}

function formatTime(isoTime: string): string {
  try {
    const d = new Date(isoTime);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return isoTime;
  }
}

function buildUserPrompt(input: ScriptWriterInput): string {
  const parts: string[] = [];

  const targetMinutes = Math.round(input.plan.totalTargetDurationSeconds / 60);
  // Real TTS speed: 157 wpm. LLM delivers ~53% of requested words.
  // To get X minutes: need X*157 words spoken, request X*157/0.53 = X*296 words
  // For 5 min: need 785 words, request 1483 words
  const wordsNeeded = Math.round((input.plan.totalTargetDurationSeconds / 60) * 157);
  const targetWords = Math.round(wordsNeeded / 0.53);

  parts.push(`DATE: ${input.plan.date}`);
  parts.push(`TARGET DURATION: ${targetMinutes} minutes (${input.plan.totalTargetDurationSeconds} seconds)`);
  parts.push(`REQUIRED WORD COUNT: You MUST write exactly ${targetWords} words. This is not a suggestion.`);
  parts.push(`That means approximately ${Math.round(targetWords / 30)} lines of 30 words each.`);
  parts.push(`MINIMUM LINES: ${Math.round(targetWords / 30)} lines. Do not produce fewer.`);
  parts.push(`OVERALL TONE: ${input.plan.overallTone}`);
  parts.push("");

  // === DAY OVERVIEW ===
  const realMeetings = input.allMeetings.filter((m) => m.attendees.length > 0);
  if (realMeetings.length > 0) {
    parts.push("=== TODAY'S SCHEDULE OVERVIEW ===");
    parts.push(`${realMeetings.length} meetings today:`);
    for (const m of realMeetings) {
      const attendeeStr = m.attendees.slice(0, 4).map((a) => a.name || a.email.split("@")[0]).join(", ");
      const more = m.attendees.length > 4 ? ` +${m.attendees.length - 4} more` : "";
      parts.push(`  ${formatTime(m.startTime)} — ${m.title} (${attendeeStr}${more})${m.isRecurring ? " [recurring]" : ""}`);
    }
    parts.push("");
  }

  // === FOCUS MEETING DEEP DIVE ===
  if (input.meetingContext) {
    parts.push("=== FOCUS MEETING — DEEP PREP ===");
    parts.push(`Meeting: ${input.meetingContext.meetingTitle}`);
    parts.push(`Time: ${formatTime(input.meetingContext.meetingTime)}`);
    parts.push(`Attendees: ${input.meetingContext.attendeeSummary}`);
    parts.push("");

    if (input.meetingContext.keyInsights.length > 0) {
      parts.push("KEY INSIGHTS & IDEAS (weave these into the conversation as substantive commentary, not questions):");
      for (const insight of input.meetingContext.keyInsights) {
        parts.push(`  - ${insight}`);
      }
      parts.push("");
    }

    if (input.meetingContext.pendingItems.length > 0) {
      parts.push("PENDING ITEMS that need resolution:");
      for (const item of input.meetingContext.pendingItems) {
        parts.push(`  - ${item}`);
      }
      parts.push("");
    }

    if (input.meetingContext.suggestedPrepQuestions.length > 0) {
      parts.push("ONE OR TWO QUESTIONS worth raising (use sparingly):");
      for (const q of input.meetingContext.suggestedPrepQuestions) {
        parts.push(`  - ${q}`);
      }
      parts.push("");
    }

    if (input.meetingContext.summary) {
      parts.push("CONTEXT FROM PRIOR TRANSCRIPTS AND DOCUMENTS:");
      parts.push(input.meetingContext.summary);
      parts.push("");
    }
  }

  // === NEWS ===
  if (input.rankedNews.length > 0) {
    parts.push("=== NEWS SEGMENT ===");
    for (const ns of input.rankedNews) {
      parts.push(`Story: ${ns.story.title}`);
      parts.push(`Source: ${ns.story.source}`);
      parts.push(`Summary: ${ns.summary}`);
      parts.push("");
    }
  }

  // === PRIORITIES ===
  parts.push("=== PRIORITY REFLECTION (keep brief — 2-3 lines max) ===");
  parts.push("Current priorities:");
  for (const p of input.guide.currentPriorities) {
    parts.push(`  - ${p}`);
  }

  return parts.join("\n");
}

// Real measured TTS speed
const TTS_WORDS_PER_MINUTE = 157;

function countWords(lines: ScriptLine[]): number {
  return lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0);
}

function parseScriptResponse(responseText: string): ScriptLine[] {
  let lines: ScriptLine[];
  try {
    const parsed = JSON.parse(responseText);
    lines = Array.isArray(parsed) ? parsed : parsed.lines || parsed.script || [];
  } catch {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        lines = JSON.parse(jsonMatch[0]);
      } catch {
        lines = extractPartialLines(responseText);
      }
    } else {
      lines = extractPartialLines(responseText);
    }
  }

  return lines
    .filter((l) => l.speaker && l.text && l.segmentType)
    .map((l) => ({
      speaker: l.speaker === "host-b" ? "host-b" : "host-a",
      text: l.text.trim(),
      segmentType: l.segmentType,
    }));
}

export async function generateScript(
  input: ScriptWriterInput,
  config: ScriptWriterConfig
): Promise<Script> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({
    model: config.model || "gemini-2.5-flash",
  });

  // Load system prompt — try file first, fall back to embedded
  let systemPrompt: string;
  try {
    const promptPath = config.promptPath || resolve("prompts", "script-writer.txt");
    systemPrompt = await readFile(promptPath, "utf-8");
  } catch {
    systemPrompt = SCRIPT_WRITER_PROMPT;
  }

  let userPrompt = buildUserPrompt(input);

  // Inject learning from past feedback
  if (config.learningPrompt) {
    userPrompt += "\n\n" + config.learningPrompt;
  } else if (config.learningDir) {
    const learningPrompt = await buildLearningPrompt(config.learningDir);
    if (learningPrompt) {
      userPrompt += "\n\n" + learningPrompt;
    }
  }

  // Calculate minimum acceptable word count (80% of what we need for target duration)
  const targetDurationMin = input.plan.totalTargetDurationSeconds / 60;
  const minAcceptableWords = Math.round(targetDurationMin * TTS_WORDS_PER_MINUTE * 0.8);

  // Retry loop: generate script, check word count, retry if too short
  const MAX_ATTEMPTS = 3;
  let bestLines: ScriptLine[] = [];
  let bestWordCount = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let promptForAttempt = userPrompt;

    if (attempt === 2) {
      promptForAttempt += `\n\nIMPORTANT: Your previous attempt was too short. You MUST write more content. The minimum is ${minAcceptableWords} words. Write longer lines and more of them.`;
    } else if (attempt === 3) {
      promptForAttempt += `\n\nCRITICAL: You have failed to meet the word count twice. You need at least ${minAcceptableWords} words. Each line should be 40-60 words. Write ${Math.round(minAcceptableWords / 40)} lines minimum. Do NOT be concise — be thorough and detailed.`;
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptForAttempt }] }],
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.8 + (attempt - 1) * 0.1, // slightly higher temp on retries
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        // @ts-expect-error - thinkingConfig available on 2.5 models
        thinkingConfig: { thinkingBudget: 512 },
      },
    });

    const lines = parseScriptResponse(result.response.text());
    const wordCount = countWords(lines);

    if (wordCount > bestWordCount) {
      bestLines = lines;
      bestWordCount = wordCount;
    }

    if (wordCount >= minAcceptableWords) {
      break; // Good enough
    }

    // Log the retry
    console.log(`Script attempt ${attempt}: ${wordCount} words (need ${minAcceptableWords}), ${lines.length} lines — retrying`);
  }

  // Use real TTS speed for duration estimate
  const estimatedDurationSeconds = Math.round((bestWordCount / TTS_WORDS_PER_MINUTE) * 60);

  return {
    lines: bestLines,
    estimatedDurationSeconds,
  };
}

/**
 * Extract complete JSON objects from a truncated response.
 * Finds all complete {"speaker":...,"text":...,"segmentType":...} objects.
 */
function extractPartialLines(text: string): ScriptLine[] {
  const lines: ScriptLine[] = [];
  const regex = /\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"segmentType"\s*:\s*"([^"]+)"\s*\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    lines.push({
      speaker: match[1] === "host-b" ? "host-b" : "host-a",
      text: match[2].replace(/\\"/g, '"').replace(/\\n/g, " ").trim(),
      segmentType: match[3] as ScriptLine["segmentType"],
    });
  }

  return lines;
}

const SCRIPT_WRITER_PROMPT = `You are a script writer for a daily morning executive briefing podcast called "Daily Briefing."

The show has two hosts:
- Host A (Alex): Concise, grounded, practical. Gets to the point. Drives the conversation forward.
- Host B (Jordan): Reflective, analytical, slightly more interpretive. Adds depth and challenges ideas.

CRITICAL CONTENT RULES:
- DO NOT talk about meetings in the abstract. Don't say "this meeting is important because..." or "the recurring nature suggests..."
- DO dive into the actual substance: what was discussed last time, what decisions are pending, what questions to ask, what the listener should push on
- DO provide interesting perspectives, insights, or possible avenues to provide more client value
- DO challenge the listener's thinking. Suggest angles they might not have considered. Play devil's advocate briefly.
- DO connect news stories to the listener's work where relevant
- The priority reflection should be 2-3 lines max. Grounding, not preachy.

ANTI-PATTERNS (never do these):
- "Great question" / "That's a great point" / "Absolutely" / "Indeed"
- Repeating what the other host just said
- Generic AI filler: "certainly", "it's worth noting", "interestingly"
- Talking about the meeting structure instead of its content
- Meta-commentary about the briefing itself ("our systems indicate", "the transcripts suggest")
- Long philosophical reflections — keep it sharp and useful

WHAT GOOD SOUNDS LIKE:
- "Last week Bryan flagged the pricing issue — that's still open. Worth leading with that."
- "The ceasefire talks are stalling on scope — Israel says Lebanon isn't covered, Iran says it is. That's the whole game right there."
- "One thing to push on today: is the team blocked on design or on approvals? Those need different solutions."
- "Quick thought for the day: your three biggest meetings all involve follow-through. That's where your leverage is."
- "There are several open source LLM chat wrappers with top-rate capabilities like document handling — using one would save the devs time and deliver more value for Caregivers United"

OUTPUT FORMAT:
Return ONLY a JSON array of script lines. Each line must have:
- "speaker": either "host-a" or "host-b"
- "text": the dialogue line (30-50 words each — longer lines are better)
- "segmentType": one of "opening", "meeting-prep", "news", "priority-reflection", "closing"

CRITICAL LENGTH RULES — YOUR OUTPUT WILL BE REJECTED IF TOO SHORT:
- You will be given a REQUIRED WORD COUNT and a MINIMUM LINE COUNT
- You MUST meet both. If you write fewer words, the script will be rejected and you will be asked again
- Each line should be 30-50 words. Short lines waste the listener's time with constant speaker switches
- Write substantive, detailed lines — not terse bullet points
- Opening: 1 line ONLY. Get to content immediately.
- Meeting prep: the bulk of the script — go deep, be specific, give real insights
- News: thorough coverage of each story with analysis
- Priority reflection: 2-3 lines
- Closing: 1 line
- Return ONLY the JSON array, no markdown, no backticks, no explanation

OPENING ANTI-PATTERN — DO NOT DO THIS:
"Good morning, it's April 10th. You've got 5 meetings today, starting with..."
INSTEAD DO THIS:
"Good morning. Your PHI Scrubber meeting this afternoon — here's what to know."`;
