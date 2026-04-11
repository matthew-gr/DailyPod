import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { RunFeedback, LearnedPreferences, LearnedExamples } from "./types.js";
import type { Script } from "@dailypod/types";

const MAX_EXAMPLES = 10; // keep top N good/bad examples

function emptyPreferences(): LearnedPreferences {
  return {
    updatedAt: new Date().toISOString(),
    feedbackCount: 0,
    meetingPrep: { moreOf: [], lessOf: [] },
    news: { moreOf: [], lessOf: [] },
    tone: { moreOf: [], lessOf: [] },
    pacing: { tooLong: 0, tooShort: 0, justRight: 0 },
  };
}

function emptyExamples(): LearnedExamples {
  return {
    updatedAt: new Date().toISOString(),
    good: [],
    bad: [],
  };
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Process a new feedback entry and update accumulated learning files.
 */
export async function processFeedback(
  feedback: RunFeedback,
  script: Script | null,
  learningDir: string
): Promise<void> {
  await mkdir(learningDir, { recursive: true });

  const prefsPath = resolve(learningDir, "preferences.json");
  const examplesPath = resolve(learningDir, "examples.json");

  const prefs = await loadJson<LearnedPreferences>(prefsPath, emptyPreferences());
  const examples = await loadJson<LearnedExamples>(examplesPath, emptyExamples());

  // Update feedback count
  prefs.feedbackCount++;
  prefs.updatedAt = new Date().toISOString();

  // Extract preferences from free text
  if (feedback.freeText) {
    const text = feedback.freeText.toLowerCase();

    // Simple keyword extraction for meeting prep preferences
    if (feedback.segments["meeting-prep"] === "useful") {
      addUnique(prefs.meetingPrep.moreOf, "current approach is working");
    } else if (feedback.segments["meeting-prep"] === "missed") {
      // The free text likely explains what was wrong
      addUnique(prefs.meetingPrep.lessOf, feedback.freeText);
    }

    if (feedback.segments.news === "useful") {
      addUnique(prefs.news.moreOf, "current news selection is good");
    } else if (feedback.segments.news === "missed") {
      addUnique(prefs.news.lessOf, feedback.freeText);
    }

    // Check for pacing signals in free text
    if (text.includes("too long") || text.includes("shorter")) {
      prefs.pacing.tooLong++;
    } else if (text.includes("too short") || text.includes("longer") || text.includes("more detail")) {
      prefs.pacing.tooShort++;
    }

    // Check for tone signals
    if (text.includes("more direct") || text.includes("sharper")) {
      addUnique(prefs.tone.moreOf, "direct and sharp");
    }
    if (text.includes("too many questions") || text.includes("fewer questions")) {
      addUnique(prefs.meetingPrep.lessOf, "too many questions — prefer insights and suggestions");
    }
    if (text.includes("more insight") || text.includes("more ideas")) {
      addUnique(prefs.meetingPrep.moreOf, "concrete insights, ideas, and outside perspectives");
    }
  }

  // Process line annotations into examples
  if (feedback.lineAnnotations && script) {
    for (const ann of feedback.lineAnnotations) {
      const line = script.lines[ann.lineIndex];
      if (!line) continue;

      const entry = {
        line: line.text,
        segmentType: line.segmentType,
        note: ann.note,
        runId: feedback.runId,
      };

      if (ann.rating === "good") {
        examples.good.push(entry);
        // Keep only the most recent N
        if (examples.good.length > MAX_EXAMPLES) {
          examples.good = examples.good.slice(-MAX_EXAMPLES);
        }
      } else {
        examples.bad.push(entry);
        if (examples.bad.length > MAX_EXAMPLES) {
          examples.bad = examples.bad.slice(-MAX_EXAMPLES);
        }
      }
    }
  }

  // Segment-level learning (no free text needed)
  if (feedback.segments["meeting-prep"] === "missed" && !feedback.freeText) {
    addUnique(prefs.meetingPrep.lessOf, "meeting prep missed the mark (no details given)");
  }
  if (feedback.segments.news === "missed" && !feedback.freeText) {
    addUnique(prefs.news.lessOf, "news selection missed the mark (no details given)");
  }

  // Overall rating signals
  if (feedback.overall >= 4) {
    prefs.pacing.justRight++;
  }

  examples.updatedAt = new Date().toISOString();

  await saveJson(prefsPath, prefs);
  await saveJson(examplesPath, examples);
}

function addUnique(arr: string[], item: string): void {
  if (!arr.includes(item)) {
    arr.push(item);
    // Cap at 10 entries
    if (arr.length > 10) arr.shift();
  }
}
