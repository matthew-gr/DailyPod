import { resolve } from "node:path";
import { readFile, mkdir } from "node:fs/promises";
import { loadConfig } from "@dailypod/config";
import { GeminiTTSProvider, DEFAULT_VOICES } from "@dailypod/audio";
import type { Script } from "@dailypod/types";

export interface RenderScriptOptions {
  runId: string;
}

export async function renderScript(options: RenderScriptOptions): Promise<void> {
  const config = loadConfig();
  const artifactsPath = resolve(config.paths.artifactsPath);
  const runDir = resolve(artifactsPath, options.runId);

  const scriptPath = resolve(runDir, "script.json");
  const script: Script = JSON.parse(await readFile(scriptPath, "utf-8"));

  console.log(`Rendering script from run ${options.runId}`);
  console.log(`Lines: ${script.lines.length}, estimated: ~${script.estimatedDurationSeconds}s`);
  console.log(`Voices: ${DEFAULT_VOICES.map((v) => `${v.name} (${v.voiceId})`).join(", ")}`);
  console.log("");

  const outputPath = resolve(runDir, "briefing.wav");
  const tts = new GeminiTTSProvider(config.tts.apiKey);

  let rendered = 0;
  const total = script.lines.length;

  // Log progress as batches complete
  const originalLines = script.lines;
  for (const line of originalLines) {
    rendered++;
    const speaker = line.speaker === "host-a" ? "Alex" : "Jordan";
    console.log(`  [${rendered}/${total}] ${speaker}: ${line.text.slice(0, 60)}...`);
  }

  console.log("\nSending to TTS...");
  const result = await tts.renderScript(script, DEFAULT_VOICES, outputPath);

  console.log(`\n✅ Audio rendered!`);
  console.log(`   File: ${result.filePath}`);
  console.log(`   Duration: ~${result.durationSeconds}s`);
}
