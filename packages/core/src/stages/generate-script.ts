import { resolve } from "node:path";
import { generateScript } from "@dailypod/editorial";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const generateScriptStage: PipelineStage = {
  name: "generate-script",

  async execute(context: RunContext): Promise<void> {
    const { config, logger, store, data, guide } = context;
    const log = logger.child("generate-script");

    if (!data.episodePlan) {
      log.warn("No episode plan — skipping script generation");
      return;
    }

    log.info("Generating two-host script via Gemini...");

    const script = await generateScript(
      {
        plan: data.episodePlan,
        allMeetings: data.meetings,
        meetingContext: data.meetingContext,
        rankedNews: data.rankedNews,
        guide,
      },
      {
        apiKey: config.llm.apiKey,
        learningDir: context.learningPrompt ? undefined : resolve("data", "learning"),
        learningPrompt: context.learningPrompt,
      }
    );

    data.script = script;

    log.info(
      `Script generated: ${script.lines.length} lines, ~${script.estimatedDurationSeconds}s estimated`
    );

    // Save as JSON artifact
    await store.saveArtifact(context.runId, "script", script);

    // Also save as readable markdown
    const markdown = scriptToMarkdown(script);
    await store.saveFile(context.runId, "script.md", markdown);
  },
};

function scriptToMarkdown(script: { lines: Array<{ speaker: string; text: string; segmentType: string }> }): string {
  const parts: string[] = ["# Daily Briefing Script\n"];
  let currentSegment = "";

  for (const line of script.lines) {
    if (line.segmentType !== currentSegment) {
      currentSegment = line.segmentType;
      parts.push(`\n## ${currentSegment.replace(/-/g, " ").toUpperCase()}\n`);
    }

    const name = line.speaker === "host-a" ? "**Alex**" : "**Jordan**";
    parts.push(`${name}: ${line.text}\n`);
  }

  return parts.join("\n");
}
