import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl, getGoogleRedirectUri } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri = getGoogleRedirectUri(req);
  const baseUrl = redirectUri.replace("/api/google/callback", "");

  if (!clientId) {
    return NextResponse.redirect(
      `${baseUrl}/settings?google=error&message=${encodeURIComponent(
        "GOOGLE_CLIENT_ID is not configured in environment variables."
      )}`
    );
  }

  try {
    const authUrl = getGoogleAuthUrl(req);
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[GOOGLE_LOGIN_ERROR]", error);
    return NextResponse.redirect(
      `${baseUrl}/settings?google=error&message=${encodeURIComponent(
        error.message || "Failed to initialize Google OAuth login."
      )}`
    );
  }
}
