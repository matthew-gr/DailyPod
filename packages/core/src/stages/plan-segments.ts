import { planSegments } from "@dailypod/editorial";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const planSegmentsStage: PipelineStage = {
  name: "plan-segments",

  async execute(context: RunContext): Promise<void> {
    const { logger, store, data, guide, runConfig } = context;
    const log = logger.child("plan-segments");

    const plan = planSegments({
      meetingContext: data.meetingContext,
      rankedNews: data.rankedNews,
      guide,
      targetLengthMinutes: runConfig.briefingLengthMinutes,
      date: runConfig.date,
    });

    data.episodePlan = plan;

    log.info(`Episode plan: ${plan.segments.length} segments, ${Math.round(plan.totalTargetDurationSeconds / 60)}min target`);
    for (const seg of plan.segments) {
      log.info(`  ${seg.segmentType}: ~${Math.round(seg.targetDurationSeconds / 60)}min`);
    }

    await store.saveArtifact(context.runId, "episode-plan", plan);
  },
};
