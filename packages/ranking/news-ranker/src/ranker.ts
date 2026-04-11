import type {
  NewsStory,
  NewsScore,
  RankedNewsStory,
  BriefingGuide,
} from "@dailypod/types";

const WEIGHTS = {
  topicalRelevance: 35,   // driven by newsInterests
  businessRelevance: 15,
  novelty: 20,
  guideMatch: 30,         // penalty from newsToIgnore
};

/**
 * Extract keywords from a guide list item for matching.
 * "AI new model releases (OpenAI, Anthropic, Google, Meta, open source)"
 * → ["ai", "model", "releases", "openai", "anthropic", "google", "meta", "open source"]
 */
function extractKeywords(item: string): string[] {
  return item
    .toLowerCase()
    .replace(/[()\/,]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    // Remove very common filler
    .filter((w) => !["and", "the", "for", "from", "with", "that", "this", "not"].includes(w));
}

/**
 * Score how well a story matches the user's explicit news interests.
 * This is the primary signal — much more targeted than broad keyword lists.
 */
function scoreTopicalRelevance(story: NewsStory, guide: BriefingGuide): number {
  if (guide.newsInterests.length === 0) return 0.3; // no preferences set

  const text = `${story.title} ${story.description}`.toLowerCase();

  let bestMatchScore = 0;
  let totalHits = 0;

  for (const interest of guide.newsInterests) {
    const keywords = extractKeywords(interest);
    let hits = 0;

    for (const kw of keywords) {
      if (text.includes(kw)) hits++;
    }

    if (keywords.length > 0) {
      const ratio = hits / keywords.length;
      if (ratio > bestMatchScore) bestMatchScore = ratio;
      if (hits > 0) totalHits++;
    }
  }

  // Strong match on a single interest topic
  if (bestMatchScore >= 0.5) return 1.0;
  if (bestMatchScore >= 0.3) return 0.7;

  // Hits across multiple interests
  if (totalHits >= 3) return 0.8;
  if (totalHits >= 2) return 0.5;
  if (totalHits >= 1) return 0.3;

  return 0.05; // no match at all
}

/**
 * Check if a story matches "news to ignore" patterns.
 * Returns a penalty (0 = no penalty, up to -1.0 = strong ignore).
 */
function scoreIgnorePenalty(story: NewsStory, guide: BriefingGuide): number {
  if (guide.newsToIgnore.length === 0) return 0;

  const text = `${story.title} ${story.description}`.toLowerCase();

  for (const ignoreItem of guide.newsToIgnore) {
    const keywords = extractKeywords(ignoreItem);
    let hits = 0;

    for (const kw of keywords) {
      if (text.includes(kw)) hits++;
    }

    // If more than half the keywords from an ignore rule match, penalize heavily
    if (keywords.length > 0 && hits / keywords.length >= 0.5) {
      return -1.0;
    }
    if (hits >= 2) {
      return -0.5;
    }
  }

  return 0;
}

function scoreBusinessRelevance(story: NewsStory): number {
  const text = `${story.title} ${story.description}`.toLowerCase();

  // Decision-relevant signals
  const decisionKeywords = [
    "launch", "announce", "release", "update", "breakthrough",
    "discover", "deploy", "regulation", "policy", "billion",
    "partnership", "acquisition", "funding", "conflict", "war",
    "ceasefire", "mission", "orbit", "land",
  ];

  let hits = 0;
  for (const kw of decisionKeywords) {
    if (text.includes(kw)) hits++;
  }

  if (hits >= 3) return 1.0;
  if (hits >= 2) return 0.7;
  if (hits >= 1) return 0.5;
  return 0.2;
}

function scoreNovelty(story: NewsStory): number {
  const publishedAt = new Date(story.publishedAt);
  const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);

  if (hoursAgo <= 6) return 1.0;
  if (hoursAgo <= 12) return 0.8;
  if (hoursAgo <= 24) return 0.5;
  if (hoursAgo <= 48) return 0.3;
  return 0.1;
}

function buildReasoning(
  breakdown: NewsScore["breakdown"],
  ignorePenalty: number
): string {
  const parts: string[] = [];

  if (breakdown.topicalRelevance >= 0.7 * WEIGHTS.topicalRelevance) {
    parts.push("matches your news interests");
  }
  if (breakdown.businessRelevance >= 0.5 * WEIGHTS.businessRelevance) {
    parts.push("action-relevant");
  }
  if (breakdown.novelty >= 0.7 * WEIGHTS.novelty) {
    parts.push("very recent");
  }
  if (ignorePenalty < 0) {
    parts.push("partially matched ignore list");
  }

  return parts.length > 0 ? parts.join(", ") : "general interest";
}

export function rankNews(
  stories: NewsStory[],
  guide: BriefingGuide,
  topN: number = 2
): RankedNewsStory[] {
  const scored = stories.map((story) => {
    const topical = scoreTopicalRelevance(story, guide);
    const ignorePenalty = scoreIgnorePenalty(story, guide);
    const business = scoreBusinessRelevance(story);
    const novelty = scoreNovelty(story);

    // Apply ignore penalty to the topical score
    const adjustedTopical = Math.max(0, topical + ignorePenalty);

    const breakdown: NewsScore["breakdown"] = {
      topicalRelevance: adjustedTopical * WEIGHTS.topicalRelevance,
      businessRelevance: business * WEIGHTS.businessRelevance,
      novelty: novelty * WEIGHTS.novelty,
      guideMatch: adjustedTopical * WEIGHTS.guideMatch, // double-weight interest match
    };

    const total =
      breakdown.topicalRelevance +
      breakdown.businessRelevance +
      breakdown.novelty +
      breakdown.guideMatch;

    return {
      story,
      score: {
        total,
        breakdown,
        reasoning: buildReasoning(breakdown, ignorePenalty),
      },
      summary: story.description.slice(0, 200),
      whyItMatters: "",
      whyItMattersToday: "",
    };
  });

  scored.sort((a, b) => b.score.total - a.score.total);

  return scored.slice(0, topN);
}
