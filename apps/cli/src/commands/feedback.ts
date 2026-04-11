import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { loadConfig } from "@dailypod/config";
import { FileArtifactStore } from "@dailypod/storage";
import { collectFeedback, processFeedback } from "@dailypod/feedback";
import type { Script } from "@dailypod/types";

export interface FeedbackOptions {
  runId?: string;
}

export async function giveFeedback(options: FeedbackOptions): Promise<void> {
  const config = loadConfig();
  const artifactsPath = resolve(config.paths.artifactsPath);
  const store = new FileArtifactStore(artifactsPath);

  // Find run ID — use provided or most recent
  let runId = options.runId;
  if (!runId) {
    const runs = await store.listRuns();
    if (runs.length === 0) {
      console.error("No runs found. Run a briefing first.");
      process.exit(1);
    }
    runId = runs[0]; // most recent
    console.log(`Using most recent run: ${runId}`);
  }

  // Load script if available
  let script: Script | null = null;
  try {
    const scriptPath = resolve(artifactsPath, runId, "script.json");
    script = JSON.parse(await readFile(scriptPath, "utf-8"));
  } catch { /* no script */ }

  // Collect feedback interactively
  const feedback = await collectFeedback(runId, script);

  // Save feedback to run artifacts
  await store.saveArtifact(runId, "run-summary", {
    ...(await store.getRunSummary(runId)),
    feedback,
  });

  // Also save standalone feedback file
  const feedbackPath = resolve(artifactsPath, runId, "feedback.json");
  const { writeFile: wf } = await import("node:fs/promises");
  await wf(feedbackPath, JSON.stringify(feedback, null, 2), "utf-8");

  // Process into learning
  const learningDir = resolve("data", "learning");
  await processFeedback(feedback, script, learningDir);

  console.log(`\n✅ Feedback saved for run ${runId}`);
  console.log(`   Learning updated in data/learning/`);
  console.log(`   Next briefing will use your feedback to improve.`);
}
