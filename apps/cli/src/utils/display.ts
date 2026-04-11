import type { RunResult } from "@dailypod/types";
import type { RunSummary } from "@dailypod/storage";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export function printRunResult(result: RunResult): void {
  const statusColor = result.status === "completed" ? GREEN : RED;

  console.log("");
  console.log(`${BOLD}=== Briefing Run: ${result.runId} ===${RESET}`);
  console.log(`${DIM}Date:${RESET}   ${result.config.date}`);
  console.log(`${DIM}Status:${RESET} ${statusColor}${result.status}${RESET}`);
  console.log("");

  console.log(`${BOLD}Stages:${RESET}`);
  for (const stage of result.stages) {
    const icon = stage.output?.toString().startsWith("failed") ? `${RED}x${RESET}` : `${GREEN}+${RESET}`;
    console.log(`  ${icon} ${stage.stageName.padEnd(20)} ${DIM}${stage.durationMs}ms${RESET}`);
  }

  if (result.error) {
    console.log("");
    console.log(`${RED}Error: ${result.error}${RESET}`);
  }

  console.log("");
}

export function printRunList(runs: Array<{ runId: string; summary: RunSummary | null }>): void {
  if (runs.length === 0) {
    console.log(`${DIM}No runs found.${RESET}`);
    return;
  }

  console.log(`${BOLD}Recent runs:${RESET}`);
  console.log("");

  for (const { runId, summary } of runs) {
    if (summary) {
      const statusColor =
        summary.status === "completed" ? GREEN :
        summary.status === "failed" ? RED : YELLOW;
      const stageCount = summary.stages.length;
      const totalMs = summary.stages.reduce((sum, s) => sum + s.durationMs, 0);
      console.log(
        `  ${CYAN}${runId}${RESET}  ${statusColor}${summary.status}${RESET}  ` +
        `${DIM}${stageCount} stages, ${totalMs}ms total${RESET}`
      );
    } else {
      console.log(`  ${CYAN}${runId}${RESET}  ${DIM}(no summary)${RESET}`);
    }
  }

  console.log("");
}

export function printRunDetail(runId: string, summary: RunSummary): void {
  const statusColor = summary.status === "completed" ? GREEN : RED;

  console.log("");
  console.log(`${BOLD}=== Run Detail: ${runId} ===${RESET}`);
  console.log(`${DIM}Date:${RESET}      ${summary.date}`);
  console.log(`${DIM}Status:${RESET}    ${statusColor}${summary.status}${RESET}`);
  console.log(`${DIM}Started:${RESET}   ${summary.startedAt}`);
  if (summary.completedAt) {
    console.log(`${DIM}Completed:${RESET} ${summary.completedAt}`);
  }
  console.log("");

  console.log(`${BOLD}Stages:${RESET}`);
  for (const stage of summary.stages) {
    const icon =
      stage.status === "completed" ? `${GREEN}+${RESET}` :
      stage.status === "failed" ? `${RED}x${RESET}` : `${YELLOW}-${RESET}`;
    console.log(`  ${icon} ${stage.name.padEnd(20)} ${DIM}${stage.durationMs}ms${RESET}`);
  }

  if (summary.error) {
    console.log("");
    console.log(`${RED}Error: ${summary.error}${RESET}`);
  }

  const artifactKeys = Object.keys(summary.artifactPaths);
  if (artifactKeys.length > 0) {
    console.log("");
    console.log(`${BOLD}Artifacts:${RESET}`);
    for (const key of artifactKeys) {
      console.log(`  ${DIM}${key}:${RESET} ${summary.artifactPaths[key]}`);
    }
  }

  console.log("");
}
