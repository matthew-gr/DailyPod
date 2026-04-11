import type { RunResult, StageResult } from "@dailypod/types";
import type { PipelineStage } from "./stage.js";
import type { RunContext } from "./run-context.js";

export class Pipeline {
  private stages: PipelineStage[] = [];

  addStage(stage: PipelineStage): this {
    this.stages.push(stage);
    return this;
  }

  async run(context: RunContext): Promise<RunResult> {
    const { runId, logger, store, runConfig } = context;
    const startedAt = new Date().toISOString();
    const stageResults: StageResult[] = [];

    logger.info(`Pipeline started for date ${runConfig.date}`);

    const result: RunResult = {
      runId,
      status: "running",
      config: runConfig,
      stages: stageResults,
      startedAt,
    };

    try {
      for (const stage of this.stages) {
        const stageLogger = logger.child(stage.name);
        const stageStart = Date.now();
        const stageStartedAt = new Date().toISOString();

        stageLogger.info("Starting");

        try {
          await stage.execute(context);

          const durationMs = Date.now() - stageStart;
          const stageResult: StageResult = {
            stageName: stage.name,
            output: `completed`,
            durationMs,
            startedAt: stageStartedAt,
            completedAt: new Date().toISOString(),
          };
          stageResults.push(stageResult);

          stageLogger.info(`Completed in ${durationMs}ms`);
        } catch (err) {
          const durationMs = Date.now() - stageStart;
          const errorMessage = err instanceof Error ? err.message : String(err);

          stageResults.push({
            stageName: stage.name,
            output: `failed: ${errorMessage}`,
            durationMs,
            startedAt: stageStartedAt,
            completedAt: new Date().toISOString(),
          });

          stageLogger.error(`Failed: ${errorMessage}`);
          throw err;
        }
      }

      result.status = "completed";
      result.completedAt = new Date().toISOString();
      logger.info("Pipeline completed successfully");
    } catch (err) {
      result.status = "failed";
      result.completedAt = new Date().toISOString();
      result.error = err instanceof Error ? err.message : String(err);
      logger.error(`Pipeline failed: ${result.error}`);
    }

    await store.saveRunSummary(runId, {
      runId,
      status: result.status,
      date: runConfig.date,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      stages: stageResults.map((s) => ({
        name: s.stageName,
        durationMs: s.durationMs,
        status: s.output?.toString().startsWith("failed") ? "failed" as const : "completed" as const,
      })),
      artifactPaths: {},
      error: result.error,
    });

    await store.saveArtifact(runId, "logs", logger.getEntries());

    return result;
  }
}
