import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "@dailypod/config";
import { GeminiTTSProvider, DEFAULT_VOICES } from "@dailypod/audio";
import type { Script } from "@dailypod/types";

export async function testTTS(): Promise<void> {
  const config = loadConfig();

  const testScript: Script = {
    lines: [
      {
        speaker: "host-a",
        text: "Good morning. Let's get straight into it for April 10th.",
        segmentType: "opening",
      },
      {
        speaker: "host-b",
        text: "Today's a day with some critical meetings and evolving global situations. We'll start with your St. Ambrose Website meeting this afternoon.",
        segmentType: "opening",
      },
    ],
    estimatedDurationSeconds: 15,
  };

  const outputDir = resolve("data/artifacts/tts-test");
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "test-briefing.wav");

  console.log("Testing TTS with 2 lines...");
  console.log(`Voices: ${DEFAULT_VOICES.map((v) => `${v.name} (${v.voiceId})`).join(", ")}`);
  console.log("");

  const tts = new GeminiTTSProvider(config.tts.apiKey);

  const result = await tts.renderScript(testScript, DEFAULT_VOICES, outputPath);
  console.log(`\n✅ Success!`);
  console.log(`   File: ${result.filePath}`);
  console.log(`   Duration: ~${result.durationSeconds}s`);
  console.log(`   Format: ${result.format}`);
  console.log(`\nTry playing: ${result.filePath}`);
}
