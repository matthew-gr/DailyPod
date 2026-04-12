import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/integrations?error=missing_params`
    );
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/integrations?error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();

    // Get user email from Google
    const userinfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const userinfo = await userinfoResponse.json();

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Upsert GoogleConnection
    await prisma.googleConnection.upsert({
      where: { userId },
      create: {
        userId,
        googleEmail: userinfo.email || "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiresAt,
        scope: tokens.scope || "",
      },
      update: {
        googleEmail: userinfo.email || "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt,
        scope: tokens.scope || "",
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/integrations?success=true`
    );
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/integrations?error=callback_failed`
    );
  }
}
