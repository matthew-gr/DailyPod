import { writeFile } from "node:fs/promises";
// @ts-ignore - lamejs may not have types in all environments
import lamejs from "@breezystack/lamejs";
import type { Script, AudioResult, VoiceConfig, ScriptLine, Speaker } from "@dailypod/types";
import type { TTSProvider } from "./tts-interface.js";

/**
 * Default voice configs for the two hosts.
 * Gemini TTS voices: https://ai.google.dev/gemini-api/docs/text-to-speech
 */
export const DEFAULT_VOICES: VoiceConfig[] = [
  {
    speaker: "host-a",
    voiceId: "Charon",
    name: "Alex",
    provider: "gemini",
  },
  {
    speaker: "host-b",
    voiceId: "Aoede",
    name: "Jordan",
    provider: "gemini",
  },
];

interface GeminiTTSResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        text?: string;
      }>;
    };
  }>;
  error?: { message: string };
}

// Gemini TTS returns raw PCM: 16-bit signed LE, mono, 24000 Hz
const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

/**
 * Render a single text segment using Gemini TTS via REST API.
 * Returns raw PCM audio bytes (no header).
 */
async function renderSegment(
  text: string,
  voiceId: string,
  apiKey: string,
  model: string
): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `[Read this at a brisk, confident pace like a morning news briefing] ${text}` }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceId,
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as GeminiTTSResponse;

  if (data.error) {
    throw new Error(`Gemini TTS error: ${data.error.message}`);
  }

  const audioPart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data
  );

  if (!audioPart?.inlineData?.data) {
    throw new Error("No audio data in Gemini TTS response");
  }

  return Buffer.from(audioPart.inlineData.data, "base64");
}

/**
 * Batch script lines into chunks per speaker to reduce API calls.
 * Groups consecutive lines by the same speaker.
 */
function batchLines(lines: ScriptLine[]): Array<{ speaker: Speaker; text: string }> {
  const batches: Array<{ speaker: Speaker; text: string }> = [];

  for (const line of lines) {
    const last = batches[batches.length - 1];
    if (last && last.speaker === line.speaker) {
      last.text += " " + line.text;
    } else {
      batches.push({ speaker: line.speaker, text: line.text });
    }
  }

  return batches;
}

/**
 * Create a silence buffer (raw PCM) of given duration.
 */
function createSilence(durationSeconds: number): Buffer {
  const numSamples = Math.round(SAMPLE_RATE * durationSeconds);
  return Buffer.alloc(numSamples * BYTES_PER_SAMPLE);
}

/**
 * Encode raw PCM (16-bit signed LE, mono, 24kHz) to MP3.
 */
function encodePcmToMp3(pcmData: Buffer): Buffer {
  const mp3encoder = new lamejs.Mp3Encoder(NUM_CHANNELS, SAMPLE_RATE, 128);
  const sampleCount = pcmData.length / BYTES_PER_SAMPLE;
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    samples[i] = pcmData.readInt16LE(i * BYTES_PER_SAMPLE);
  }

  const mp3Chunks: Buffer[] = [];
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(Buffer.from(mp3buf));
    }
  }

  const final = mp3encoder.flush();
  if (final.length > 0) {
    mp3Chunks.push(Buffer.from(final));
  }

  return Buffer.concat(mp3Chunks);
}

export class GeminiTTSProvider implements TTSProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "gemini-2.5-flash-preview-tts";
  }

  async renderScript(
    script: Script,
    voices: VoiceConfig[],
    outputPath: string
  ): Promise<AudioResult> {
    const voiceMap = new Map(voices.map((v) => [v.speaker, v]));
    const batches = batchLines(script.lines);

    const pcmChunks: Buffer[] = [];
    const silenceGap = createSilence(0.2); // 200ms gap between speakers

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const voice = voiceMap.get(batch.speaker) || voices[0];

      const retries = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const pcmData = await renderSegment(
            batch.text,
            voice.voiceId,
            this.apiKey,
            this.model
          );
          pcmChunks.push(pcmData);

          // Add silence gap between segments (not after the last one)
          if (i < batches.length - 1) {
            pcmChunks.push(silenceGap);
          }

          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < retries - 1) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }

      if (lastError) {
        throw new Error(
          `TTS failed for batch ${i + 1}/${batches.length} (${voice.name}): ${lastError.message}`
        );
      }
    }

    // Concatenate all PCM chunks and encode to MP3
    const allPcm = Buffer.concat(pcmChunks);
    const mp3Path = outputPath.replace(/\.wav$/, ".mp3");
    const mp3Data = encodePcmToMp3(allPcm);
    await writeFile(mp3Path, mp3Data);

    // Calculate duration from PCM data size
    const durationSeconds = Math.round(allPcm.length / (SAMPLE_RATE * BYTES_PER_SAMPLE));

    return {
      filePath: mp3Path,
      durationSeconds,
      format: "mp3",
      voiceConfigs: voices,
      generatedAt: new Date().toISOString(),
    };
  }
}
