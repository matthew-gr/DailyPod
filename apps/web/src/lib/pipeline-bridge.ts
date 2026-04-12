import { resolve } from "node:path";
import { createRunContext } from "@dailypod/core";
import { parseGuide } from "@dailypod/guide";
import { createLogger } from "@dailypod/logging";
import { FileArtifactStore } from "@dailypod/storage";
import { buildLearningPromptFromData } from "@dailypod/feedback";
import type { AppConfig } from "@dailypod/config";
import type { RunContext } from "@dailypod/core";
import { prisma } from "./db";

export async function buildUserRunContext(
  userId: string,
  date: string
): Promise<RunContext> {
  // Load user data from DB
  const [connection, preferences, guideRecord, user] = await Promise.all([
    prisma.googleConnection.findUnique({ where: { userId } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.briefingGuide.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!connection) {
    throw new Error("Google Calendar not connected. Please connect in Integrations.");
  }

  // Parse briefing guide from DB markdown
  const guideMarkdown = guideRecord?.markdown || "";
  const guide = parseGuide(guideMarkdown);

  // Use defaults if no preferences saved yet
  const prefs = preferences || {
    briefingLengthMinutes: 5,
    tone: "calm, intelligent, practical",
    hostAVoice: "Charon",
    hostBVoice: "Aoede",
    newsInterests: "[]",
    newsToIgnore: "[]",
    timezone: "UTC",
  };

  const appConfig: AppConfig = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      refreshToken: connection.refreshToken,
    },
    llm: { provider: "gemini", apiKey: process.env.GEMINI_API_KEY! },
    tts: { provider: "gemini", apiKey: process.env.GEMINI_API_KEY! },
    news: { provider: "rss", apiKey: "" },
    paths: {
      guidePath: "",
      artifactsPath: resolve("data", "artifacts", userId),
    },
    briefing: {
      lengthMinutes: prefs.briefingLengthMinutes,
      calendarId: connection.calendarId,
    },
  };

  const logger = createLogger({ level: "info", prefix: `web:${userId.slice(0, 8)}` });
  const store = new FileArtifactStore(appConfig.paths.artifactsPath);

  const context = createRunContext({
    config: appConfig,
    runConfig: { date },
    guide,
    logger,
    store,
  });

  // Build learning prompt from user's stored feedback data
  if (user?.learnedPreferences || user?.learnedExamples) {
    const learnedPrefs = user.learnedPreferences
      ? JSON.parse(user.learnedPreferences)
      : null;
    const learnedExamples = user.learnedExamples
      ? JSON.parse(user.learnedExamples)
      : null;
    const prompt = buildLearningPromptFromData(learnedPrefs, learnedExamples);
    if (prompt) {
      context.learningPrompt = prompt;
    }
  }

  return context;
}
