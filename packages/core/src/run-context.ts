import { randomBytes } from "node:crypto";
import type { BriefingGuide, RunConfig, PipelineData } from "@dailypod/types";
import type { Logger } from "@dailypod/logging";
import type { ArtifactStore } from "@dailypod/storage";
import type { AppConfig } from "@dailypod/config";

export interface RunContext {
  runId: string;
  config: AppConfig;
  runConfig: RunConfig;
  guide: BriefingGuide;
  logger: Logger;
  store: ArtifactStore;
  data: PipelineData;
  /** Pre-built learning prompt from feedback (used by web app instead of learningDir) */
  learningPrompt?: string;
  /** Enable structured client resolution via mapping sheet + State/state.md */
  advancedClientResolution?: boolean;
  /** Google Sheets ID for the client domain → folder mapping */
  mappingSheetId?: string;
}

export function generateRunId(date: string): string {
  const time = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(8, 14);
  const rand = randomBytes(2).toString("hex");
  return `${date}_${time}_${rand}`;
}

export function createRunContext(params: {
  config: AppConfig;
  runConfig: RunConfig;
  guide: BriefingGuide;
  logger: Logger;
  store: ArtifactStore;
}): RunContext {
  const runId = generateRunId(params.runConfig.date);

  const emptyData: PipelineData = {
    meetings: [],
    scoredMeetings: [],
    selectedMeeting: null,
    relatedDocuments: [],
    meetingContext: null,
    clientMapping: null,
    projectSummaries: [],
    candidateNews: [],
    rankedNews: [],
    episodePlan: null,
    script: null,
    audio: null,
    guide: params.guide,
  };

  return {
    runId,
    config: params.config,
    runConfig: params.runConfig,
    guide: params.guide,
    logger: params.logger,
    store: params.store,
    data: emptyData,
  };
}
