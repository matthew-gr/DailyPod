export type ArtifactType =
  | "meetings"
  | "scored-meetings"
  | "selected-meeting"
  | "related-documents"
  | "meeting-context"
  | "candidate-news"
  | "ranked-news"
  | "episode-plan"
  | "script"
  | "audio-result"
  | "run-summary"
  | "logs";

export interface RunSummary {
  runId: string;
  status: "running" | "completed" | "failed";
  date: string;
  startedAt: string;
  completedAt?: string;
  stages: Array<{
    name: string;
    durationMs: number;
    status: "completed" | "failed" | "skipped";
  }>;
  artifactPaths: Record<string, string>;
  error?: string;
}

export interface ArtifactStore {
  saveArtifact(runId: string, type: ArtifactType, data: unknown): Promise<string>;
  saveFile(runId: string, filename: string, content: Buffer | string): Promise<string>;
  getArtifact<T = unknown>(runId: string, type: ArtifactType): Promise<T | null>;
  listRuns(): Promise<string[]>;
  getRunSummary(runId: string): Promise<RunSummary | null>;
  saveRunSummary(runId: string, summary: RunSummary): Promise<void>;
}
