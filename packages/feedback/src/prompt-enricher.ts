import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { LearnedPreferences, LearnedExamples } from "./types.js";

/**
 * Load learned preferences and format them as a prompt section
 * to inject into the script writer prompt.
 *
 * Returns empty string if no learning data exists yet.
 */
export async function buildLearningPrompt(learningDir: string): Promise<string> {
  const prefsPath = resolve(learningDir, "preferences.json");
  const examplesPath = resolve(learningDir, "examples.json");

  let prefs: LearnedPreferences | null = null;
  let examples: LearnedExamples | null = null;

  try {
    prefs = JSON.parse(await readFile(prefsPath, "utf-8"));
  } catch { /* no prefs yet */ }

  try {
    examples = JSON.parse(await readFile(examplesPath, "utf-8"));
  } catch { /* no examples yet */ }

  if (!prefs && !examples) return "";

  const parts: string[] = [];
  parts.push("=== LEARNED PREFERENCES (from listener feedback) ===");

  if (prefs && prefs.feedbackCount > 0) {
    parts.push(`Based on ${prefs.feedbackCount} prior briefing${prefs.feedbackCount !== 1 ? "s" : ""}:`);

    if (prefs.meetingPrep.moreOf.length > 0) {
      parts.push("\nMeeting prep — DO MORE:");
      for (const item of prefs.meetingPrep.moreOf) {
        parts.push(`  - ${item}`);
      }
    }
    if (prefs.meetingPrep.lessOf.length > 0) {
      parts.push("\nMeeting prep — DO LESS:");
      for (const item of prefs.meetingPrep.lessOf) {
        parts.push(`  - ${item}`);
      }
    }
    if (prefs.news.moreOf.length > 0) {
      parts.push("\nNews — DO MORE:");
      for (const item of prefs.news.moreOf) {
        parts.push(`  - ${item}`);
      }
    }
    if (prefs.news.lessOf.length > 0) {
      parts.push("\nNews — DO LESS:");
      for (const item of prefs.news.lessOf) {
        parts.push(`  - ${item}`);
      }
    }
    if (prefs.tone.moreOf.length > 0) {
      parts.push("\nTone — DO MORE:");
      for (const item of prefs.tone.moreOf) {
        parts.push(`  - ${item}`);
      }
    }
    if (prefs.tone.lessOf.length > 0) {
      parts.push("\nTone — DO LESS:");
      for (const item of prefs.tone.lessOf) {
        parts.push(`  - ${item}`);
      }
    }
  }

  if (examples) {
    if (examples.good.length > 0) {
      parts.push("\nEXAMPLES OF LINES THE LISTENER LIKED (emulate this style):");
      for (const ex of examples.good.slice(-5)) {
        const note = ex.note ? ` (${ex.note})` : "";
        parts.push(`  ✓ "${ex.line}"${note}`);
      }
    }
    if (examples.bad.length > 0) {
      parts.push("\nEXAMPLES OF LINES THE LISTENER DISLIKED (avoid this style):");
      for (const ex of examples.bad.slice(-5)) {
        const note = ex.note ? ` (${ex.note})` : "";
        parts.push(`  ✗ "${ex.line}"${note}`);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Build learning prompt from data objects directly (for web app — no file I/O).
 */
export function buildLearningPromptFromData(
  prefs: LearnedPreferences | null,
  examples: LearnedExamples | null
): string {
  if (!prefs && !examples) return "";

  const parts: string[] = [];
  parts.push("=== LEARNED PREFERENCES (from listener feedback) ===");

  if (prefs && prefs.feedbackCount > 0) {
    parts.push(`Based on ${prefs.feedbackCount} prior briefing${prefs.feedbackCount !== 1 ? "s" : ""}:`);

    if (prefs.meetingPrep.moreOf.length > 0) {
      parts.push("\nMeeting prep — DO MORE:");
      for (const item of prefs.meetingPrep.moreOf) parts.push(`  - ${item}`);
    }
    if (prefs.meetingPrep.lessOf.length > 0) {
      parts.push("\nMeeting prep — DO LESS:");
      for (const item of prefs.meetingPrep.lessOf) parts.push(`  - ${item}`);
    }
    if (prefs.news.moreOf.length > 0) {
      parts.push("\nNews — DO MORE:");
      for (const item of prefs.news.moreOf) parts.push(`  - ${item}`);
    }
    if (prefs.news.lessOf.length > 0) {
      parts.push("\nNews — DO LESS:");
      for (const item of prefs.news.lessOf) parts.push(`  - ${item}`);
    }
    if (prefs.tone.moreOf.length > 0) {
      parts.push("\nTone — DO MORE:");
      for (const item of prefs.tone.moreOf) parts.push(`  - ${item}`);
    }
    if (prefs.tone.lessOf.length > 0) {
      parts.push("\nTone — DO LESS:");
      for (const item of prefs.tone.lessOf) parts.push(`  - ${item}`);
    }
  }

  if (examples) {
    if (examples.good.length > 0) {
      parts.push("\nEXAMPLES OF LINES THE LISTENER LIKED:");
      for (const ex of examples.good.slice(-5)) {
        const note = ex.note ? ` (${ex.note})` : "";
        parts.push(`  + "${ex.line}"${note}`);
      }
    }
    if (examples.bad.length > 0) {
      parts.push("\nEXAMPLES OF LINES THE LISTENER DISLIKED:");
      for (const ex of examples.bad.slice(-5)) {
        const note = ex.note ? ` (${ex.note})` : "";
        parts.push(`  - "${ex.line}"${note}`);
      }
    }
  }

  return parts.join("\n");
}
