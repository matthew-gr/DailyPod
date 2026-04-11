import { XMLParser } from "fast-xml-parser";
import { randomBytes } from "node:crypto";
import type { NewsStory } from "@dailypod/types";
import type { NewsProvider, FetchNewsOptions } from "./provider.js";

export interface RSSFeed {
  url: string;
  name: string;
}

/**
 * Default feeds — AI, space, science, geopolitics, tech.
 * Curated for strategic relevance, not consumer gadget news.
 * Users can override via config.
 */
export const DEFAULT_FEEDS: RSSFeed[] = [
  // AI & Tech
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", name: "TechCrunch AI" },
  { url: "https://hnrss.org/frontpage?count=20", name: "Hacker News" },
  { url: "https://feeds.arstechnica.com/arstechnica/science", name: "Ars Technica Science" },
  // World / Geopolitics
  { url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", name: "BBC Middle East" },
  { url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", name: "BBC Africa" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", name: "NYT World" },
  // Science & Space
  { url: "https://www.nasa.gov/feed/", name: "NASA" },
  { url: "https://feeds.arstechnica.com/arstechnica/space", name: "Ars Technica Space" },
  { url: "https://www.space.com/feeds/all", name: "Space.com" },
  // Business
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", name: "BBC Business" },
];

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  "dc:date"?: string;
  published?: string;
  updated?: string;
  guid?: string | { "#text"?: string };
  id?: string;
  content?: string;
  "content:encoded"?: string;
  summary?: string;
}

function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "#text" in val) return String((val as Record<string, unknown>)["#text"]);
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(item: RSSItem): string {
  const raw = item.pubDate || item["dc:date"] || item.published || item.updated || "";
  if (!raw) return new Date().toISOString();
  try {
    return new Date(raw).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function parseItems(data: unknown, feedName: string): RSSItem[] {
  const obj = data as Record<string, unknown>;

  // RSS 2.0: rss.channel.item
  const rss = obj.rss as Record<string, unknown> | undefined;
  if (rss?.channel) {
    const channel = rss.channel as Record<string, unknown>;
    const items = channel.item;
    if (Array.isArray(items)) return items;
    if (items) return [items as RSSItem];
  }

  // Atom: feed.entry
  const feed = obj.feed as Record<string, unknown> | undefined;
  if (feed?.entry) {
    const entries = feed.entry;
    if (Array.isArray(entries)) return entries;
    if (entries) return [entries as RSSItem];
  }

  // RDF: rdf:RDF.item
  const rdf = obj["rdf:RDF"] as Record<string, unknown> | undefined;
  if (rdf?.item) {
    const items = rdf.item;
    if (Array.isArray(items)) return items;
    if (items) return [items as RSSItem];
  }

  return [];
}

function itemToStory(item: RSSItem, feedName: string): NewsStory | null {
  const title = extractText(item.title);
  if (!title) return null;

  let link = "";
  if (typeof item.link === "string") {
    link = item.link;
  } else if (item.link && typeof item.link === "object") {
    link = extractText((item.link as Record<string, unknown>)["@_href"] || "");
  }

  const description = stripHtml(
    extractText(item.description || item.summary || item["content:encoded"] || item.content || "")
  ).slice(0, 500);

  const guidRaw = item.guid || item.id || link || title;
  const id = typeof guidRaw === "string" ? guidRaw : extractText(guidRaw);

  return {
    id: id || randomBytes(8).toString("hex"),
    title: stripHtml(title),
    source: feedName,
    publishedAt: parseDate(item),
    url: link,
    description,
  };
}

export class RSSNewsProvider implements NewsProvider {
  name = "rss";
  private feeds: RSSFeed[];
  private parser: XMLParser;

  constructor(feeds?: RSSFeed[]) {
    this.feeds = feeds || DEFAULT_FEEDS;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
  }

  async fetchStories(options: FetchNewsOptions): Promise<NewsStory[]> {
    const maxResults = options.maxResults || 30;
    const since = options.since ? new Date(options.since) : null;

    const allStories: NewsStory[] = [];

    // Fetch all feeds concurrently
    const results = await Promise.allSettled(
      this.feeds.map((feed) => this.fetchFeed(feed))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allStories.push(...result.value);
      }
    }

    // Filter by date if specified
    let filtered = allStories;
    if (since) {
      filtered = allStories.filter(
        (s) => new Date(s.publishedAt) >= since
      );
    }

    // Sort by published date (newest first)
    filtered.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Deduplicate by title similarity
    const deduped = this.deduplicateStories(filtered);

    return deduped.slice(0, maxResults);
  }

  private async fetchFeed(feed: RSSFeed): Promise<NewsStory[]> {
    try {
      const response = await fetch(feed.url, {
        headers: { "User-Agent": "DailyPod/0.1" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return [];

      const xml = await response.text();
      const parsed = this.parser.parse(xml);
      const items = parseItems(parsed, feed.name);

      return items
        .map((item) => itemToStory(item, feed.name))
        .filter((s): s is NewsStory => s !== null);
    } catch {
      return [];
    }
  }

  private deduplicateStories(stories: NewsStory[]): NewsStory[] {
    const seen = new Set<string>();
    return stories.filter((story) => {
      // Normalize title for dedup
      const key = story.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
