export interface MeetingContext {
  meetingTitle: string;
  meetingTime: string;
  attendeeSummary: string;
  summary: string;
  keyInsights: string[];
  pendingItems: string[];
  suggestedPrepQuestions: string[];
  relatedDocuments: Array<{ title: string; relevance: string }>;
}

export interface SegmentPlan {
  segmentType: "meeting-prep" | "news" | "priority-reflection";
  targetDurationSeconds: number;
  tonalInstructions: string;
  keyPoints: string[];
}

export interface EpisodePlan {
  date: string;
  totalTargetDurationSeconds: number;
  segments: SegmentPlan[];
  overallTone: string;
}

export type Speaker = "host-a" | "host-b";

export interface ScriptLine {
  speaker: Speaker;
  text: string;
  segmentType: "opening" | "meeting-prep" | "news" | "priority-reflection" | "closing";
}

export interface Script {
  lines: ScriptLine[];
  estimatedDurationSeconds: number;
  /** The full user prompt that was sent to the LLM (for debugging/audit) */
  promptUsed?: string;
}
