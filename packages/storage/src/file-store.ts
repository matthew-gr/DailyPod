import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ArtifactStore, ArtifactType, RunSummary } from "./store.js";

export class FileArtifactStore implements ArtifactStore {
  constructor(private basePath: string) {}

  private runDir(runId: string): string {
    return join(this.basePath, runId);
  }

  private artifactPath(runId: string, type: ArtifactType): string {
    return join(this.runDir(runId), `${type}.json`);
  }

  async saveArtifact(runId: string, type: ArtifactType, data: unknown): Promise<string> {
    const dir = this.runDir(runId);
    await mkdir(dir, { recursive: true });
    const filePath = this.artifactPath(runId, type);
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    return filePath;
  }

  async saveFile(runId: string, filename: string, content: Buffer | string): Promise<string> {
    const dir = this.runDir(runId);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, filename);
    await writeFile(filePath, content);
    return filePath;
  }

  async getArtifact<T = unknown>(runId: string, type: ArtifactType): Promise<T | null> {
    try {
      const filePath = this.artifactPath(runId, type);
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async listRuns(): Promise<string[]> {
    try {
      const entries = await readdir(this.basePath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  async getRunSummary(runId: string): Promise<RunSummary | null> {
    return this.getArtifact<RunSummary>(runId, "run-summary");
  }

  async saveRunSummary(runId: string, summary: RunSummary): Promise<void> {
    await this.saveArtifact(runId, "run-summary", summary);
  }
}
