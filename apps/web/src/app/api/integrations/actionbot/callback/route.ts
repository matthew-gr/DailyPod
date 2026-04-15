import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeCode } from "@/lib/actionbot-oauth";

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
    // Read PKCE state from cookie
    const cookieStore = await cookies();
    const pkceCookie = cookieStore.get("actionbot_pkce");

    if (!pkceCookie?.value) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/integrations?error=missing_pkce_cookie`
      );
    }

    const { codeVerifier, clientId, clientSecret } = JSON.parse(
      pkceCookie.value
    );

    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/integrations/actionbot/callback`;

    // Exchange authorization code for tokens
    const tokens = await exchangeCode(code, clientId, callbackUrl, codeVerifier);

    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    );

    // Upsert ActionBotConnection
    await prisma.actionBotConnection.upsert({
      where: { userId },
      create: {
        userId,
        clientId,
        clientSecret: clientSecret || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
      update: {
        clientId,
        clientSecret: clientSecret || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
    });

    // Clear the PKCE cookie
    cookieStore.set("actionbot_pkce", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/integrations?success=actionbot`
    );
  } catch (err) {
    console.error("Action Bot callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/integrations?error=actionbot_callback_failed`
    );
  }
}
