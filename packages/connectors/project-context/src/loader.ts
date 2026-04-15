import { google } from "googleapis";
import { createAuthClient } from "@dailypod/calendar";
import type { GoogleAuthConfig } from "@dailypod/calendar";

export interface ProjectContextResult {
  text: string;
  source: "state.md" | "latest-transcript";
  fileId: string;
  fileName: string;
}

async function findFileInFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  fileName: string,
): Promise<{ id: string; name: string } | null> {
  const res = await drive.files.list({
    q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
  });

  const files = res.data.files || [];
  if (files.length > 0 && files[0].id) {
    return { id: files[0].id, name: files[0].name || fileName };
  }
  return null;
}

async function findSubfolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  folderName: string,
): Promise<string | null> {
  const res = await drive.files.list({
    q: `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  const files = res.data.files || [];
  if (files.length > 0 && files[0].id) {
    return files[0].id;
  }
  return null;
}

async function exportFileAsText(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
): Promise<string> {
  try {
    // Try export first (for Google Docs)
    const res = await drive.files.export({
      fileId,
      mimeType: "text/plain",
    });
    return String(res.data || "");
  } catch {
    // Fall back to direct download (for non-Google files like .md)
    const res = await drive.files.get({
      fileId,
      alt: "media",
    });
    return String(res.data || "");
  }
}

export async function loadProjectContext(
  authConfig: GoogleAuthConfig,
  driveFolderId: string,
  driveFolderName: string,
): Promise<ProjectContextResult | null> {
  const auth = createAuthClient(authConfig);
  const drive = google.drive({ version: "v3", auth });

  // Step 1: Search for state.md directly in the folder
  let stateFile = await findFileInFolder(drive, driveFolderId, "state.md");

  // Step 2: If not found, look for a "State" subfolder and search inside
  if (!stateFile) {
    const stateFolderId = await findSubfolder(drive, driveFolderId, "State");
    if (stateFolderId) {
      stateFile = await findFileInFolder(drive, stateFolderId, "state.md");
    }
  }

  // Step 3: If state.md found, export and return
  if (stateFile) {
    const text = await exportFileAsText(drive, stateFile.id);
    return {
      text,
      source: "state.md",
      fileId: stateFile.id,
      fileName: "state.md",
    };
  }

  // Step 4: Look for latest transcript in Archive subfolder
  const archiveFolderId = await findSubfolder(drive, driveFolderId, "Archive");
  if (archiveFolderId) {
    const res = await drive.files.list({
      q: `name contains '00_Latest_Meeting_' and '${archiveFolderId}' in parents and trashed = false`,
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 1,
    });

    const files = res.data.files || [];
    if (files.length > 0 && files[0].id && files[0].name) {
      let text = await exportFileAsText(drive, files[0].id);
      // Truncate to 15000 chars
      if (text.length > 15000) {
        text = text.slice(0, 15000);
      }
      return {
        text,
        source: "latest-transcript",
        fileId: files[0].id,
        fileName: files[0].name,
      };
    }
  }

  // Step 5: Nothing found
  return null;
}

export async function loadMultipleProjectContexts(
  authConfig: GoogleAuthConfig,
  entries: Array<{ client: string; driveFolderId: string; driveFolderName: string }>,
  maxCount: number,
): Promise<Array<{ client: string; summary: string; source: string }>> {
  const results: Array<{ client: string; summary: string; source: string }> = [];

  // Process up to maxCount entries (already sorted by meeting_count)
  const toProcess = entries.slice(0, maxCount);

  for (const entry of toProcess) {
    try {
      const context = await loadProjectContext(
        authConfig,
        entry.driveFolderId,
        entry.driveFolderName,
      );

      if (context) {
        results.push({
          client: entry.client,
          summary: context.text.slice(0, 3000),
          source: context.source,
        });
      }
    } catch {
      // Skip entries that fail to load
      continue;
    }
  }

  return results;
}
