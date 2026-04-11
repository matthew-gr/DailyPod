import { createInterface } from "node:readline";
import type { RunFeedback, SegmentRating, LineAnnotation } from "./types.js";
import type { Script } from "@dailypod/types";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function parseRating(input: string): number {
  const n = parseInt(input, 10);
  return n >= 1 && n <= 5 ? n : 3;
}

function parseSegmentRating(input: string): SegmentRating {
  const lower = input.toLowerCase();
  if (lower.startsWith("u") || lower === "1") return "useful";
  if (lower.startsWith("m") || lower === "3") return "missed";
  return "ok";
}

export async function collectFeedback(
  runId: string,
  script?: Script | null
): Promise<RunFeedback> {
  console.log(`\n📋 Feedback for run: ${runId}\n`);

  // Overall rating
  const overallStr = await ask("Overall rating (1-5): ");
  const overall = parseRating(overallStr);

  // Segment ratings
  const mpStr = await ask("Meeting prep segment — (u)seful / (o)k / (m)issed: ");
  const newsStr = await ask("News segment — (u)seful / (o)k / (m)issed: ");
  const prStr = await ask("Priority reflection — (u)seful / (o)k / (m)issed: ");

  // Free text
  const freeText = await ask("What should we do differently? (enter to skip): ");

  // Line annotations (if script available)
  const lineAnnotations: LineAnnotation[] = [];
  if (script && script.lines.length > 0) {
    const annotate = await ask("\nAnnotate specific script lines? (y/n): ");
    if (annotate.toLowerCase() === "y") {
      console.log("\nScript lines:");
      for (let i = 0; i < script.lines.length; i++) {
        const line = script.lines[i];
        const speaker = line.speaker === "host-a" ? "Alex" : "Jordan";
        console.log(`  [${i}] ${speaker}: ${line.text.slice(0, 80)}${line.text.length > 80 ? "..." : ""}`);
      }
      console.log("\nEnter line annotations (e.g. '3 good loved this' or '7 bad too vague'). Empty line to finish.");

      while (true) {
        const input = await ask("> ");
        if (!input) break;

        const match = input.match(/^(\d+)\s+(good|bad)\s*(.*)?$/i);
        if (match) {
          lineAnnotations.push({
            lineIndex: parseInt(match[1], 10),
            rating: match[2].toLowerCase() as "good" | "bad",
            note: match[3] || undefined,
          });
        } else {
          console.log("  Format: <line#> good|bad [optional note]");
        }
      }
    }
  }

  rl.close();

  return {
    runId,
    overall,
    segments: {
      "meeting-prep": parseSegmentRating(mpStr),
      news: parseSegmentRating(newsStr),
      "priority-reflection": parseSegmentRating(prStr),
    },
    freeText: freeText || undefined,
    lineAnnotations: lineAnnotations.length > 0 ? lineAnnotations : undefined,
    timestamp: new Date().toISOString(),
  };
}
