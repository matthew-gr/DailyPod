export type SegmentRating = "useful" | "ok" | "missed";

export interface RunFeedback {
  runId: string;
  overall: number; // 1-5
  segments: {
    "meeting-prep"?: SegmentRating;
    news?: SegmentRating;
    "priority-reflection"?: SegmentRating;
  };
  freeText?: string;
  lineAnnotations?: LineAnnotation[];
  timestamp: string;
}

export interface LineAnnotation {
  lineIndex: number;
  rating: "good" | "bad";
  note?: string;
}

export interface LearnedPreferences {
  updatedAt: string;
  feedbackCount: number;
  meetingPrep: {
    moreOf: string[];
    lessOf: string[];
  };
  news: {
    moreOf: string[];
    lessOf: string[];
  };
  tone: {
    moreOf: string[];
    lessOf: string[];
  };
  pacing: {
    tooLong: number; // count of "too long" signals
    tooShort: number;
    justRight: number;
  };
}

export interface LearnedExamples {
  updatedAt: string;
  good: Array<{
    line: string;
    segmentType: string;
    note?: string;
    runId: string;
  }>;
  bad: Array<{
    line: string;
    segmentType: string;
    note?: string;
    runId: string;
  }>;
}
