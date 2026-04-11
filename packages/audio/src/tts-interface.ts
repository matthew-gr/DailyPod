import type { Script, AudioResult, VoiceConfig } from "@dailypod/types";

export interface TTSProvider {
  name: string;
  renderScript(script: Script, voices: VoiceConfig[], outputPath: string): Promise<AudioResult>;
}
