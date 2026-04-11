export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: Attendee[];
  description: string;
  location?: string;
  meetingLink?: string;
  isRecurring: boolean;
  recurrenceId?: string;
  calendarId: string;
}

export interface Attendee {
  email: string;
  name?: string;
  responseStatus?: "accepted" | "declined" | "tentative" | "needsAction";
  organizer?: boolean;
}

export interface MeetingScore {
  total: number;
  breakdown: {
    proximity: number;
    attendeeImportance: number;
    titleRelevance: number;
    recurrence: number;
    hasRelatedDocs: number;
    guideMatch: number;
  };
  reasoning: string;
}

export interface ScoredMeeting {
  event: CalendarEvent;
  score: MeetingScore;
}
