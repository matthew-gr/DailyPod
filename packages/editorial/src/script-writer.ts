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
  const targetWords = Math.round(input.plan.totalTargetDurationSeconds * 2.5);

  parts.push(`DATE: ${input.plan.date}`);
  parts.push(`TARGET DURATION: ${targetMinutes} minutes (${input.plan.totalTargetDurationSeconds} seconds)`);
  parts.push(`TARGET WORD COUNT: ${targetWords} words total across all lines (at 150 words/minute)`);
  parts.push(`MINIMUM LINES: 20 script lines. You MUST produce at least 20 lines.`);
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

export async function generateScript(
  input: ScriptWriterInput,
  config: ScriptWriterConfig
): Promise<Script> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({
    model: config.model || "gemini-2.5-flash",
  });

  // Load system prompt
  const promptPath = config.promptPath || resolve("prompts", "script-writer.txt");
  const systemPrompt = await readFile(promptPath, "utf-8");

  let userPrompt = buildUserPrompt(input);

  // Inject learning from past feedback
  if (config.learningDir) {
    const learningPrompt = await buildLearningPrompt(config.learningDir);
    if (learningPrompt) {
      userPrompt += "\n\n" + learningPrompt;
    }
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      // @ts-expect-error - thinkingConfig available on 2.5 models
      thinkingConfig: { thinkingBudget: 512 },
    },
  });

  const responseText = result.response.text();

  // Parse JSON response — handle truncated output gracefully
  let lines: ScriptLine[];
  try {
    const parsed = JSON.parse(responseText);
    lines = Array.isArray(parsed) ? parsed : parsed.lines || parsed.script || [];
  } catch {
    // Try to extract JSON from the response if wrapped in markdown
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        lines = JSON.parse(jsonMatch[0]);
      } catch {
        // Truncated JSON — try to salvage complete objects
        lines = extractPartialLines(responseText);
      }
    } else {
      // Last resort — salvage what we can
      lines = extractPartialLines(responseText);
    }

    if (lines.length === 0) {
      throw new Error(`Failed to parse script JSON: ${responseText.slice(0, 200)}`);
    }
  }

  // Validate and clean
  const validLines: ScriptLine[] = lines
    .filter((l) => l.speaker && l.text && l.segmentType)
    .map((l) => ({
      speaker: l.speaker === "host-b" ? "host-b" : "host-a",
      text: l.text.trim(),
      segmentType: l.segmentType,
    }));

  // Estimate duration (~2.5 words per second)
  const totalWords = validLines.reduce(
    (sum, l) => sum + l.text.split(/\s+/).length, 0
  );
  const estimatedDurationSeconds = Math.round(totalWords / 2.5);

  return {
    lines: validLines,
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
