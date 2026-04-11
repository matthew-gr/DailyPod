import type {
  MeetingContext,
  RankedNewsStory,
  BriefingGuide,
  EpisodePlan,
  SegmentPlan,
} from "@dailypod/types";

export interface PlannerInput {
  meetingContext: MeetingContext | null;
  rankedNews: RankedNewsStory[];
  guide: BriefingGuide;
  targetLengthMinutes: number;
  date: string;
}

export function planSegments(input: PlannerInput): EpisodePlan {
  const totalSeconds = input.targetLengthMinutes * 60;
  const segments: SegmentPlan[] = [];

  const toneStr = input.guide.toneGuidance.length > 0
    ? input.guide.toneGuidance.join(", ")
    : "calm, intelligent, practical";

  // Meeting prep segment (~55% of time if we have a meeting)
  if (input.meetingContext) {
    segments.push({
      segmentType: "meeting-prep",
      targetDurationSeconds: Math.round(totalSeconds * 0.55),
      tonalInstructions: `Focus on what matters for this meeting. Be practical and specific. Tone: ${toneStr}`,
      keyPoints: [
        `Meeting: ${input.meetingContext.meetingTitle}`,
        `Time: ${input.meetingContext.meetingTime}`,
        `Attendees: ${input.meetingContext.attendeeSummary}`,
        ...(input.meetingContext.relatedDocuments.length > 0
          ? [`Related docs found: ${input.meetingContext.relatedDocuments.length}`]
          : []),
      ],
    });
  }

  // News segment (~30% of time)
  if (input.rankedNews.length > 0) {
    segments.push({
      segmentType: "news",
      targetDurationSeconds: Math.round(
        totalSeconds * (input.meetingContext ? 0.30 : 0.55)
      ),
      tonalInstructions: `Cover what happened, why it matters, and why it matters today. No generic headline dumps. Tone: ${toneStr}`,
      keyPoints: input.rankedNews.map(
        (ns) => `${ns.story.title} (${ns.story.source})`
      ),
    });
  }

  // Priority reflection (~15% of time)
  segments.push({
    segmentType: "priority-reflection",
    targetDurationSeconds: Math.round(
      totalSeconds * (input.meetingContext ? 0.15 : 0.25)
    ),
    tonalInstructions: `Brief, grounding close. Connect today's content to priorities. Not preachy. Tone: ${toneStr}`,
    keyPoints: input.guide.currentPriorities.slice(0, 3),
  });

  return {
    date: input.date,
    totalTargetDurationSeconds: totalSeconds,
    segments,
    overallTone: toneStr,
  };
}
