import { config as loadDotenv } from "dotenv";
import { optionalEnv } from "./env.js";

export interface AppConfig {
  google: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  llm: {
    provider: string;
    apiKey: string;
  };
  tts: {
    provider: string;
    apiKey: string;
  };
  news: {
    provider: string;
    apiKey: string;
  };
  paths: {
    guidePath: string;
    artifactsPath: string;
  };
  briefing: {
    lengthMinutes: number;
    calendarId: string;
  };
}

export function loadConfig(): AppConfig {
  loadDotenv();

  return {
    google: {
      clientId: optionalEnv("GOOGLE_CLIENT_ID", ""),
      clientSecret: optionalEnv("GOOGLE_CLIENT_SECRET", ""),
      refreshToken: optionalEnv("GOOGLE_REFRESH_TOKEN", ""),
    },
    llm: {
      provider: optionalEnv("LLM_PROVIDER", "gemini"),
      apiKey: optionalEnv("GEMINI_API_KEY", ""),
    },
    tts: {
      provider: optionalEnv("TTS_PROVIDER", "gemini"),
      apiKey: optionalEnv("TTS_API_KEY", ""),
    },
    news: {
      provider: optionalEnv("NEWS_PROVIDER", "newsapi"),
      apiKey: optionalEnv("NEWS_API_KEY", ""),
    },
    paths: {
      guidePath: optionalEnv("GUIDE_PATH", "./data/guides/personal_briefing_guide.md"),
      artifactsPath: optionalEnv("ARTIFACTS_PATH", "./data/artifacts"),
    },
    briefing: {
      lengthMinutes: parseInt(optionalEnv("BRIEFING_LENGTH_MINUTES", "5"), 10),
      calendarId: optionalEnv("BRIEFING_CALENDAR_ID", "primary"),
    },
  };
}
