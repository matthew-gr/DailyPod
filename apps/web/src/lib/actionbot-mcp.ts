import { prisma } from "@/lib/db";
import { refreshAccessToken } from "@/lib/actionbot-oauth";

const DEFAULT_MCP_ENDPOINT =
  "https://action-bot-production.up.railway.app/mcp";

/**
 * Call the Action Bot MCP `get_daily_briefing` tool and return the text.
 * Returns null on any error (logged but not thrown).
 */
export async function callDailyBriefing(
  accessToken: string,
  mcpEndpoint: string = DEFAULT_MCP_ENDPOINT
): Promise<string | null> {
  try {
    const res = await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_daily_briefing",
          arguments: { include_workload: true },
        },
      }),
    });

    if (!res.ok) {
      console.error(
        `Action Bot MCP call failed: ${res.status} ${await res.text()}`
      );
      return null;
    }

    const contentType = res.headers.get("content-type") || "";

    // Handle SSE (text/event-stream) responses
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      // Parse SSE: look for the last "data:" line that contains a JSON-RPC result
      const lines = text.split("\n");
      let lastData: string | null = null;
      for (const line of lines) {
        if (line.startsWith("data:")) {
          lastData = line.slice(5).trim();
        }
      }
      if (lastData) {
        try {
          const parsed = JSON.parse(lastData);
          return parsed?.result?.content?.[0]?.text ?? null;
        } catch {
          // If the final SSE data isn't JSON, return it as-is
          return lastData;
        }
      }
      return null;
    }

    // Standard JSON-RPC response
    const json = await res.json();
    return json?.result?.content?.[0]?.text ?? null;
  } catch (err) {
    console.error("Action Bot MCP call error:", err);
    return null;
  }
}

/**
 * Get a valid (non-expired) access token for the user's Action Bot connection.
 * Refreshes the token and updates the DB if it has expired.
 * Returns null if the user has no connection.
 */
export async function getValidToken(
  userId: string
): Promise<{ accessToken: string; mcpEndpoint: string } | null> {
  const conn = await prisma.actionBotConnection.findUnique({
    where: { userId },
  });

  if (!conn) return null;

  // If token is still valid (with 60s buffer), return it directly
  if (conn.expiresAt > new Date(Date.now() + 60_000)) {
    return { accessToken: conn.accessToken, mcpEndpoint: conn.mcpEndpoint };
  }

  // Token expired — refresh it
  try {
    const tokens = await refreshAccessToken(conn.refreshToken, conn.clientId);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.actionBotConnection.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
    });

    return { accessToken: tokens.access_token, mcpEndpoint: conn.mcpEndpoint };
  } catch (err) {
    console.error("Action Bot token refresh failed:", err);
    return null;
  }
}
