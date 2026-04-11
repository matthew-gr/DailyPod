import { resolve } from "node:path";
import { loadConfig } from "@dailypod/config";
import { loadGuide } from "@dailypod/guide";
import { createLogger } from "@dailypod/logging";
import { FileArtifactStore } from "@dailypod/storage";
import {
  Pipeline,
  createRunContext,
  fetchMeetingsStage,
  rankMeetingsStage,
  resolveContextStage,
  analyzeContextStage,
  fetchNewsStage,
  rankNewsStage,
  planSegmentsStage,
  generateScriptStage,
  renderAudioStage,
} from "@dailypod/core";
import type { RunConfig } from "@dailypod/types";
import { printRunResult } from "../utils/display.js";

export interface RunOptions {
  date?: string;
  guidePath?: string;
}

export async function runBriefing(options: RunOptions): Promise<void> {
  const config = loadConfig();

  const date = options.date || new Date().toISOString().slice(0, 10);
  const guidePath = resolve(options.guidePath || config.paths.guidePath);
  const artifactsPath = resolve(config.paths.artifactsPath);

  const runConfig: RunConfig = {
    date,
    guidePath,
    artifactsPath,
    calendarId: config.briefing.calendarId,
    briefingLengthMinutes: config.briefing.lengthMinutes,
  };

  const guide = await loadGuide(guidePath);
  const logger = createLogger(`${date}_run`, "debug");
  const store = new FileArtifactStore(artifactsPath);

  const context = createRunContext({
    config,
    runConfig,
    guide,
    logger,
    store,
  });

  logger.info("Run context created", { runId: context.runId, date });

  const pipeline = new Pipeline();
  pipeline.addStage(fetchMeetingsStage);
  pipeline.addStage(rankMeetingsStage);
  pipeline.addStage(resolveContextStage);
  pipeline.addStage(analyzeContextStage);
  pipeline.addStage(fetchNewsStage);
  pipeline.addStage(rankNewsStage);
  pipeline.addStage(planSegmentsStage);
  pipeline.addStage(generateScriptStage);
  pipeline.addStage(renderAudioStage);

  const result = await pipeline.run(context);

  printRunResult(result);

  if (context.data.audio) {
    console.log(`\x1b[32m🎧 Audio file: ${context.data.audio.filePath}\x1b[0m`);
    console.log(`\x1b[2m   Duration: ~${context.data.audio.durationSeconds}s\x1b[0m`);
  }
}
