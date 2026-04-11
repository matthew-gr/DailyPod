export interface RetrievedDocument {
  id: string;
  externalFileId: string;
  title: string;
  sourceType: "doc" | "slide" | "sheet" | "pdf" | "transcript" | "other";
  lastModified: string;
  url?: string;
  extractedText?: string;
  relevanceScore: number;
  relevanceReason: string;
}
