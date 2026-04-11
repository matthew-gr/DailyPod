import type { RunContext } from "./run-context.js";

export interface PipelineStage {
  name: string;
  execute(context: RunContext): Promise<void>;
}
