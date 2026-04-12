import {
  Pipeline,
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
import { prisma } from "./db";
import { buildUserRunContext } from "./pipeline-bridge";

interface ActiveRun {
  runId: string;
  userId: string;
  status: "running" | "completed" | "failed";
  currentStage?: string;
  error?: string;
}

const activeRuns = new Map<string, ActiveRun>();

export async function startRun(
  userId: string,
  date: string
): Promise<{ runId: string }> {
  const context = await buildUserRunContext(userId, date);
  const { runId } = context;

  // Create DB record
  await prisma.briefingRun.create({
    data: {
      userId,
      runId,
      date,
      status: "running",
    },
  });

  const key = `${userId}:${runId}`;
  const run: ActiveRun = { runId, userId, status: "running" };
  activeRuns.set(key, run);

  // Build and run pipeline in background
  const pipeline = new Pipeline()
    .addStage(fetchMeetingsStage)
    .addStage(rankMeetingsStage)
    .addStage(resolveContextStage)
    .addStage(analyzeContextStage)
    .addStage(fetchNewsStage)
    .addStage(rankNewsStage)
    .addStage(planSegmentsStage)
    .addStage(generateScriptStage)
    .addStage(renderAudioStage);

  // Fire-and-forget
  pipeline
    .run(context)
    .then(async (result) => {
      run.status = "completed";

      const selectedMeeting = context.data.selectedMeeting;
      const rankedNews = context.data.rankedNews;
      const meetingContext = context.data.meetingContext;
      const audioDuration = context.data.audio?.durationSeconds;

      await prisma.briefingRun.update({
        where: { runId },
        data: {
          status: "completed",
          completedAt: new Date(),
          stagesJson: JSON.stringify(result.stages),
          selectedMeetingTitle: selectedMeeting?.event?.title || null,
          selectedNewsJson: rankedNews.length > 0
            ? JSON.stringify(rankedNews.map((n) => n.story.title))
            : null,
          meetingContextJson: meetingContext
            ? JSON.stringify(meetingContext)
            : null,
          audioDurationSeconds: audioDuration
            ? Math.round(audioDuration)
            : null,
        },
      });
    })
    .catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      run.status = "failed";
      run.error = errorMsg;

      await prisma.briefingRun.update({
        where: { runId },
        data: {
          status: "failed",
          completedAt: new Date(),
          error: errorMsg,
        },
      });
    })
    .finally(() => {
      // Clean up after 5 minutes
      setTimeout(() => activeRuns.delete(key), 5 * 60 * 1000);
    });

  return { runId };
}

export function getRunStatus(
  userId: string,
  runId: string
): ActiveRun | undefined {
  return activeRuns.get(`${userId}:${runId}`);
}
