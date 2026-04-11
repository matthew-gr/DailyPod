import type { Speaker } from "./editorial.js";

export interface VoiceConfig {
  speaker: Speaker;
  voiceId: string;
  name: string;
  provider: string;
  settings?: Record<string, unknown>;
}

export interface AudioResult {
  filePath: string;
  durationSeconds: number;
  format: string;
  voiceConfigs: VoiceConfig[];
  generatedAt: string;
}
