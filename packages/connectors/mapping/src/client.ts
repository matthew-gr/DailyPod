import { google } from "googleapis";
import { createAuthClient } from "@dailypod/calendar";
import type { GoogleAuthConfig } from "@dailypod/calendar";

export interface MappingEntry {
  matchType: "domain" | "email";
  matchValue: string;
  client: string;
  driveFolderName: string;
  driveFolderId: string;
  meetingCount: number;
}

export interface MappingSheet {
  entries: MappingEntry[];
  byDomain: Map<string, MappingEntry[]>;
  byEmail: Map<string, MappingEntry>;
}

export interface LookupResult {
  client: string;
  driveFolderId: string;
  driveFolderName: string;
  matchedDomain: string;
  matchedAttendeeCount: number;
}

export async function loadMappingSheet(
  authConfig: GoogleAuthConfig,
  sheetId: string,
): Promise<MappingSheet> {
  const auth = createAuthClient(authConfig);
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "A:I",
  });

  const rows = res.data.values || [];
  const entries: MappingEntry[] = [];
  const byDomain = new Map<string, MappingEntry[]>();
  const byEmail = new Map<string, MappingEntry>();

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    const matchType = (row[0] || "").trim().toLowerCase();
    const matchValue = (row[1] || "").trim().toLowerCase();
    const client = (row[2] || "").trim();
    const driveFolderName = (row[3] || "").trim();
    const driveFolderId = (row[4] || "").trim();
    const meetingCount = parseInt(row[5] || "0", 10) || 0;

    // Skip DROP entries and entries with empty drive_folder_id
    if (!driveFolderId || driveFolderId === "DROP") continue;

    if (matchType !== "domain" && matchType !== "email") continue;

    const entry: MappingEntry = {
      matchType: matchType as "domain" | "email",
      matchValue,
      client,
      driveFolderName,
      driveFolderId,
      meetingCount,
    };

    entries.push(entry);

    if (matchType === "domain") {
      const existing = byDomain.get(matchValue) || [];
      existing.push(entry);
      byDomain.set(matchValue, existing);
    } else if (matchType === "email") {
      byEmail.set(matchValue, entry);
    }
  }

  return { entries, byDomain, byEmail };
}

export function lookupClientFolder(
  sheet: MappingSheet,
  attendeeEmails: string[],
  meetingTitle: string,
  internalDomains: string[] = ["growrwanda.com"],
): LookupResult | null {
  const normalizedEmails = attendeeEmails.map((e) => e.trim().toLowerCase());

  // Check email-level overrides first
  for (const email of normalizedEmails) {
    const emailMatch = sheet.byEmail.get(email);
    if (emailMatch) {
      return {
        client: emailMatch.client,
        driveFolderId: emailMatch.driveFolderId,
        driveFolderName: emailMatch.driveFolderName,
        matchedDomain: email,
        matchedAttendeeCount: 1,
      };
    }
  }

  // Extract unique external domains
  const internalSet = new Set(internalDomains.map((d) => d.toLowerCase()));
  const domainCounts = new Map<string, number>();

  for (const email of normalizedEmails) {
    const domain = email.split("@")[1];
    if (!domain || internalSet.has(domain)) continue;
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  // Check domain matches
  interface DomainMatch {
    entry: MappingEntry;
    domain: string;
    attendeeCount: number;
  }

  const matches: DomainMatch[] = [];

  for (const [domain, count] of domainCounts) {
    const domainEntries = sheet.byDomain.get(domain);
    if (domainEntries) {
      for (const entry of domainEntries) {
        matches.push({ entry, domain, attendeeCount: count });
      }
    }
  }

  if (matches.length === 0) {
    // Fallback: try matching meeting title against client names and folder names
    // This catches cases like "Testifyre x GRW Dev Meetings" where all attendees are internal
    const titleLower = meetingTitle.toLowerCase();
    const titleMatch = sheet.entries.find((entry) => {
      const clientLower = entry.client.toLowerCase();
      const folderLower = entry.driveFolderName.toLowerCase();
      // Check if client name or folder name appears in the title
      return (
        (clientLower.length > 2 && titleLower.includes(clientLower)) ||
        (folderLower.length > 2 && titleLower.includes(folderLower))
      );
    });

    if (titleMatch) {
      return {
        client: titleMatch.client,
        driveFolderId: titleMatch.driveFolderId,
        driveFolderName: titleMatch.driveFolderName,
        matchedDomain: `title-match:${titleMatch.client}`,
        matchedAttendeeCount: 0,
      };
    }

    return null;
  }

  if (matches.length === 1) {
    const m = matches[0];
    return {
      client: m.entry.client,
      driveFolderId: m.entry.driveFolderId,
      driveFolderName: m.entry.driveFolderName,
      matchedDomain: m.domain,
      matchedAttendeeCount: m.attendeeCount,
    };
  }

  // Multiple matches: pick by most matching attendees
  matches.sort((a, b) => b.attendeeCount - a.attendeeCount);

  // Tiebreaker: check if client name or folder name appears in meeting title
  if (matches[0].attendeeCount === matches[1].attendeeCount) {
    const titleLower = meetingTitle.toLowerCase();
    for (const m of matches) {
      if (
        titleLower.includes(m.entry.client.toLowerCase()) ||
        titleLower.includes(m.entry.driveFolderName.toLowerCase())
      ) {
        return {
          client: m.entry.client,
          driveFolderId: m.entry.driveFolderId,
          driveFolderName: m.entry.driveFolderName,
          matchedDomain: m.domain,
          matchedAttendeeCount: m.attendeeCount,
        };
      }
    }
  }

  const best = matches[0];
  return {
    client: best.entry.client,
    driveFolderId: best.entry.driveFolderId,
    driveFolderName: best.entry.driveFolderName,
    matchedDomain: best.domain,
    matchedAttendeeCount: best.attendeeCount,
  };
}
