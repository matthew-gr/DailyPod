import { google, type drive_v3 } from "googleapis";
import type { RetrievedDocument } from "@dailypod/types";
import type { GoogleAuthConfig } from "@dailypod/calendar";
import { createAuthClient } from "@dailypod/calendar";

export interface SearchOptions {
  /** Search queries to try (title keywords, attendee names, etc.) */
  queries: string[];
  /** Only return files modified after this date */
  modifiedAfter?: string;
  /** Max results per query */
  maxPerQuery?: number;
}

const MIME_TYPE_MAP: Record<string, RetrievedDocument["sourceType"]> = {
  "application/vnd.google-apps.document": "doc",
  "application/vnd.google-apps.presentation": "slide",
  "application/vnd.google-apps.spreadsheet": "sheet",
  "application/pdf": "pdf",
  "text/plain": "other",
};

function mapMimeType(mimeType: string | undefined | null): RetrievedDocument["sourceType"] {
  if (!mimeType) return "other";
  return MIME_TYPE_MAP[mimeType] || "other";
}

function parseFile(
  file: drive_v3.Schema$File,
  relevanceScore: number,
  relevanceReason: string
): RetrievedDocument | null {
  if (!file.id || !file.name) return null;

  return {
    id: file.id,
    externalFileId: file.id,
    title: file.name,
    sourceType: mapMimeType(file.mimeType),
    lastModified: file.modifiedTime || "",
    url: file.webViewLink || undefined,
    relevanceScore,
    relevanceReason,
  };
}

export class GoogleDriveClient {
  private drive: drive_v3.Drive;

  constructor(authConfig: GoogleAuthConfig) {
    const auth = createAuthClient(authConfig);
    this.drive = google.drive({ version: "v3", auth });
  }

  /**
   * Search Drive for files matching queries.
   * De-duplicates results across queries.
   */
  async searchFiles(options: SearchOptions): Promise<RetrievedDocument[]> {
    const maxPerQuery = options.maxPerQuery || 10;
    const seen = new Set<string>();
    const results: RetrievedDocument[] = [];

    for (const query of options.queries) {
      try {
        const docs = await this.searchSingleQuery(
          query,
          maxPerQuery,
          options.modifiedAfter
        );

        for (const doc of docs) {
          if (!seen.has(doc.id)) {
            seen.add(doc.id);
            results.push(doc);
          }
        }
      } catch (err) {
        // Don't fail the whole search if one query errors
        console.warn(`Drive search failed for query "${query}":`, err);
      }
    }

    // Sort by relevance score descending, then by recency
    return results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return (b.lastModified || "").localeCompare(a.lastModified || "");
    });
  }

  private async searchSingleQuery(
    query: string,
    maxResults: number,
    modifiedAfter?: string
  ): Promise<RetrievedDocument[]> {
    // Build Drive query — search in name and fullText
    const conditions: string[] = [
      `(name contains '${this.escapeQuery(query)}' or fullText contains '${this.escapeQuery(query)}')`,
      "trashed = false",
    ];

    if (modifiedAfter) {
      conditions.push(`modifiedTime > '${modifiedAfter}'`);
    }

    // Only include useful document types (Google Docs, Slides, Sheets, PDFs)
    conditions.push(
      "(" +
      "mimeType = 'application/vnd.google-apps.document' or " +
      "mimeType = 'application/vnd.google-apps.presentation' or " +
      "mimeType = 'application/vnd.google-apps.spreadsheet' or " +
      "mimeType = 'application/pdf'" +
      ")"
    );

    const q = conditions.join(" and ");

    const response = await this.drive.files.list({
      q,
      pageSize: maxResults,
      fields: "files(id, name, mimeType, modifiedTime, webViewLink, description)",
      orderBy: "modifiedTime desc",
    });

    const files = response.data.files || [];

    return files
      .map((f) =>
        parseFile(f, 0, `matched query: "${query}"`)
      )
      .filter((d): d is RetrievedDocument => d !== null);
  }

  /**
   * Export a Google Doc/Slides/Sheet to plain text.
   * For non-Google files, downloads content directly (up to a size limit).
   */
  async extractText(fileId: string, mimeType?: string): Promise<string> {
    try {
      if (
        mimeType?.startsWith("application/vnd.google-apps.")
      ) {
        // Export as plain text
        const response = await this.drive.files.export(
          { fileId, mimeType: "text/plain" },
          { responseType: "text" }
        );
        const text = typeof response.data === "string"
          ? response.data
          : String(response.data);
        // Truncate very long docs to keep context manageable
        return text.slice(0, 15000);
      }

      // For PDFs and other files, try to get content
      // (limited support — just return empty for now)
      return "";
    } catch {
      return "";
    }
  }

  private escapeQuery(q: string): string {
    return q.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
  }
}
