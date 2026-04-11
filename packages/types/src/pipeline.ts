import type { CalendarEvent, ScoredMeeting } from "./calendar.js";
import type { RetrievedDocument } from "./documents.js";
import type { MeetingContext, EpisodePlan, Script } from "./editorial.js";
import type { RankedNewsStory, NewsStory } from "./news.js";
import type { AudioResult } from "./audio.js";
import type { BriefingGuide } from "./guide.js";

export interface RunConfig {
  date: string;
  guidePath: string;
  artifactsPath: string;
  calendarId: string;
  briefingLengthMinutes: number;
}

export interface StageResult<T = unknown> {
  stageName: string;
  output: T;
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

export type RunStatus = "running" | "completed" | "failed";

export interface RunResult {
  runId: string;
  status: RunStatus;
  config: RunConfig;
  stages: StageResult[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface PipelineData {
  meetings: CalendarEvent[];
  scoredMeetings: ScoredMeeting[];
  selectedMeeting: ScoredMeeting | null;
  relatedDocuments: RetrievedDocument[];
  meetingContext: MeetingContext | null;
  candidateNews: NewsStory[];
  rankedNews: RankedNewsStory[];
  episodePlan: EpisodePlan | null;
  script: Script | null;
  audio: AudioResult | null;
  guide: BriefingGuide;
}
