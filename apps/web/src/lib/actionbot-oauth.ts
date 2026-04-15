import { randomBytes, createHash } from "node:crypto";

const ACTION_BOT_BASE = "https://action-bot-production.up.railway.app";
const AUTHORIZE_URL = `${ACTION_BOT_BASE}/authorize`;
const TOKEN_URL = `${ACTION_BOT_BASE}/token`;
const REGISTER_URL = `${ACTION_BOT_BASE}/register`;

/**
 * Generate PKCE code_verifier and code_challenge (S256).
 */
export function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  // 43-128 char URL-safe random string
  const codeVerifier = randomBytes(32)
    .toString("base64url")
    .slice(0, 64);

  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

/**
 * Dynamic client registration with Action Bot.
 */
export async function registerClient(
  redirectUri: string
): Promise<{ client_id: string; client_secret?: string }> {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "DailyPod",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Client registration failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return { client_id: data.client_id, client_secret: data.client_secret };
}

/**
 * Build the OAuth 2.1 authorization URL with PKCE params.
 */
export function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token. Refresh tokens rotate on each call.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}
