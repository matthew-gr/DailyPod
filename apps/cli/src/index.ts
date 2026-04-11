import { Command } from "commander";
import { runBriefing } from "./commands/run.js";
import { inspectRuns } from "./commands/inspect.js";
import { testContext } from "./commands/test-context.js";
import { testTTS } from "./commands/test-tts.js";
import { renderScript } from "./commands/render-script.js";
import { giveFeedback } from "./commands/feedback.js";

const program = new Command();

program
  .name("dailypod")
  .description("Morning briefing podcast generator")
  .version("0.1.0");

program
  .command("run")
  .description("Generate a morning briefing")
  .option("-d, --date <date>", "Target date (YYYY-MM-DD), defaults to today")
  .option("-g, --guide-path <path>", "Path to personal briefing guide file")
  .action(async (options) => {
    try {
      await runBriefing(options);
    } catch (err) {
      console.error("Briefing run failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("inspect")
  .description("Inspect recent briefing runs")
  .option("-r, --run-id <runId>", "Show details for a specific run")
  .action(async (options) => {
    try {
      await inspectRuns(options);
    } catch (err) {
      console.error("Inspect failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("test-context")
  .description("Test context resolution for all real meetings on a date")
  .option("-d, --date <date>", "Target date (YYYY-MM-DD), defaults to today")
  .action(async (options) => {
    try {
      await testContext(options);
    } catch (err) {
      console.error("Test failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("test-tts")
  .description("Test TTS rendering with a short script")
  .action(async () => {
    try {
      await testTTS();
    } catch (err) {
      console.error("TTS test failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("render")
  .description("Re-render audio from an existing run's script")
  .requiredOption("-r, --run-id <runId>", "Run ID containing the script.json to render")
  .action(async (options) => {
    try {
      await renderScript(options);
    } catch (err) {
      console.error("Render failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("feedback")
  .description("Give feedback on a briefing run to improve future generations")
  .option("-r, --run-id <runId>", "Run ID to give feedback on (defaults to most recent)")
  .action(async (options) => {
    try {
      await giveFeedback(options);
    } catch (err) {
      console.error("Feedback failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
