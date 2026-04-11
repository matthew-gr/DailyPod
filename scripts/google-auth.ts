/**
 * Google OAuth2 helper — run this once to get a refresh token.
 *
 * Usage: npx tsx scripts/google-auth.ts
 *
 * 1. Opens your browser to Google consent screen
 * 2. You sign in and grant access
 * 3. Prints the refresh token to paste into .env
 */

import { createServer } from "node:http";
import { URL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";

// Load .env manually (no external deps needed)
const envPath = resolve(import.meta.dirname || ".", "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
  process.exit(1);
}

const PORT = 3847;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n🔐 Google OAuth2 Setup\n");
console.log("Opening your browser to sign in...\n");

// Open browser
const openCmd =
  process.platform === "win32" ? "start" :
  process.platform === "darwin" ? "open" : "xdg-open";

exec(`${openCmd} "${authUrl.toString().replace(/&/g, "^&")}"`);

// Start local server to catch the callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Error: ${error}</h2><p>You can close this tab.</p>`);
    console.error(`\n❌ Auth error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end("Missing code");
    return;
  }

  // Exchange code for tokens
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenRes.json()) as {
      refresh_token?: string;
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokens.error) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h2>Token Error</h2><p>${tokens.error_description}</p>`);
      console.error(`\n❌ Token error: ${tokens.error_description}`);
      server.close();
      process.exit(1);
    }

    if (!tokens.refresh_token) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h2>No refresh token received</h2><p>Try revoking access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and running again.</p>`);
      console.error("\n❌ No refresh token received. Revoke access and try again.");
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>✅ Success!</h2><p>You can close this tab and go back to your terminal.</p>`);

    console.log("✅ Success! Here is your refresh token:\n");
    console.log("━".repeat(60));
    console.log(tokens.refresh_token);
    console.log("━".repeat(60));
    console.log("\nPaste this into your .env file as:");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    server.close();
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed");
    console.error("\n❌ Token exchange failed:", err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/callback for redirect...\n`);
});
