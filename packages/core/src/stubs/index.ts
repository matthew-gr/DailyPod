import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

function stub(name: string, description: string): PipelineStage {
  return {
    name,
    async execute(context: RunContext) {
      context.logger.child(name).info(`[STUB] ${description} — will be replaced by real implementation`);
    },
  };
}

export const fetchMeetingsStub = stub(
  "fetch-meetings",
  "Fetch upcoming calendar events"
);

export const rankMeetingsStub = stub(
  "rank-meetings",
  "Score and rank meetings by importance"
);

export const resolveContextStub = stub(
  "resolve-context",
  "Retrieve related docs and build meeting context"
);

export const fetchNewsStub = stub(
  "fetch-news",
  "Fetch candidate overnight news stories"
);

export const rankNewsStub = stub(
  "rank-news",
  "Score and select top news stories"
);

export const planSegmentsStub = stub(
  "plan-segments",
  "Create episode plan with segment ordering"
);

export const generateScriptStub = stub(
  "generate-script",
  "Generate two-host dialogue script"
);

export const renderAudioStub = stub(
  "render-audio",
  "Render script to audio with two voices"
);

export function createStubPipeline(): PipelineStage[] {
  return [
    fetchMeetingsStub,
    rankMeetingsStub,
    resolveContextStub,
    fetchNewsStub,
    rankNewsStub,
    planSegmentsStub,
    generateScriptStub,
    renderAudioStub,
  ];
}
