import { resolve } from "node:path";
import { loadConfig } from "@dailypod/config";
import { FileArtifactStore } from "@dailypod/storage";
import { printRunList, printRunDetail } from "../utils/display.js";

export interface InspectOptions {
  runId?: string;
}

export async function inspectRuns(options: InspectOptions): Promise<void> {
  const config = loadConfig();
  const artifactsPath = resolve(config.paths.artifactsPath);
  const store = new FileArtifactStore(artifactsPath);

  if (options.runId) {
    const summary = await store.getRunSummary(options.runId);
    if (!summary) {
      console.error(`No run found with ID: ${options.runId}`);
      process.exit(1);
    }
    printRunDetail(options.runId, summary);
    return;
  }

  const runIds = await store.listRuns();
  const recent = runIds.slice(0, 10);

  const runs = await Promise.all(
    recent.map(async (runId) => ({
      runId,
      summary: await store.getRunSummary(runId),
    }))
  );

  printRunList(runs);
}
