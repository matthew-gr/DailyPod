import { rankNews } from "@dailypod/news-ranker";
import type { PipelineStage } from "../stage.js";
import type { RunContext } from "../run-context.js";

export const rankNewsStage: PipelineStage = {
  name: "rank-news",

  async execute(context: RunContext): Promise<void> {
    const { logger, store, data, guide } = context;
    const log = logger.child("rank-news");

    if (data.candidateNews.length === 0) {
      log.warn("No candidate news stories to rank");
      data.rankedNews = [];
      return;
    }

    // Dynamic news count based on briefing length and meeting presence
    const briefingMinutes = context.runConfig.briefingLengthMinutes;
    const hasMeeting = data.selectedMeeting !== null;
    const newsTimeFraction = hasMeeting ? 0.30 : 0.50;
    const newsSegmentSeconds = Math.round(briefingMinutes * 60 * newsTimeFraction);
    const topN = Math.max(2, Math.round(newsSegmentSeconds / 30));

    log.info(`Briefing: ${briefingMinutes}min, meeting: ${hasMeeting}, news allocation: ~${newsSegmentSeconds}s, topN: ${topN}`);

    const ranked = rankNews(data.candidateNews, guide, topN);
    data.rankedNews = ranked;

    log.info(`Selected ${ranked.length} top stories from ${data.candidateNews.length} candidates:`);
    for (const rs of ranked) {
      log.info(
        `  [${rs.score.total.toFixed(1)}] ${rs.story.title} (${rs.story.source}) — ${rs.score.reasoning}`
      );
    }

    await store.saveArtifact(context.runId, "ranked-news", ranked);
  },
};
