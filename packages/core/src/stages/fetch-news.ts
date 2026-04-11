import { RSSNewsProvider } from "@dailypod/news";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const fetchNewsStage: PipelineStage = {
  name: "fetch-news",

  async execute(context: RunContext): Promise<void> {
    const { logger, store, data, runConfig } = context;
    const log = logger.child("fetch-news");

    const provider = new RSSNewsProvider();

    // Fetch stories from the last 24 hours
    const since = new Date(`${runConfig.date}T00:00:00`);
    since.setDate(since.getDate() - 1);

    log.info(`Fetching news from ${provider.name} (since ${since.toISOString()})`);

    const stories = await provider.fetchStories({
      since: since.toISOString(),
      maxResults: 30,
    });

    log.info(`Fetched ${stories.length} candidate stories`);

    data.candidateNews = stories;

    await store.saveArtifact(context.runId, "candidate-news", stories);
  },
};
