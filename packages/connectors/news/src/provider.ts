import type { NewsStory } from "@dailypod/types";

/**
 * Provider interface — swap implementations without changing pipeline code.
 */
export interface NewsProvider {
  name: string;
  fetchStories(options: FetchNewsOptions): Promise<NewsStory[]>;
}

export interface FetchNewsOptions {
  /** Only stories published after this ISO timestamp */
  since?: string;
  /** Max stories to return */
  maxResults?: number;
}
