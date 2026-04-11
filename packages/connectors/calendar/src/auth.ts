import { google } from "googleapis";

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function createAuthClient(config: GoogleAuthConfig) {
  const auth = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
  );

  auth.setCredentials({
    refresh_token: config.refreshToken,
  });

  return auth;
}
