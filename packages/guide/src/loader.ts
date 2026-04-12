import { readFile } from "node:fs/promises";
import type { BriefingGuide, VIPContact } from "@dailypod/types";

type StringListKey = keyof Pick<
  BriefingGuide,
  | "currentPriorities"
  | "values"
  | "commitments"
  | "topicsToEmphasize"
  | "topicsToDownplay"
  | "toneGuidance"
  | "newsInterests"
  | "newsToIgnore"
>;

const SECTION_MAP: Record<string, StringListKey> = {
  "current priorities": "currentPriorities",
  "values": "values",
  "values / operating principles": "values",
  "operating principles": "values",
  "current commitments": "commitments",
  "commitments": "commitments",
  "topics to emphasize": "topicsToEmphasize",
  "topics to downplay": "topicsToDownplay",
  "tone guidance": "toneGuidance",
  "tone": "toneGuidance",
  "news interests": "newsInterests",
  "news to ignore": "newsToIgnore",
};

const VIP_HEADINGS = new Set([
  "key contacts",
  "vip contacts",
  "important contacts",
  "important people",
  "key people",
  "important people / relationships",
]);

function parseBulletList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Parse VIP contact lines in the format:
 *   - Name <email@example.com>
 *   - Name (email@example.com)
 *   - email@example.com
 */
function parseVIPContacts(text: string): VIPContact[] {
  const lines = parseBulletList(text);
  const contacts: VIPContact[] = [];

  for (const line of lines) {
    // Try "Name <email>" format
    const angleMatch = line.match(/^(.+?)\s*<([^>]+)>/);
    if (angleMatch) {
      contacts.push({ name: angleMatch[1].trim(), email: angleMatch[2].trim().toLowerCase() });
      continue;
    }

    // Try "Name (email)" format
    const parenMatch = line.match(/^(.+?)\s*\(([^)]+@[^)]+)\)/);
    if (parenMatch) {
      contacts.push({ name: parenMatch[1].trim(), email: parenMatch[2].trim().toLowerCase() });
      continue;
    }

    // Try bare email
    const emailMatch = line.match(/^[\w.+-]+@[\w.-]+\.\w+$/);
    if (emailMatch) {
      contacts.push({ name: "", email: line.trim().toLowerCase() });
      continue;
    }

    // Just a name with no email — still include it for name matching
    contacts.push({ name: line.trim(), email: "" });
  }

  return contacts;
}

/**
 * Parse a markdown string into a BriefingGuide.
 * Can be called directly with markdown content (e.g. from DB).
 */
export function parseGuide(raw: string): BriefingGuide {
  const guide: BriefingGuide = {
    currentPriorities: [],
    values: [],
    commitments: [],
    topicsToEmphasize: [],
    topicsToDownplay: [],
    toneGuidance: [],
    newsInterests: [],
    newsToIgnore: [],
    vipContacts: [],
    raw,
  };

  const sections = raw.split(/^## /m).slice(1);

  for (const section of sections) {
    const newlineIdx = section.indexOf("\n");
    if (newlineIdx === -1) continue;

    const heading = section.slice(0, newlineIdx).trim().toLowerCase();
    const body = section.slice(newlineIdx + 1).trim();

    if (VIP_HEADINGS.has(heading)) {
      guide.vipContacts = parseVIPContacts(body);
      continue;
    }

    const key = SECTION_MAP[heading];
    if (key) {
      guide[key] = parseBulletList(body);
    }
  }

  return guide;
}

/**
 * Load and parse a briefing guide from a file path.
 */
export async function loadGuide(filePath: string): Promise<BriefingGuide> {
  const raw = await readFile(filePath, "utf-8");
  return parseGuide(raw);
}
