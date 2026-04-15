import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/auth";
import {
  registerClient,
  generatePKCE,
  buildAuthorizeUrl,
} from "@/lib/actionbot-oauth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/integrations/actionbot/callback`;

    // Dynamic client registration
    const { client_id, client_secret } = await registerClient(callbackUrl);

    // Generate PKCE verifier + challenge
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Store PKCE state in a short-lived httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("actionbot_pkce", JSON.stringify({
      codeVerifier,
      clientId: client_id,
      clientSecret: client_secret || null,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    // Build authorization URL (state = userId, same pattern as Google OAuth)
    const authorizeUrl = buildAuthorizeUrl(
      client_id,
      callbackUrl,
      codeChallenge,
      session.user.id
    );

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    console.error("Action Bot connect error:", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/integrations?error=actionbot_connect_failed`
    );
  }
}
