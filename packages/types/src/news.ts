export interface NewsStory {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  description: string;
  content?: string;
}

export interface NewsScore {
  total: number;
  breakdown: {
    topicalRelevance: number;
    businessRelevance: number;
    novelty: number;
    guideMatch: number;
  };
  reasoning: string;
}

export interface RankedNewsStory {
  story: NewsStory;
  score: NewsScore;
  summary: string;
  whyItMatters: string;
  whyItMattersToday: string;
}
