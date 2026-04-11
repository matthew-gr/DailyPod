export interface VIPContact {
  name: string;
  email: string;
}

export interface BriefingGuide {
  currentPriorities: string[];
  values: string[];
  commitments: string[];
  topicsToEmphasize: string[];
  topicsToDownplay: string[];
  toneGuidance: string[];
  newsInterests: string[];
  newsToIgnore: string[];
  vipContacts: VIPContact[];
  raw: string;
}
