import { join } from "node:path";
import { GeminiTTSProvider, DEFAULT_VOICES } from "@dailypod/audio";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const renderAudioStage: PipelineStage = {
  name: "render-audio",

  async execute(context: RunContext): Promise<void> {
    const { config, logger, store, data } = context;
    const log = logger.child("render-audio");

    if (!data.script || data.script.lines.length === 0) {
      log.warn("No script to render — skipping audio");
      return;
    }

    const tts = new GeminiTTSProvider(config.tts.apiKey);
    const outputPath = join(config.paths.artifactsPath, context.runId, "briefing.mp3");

    log.info(`Rendering ${data.script.lines.length} script lines to audio...`);
    log.info(`Output: ${outputPath}`);

    const result = await tts.renderScript(data.script, DEFAULT_VOICES, outputPath);

    data.audio = result;

    log.info(`Audio rendered: ${result.durationSeconds}s, ${result.format}`);

    await store.saveArtifact(context.runId, "audio-result", result);
  },
};
