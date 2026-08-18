import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuth2Client,
  getGoogleRedirectUri,
  getGoogleRefreshToken,
  saveGoogleRefreshToken,
} from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const redirectUri = getGoogleRedirectUri(req);
  const baseUrl = redirectUri.replace("/api/google/callback", "");
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error("[GOOGLE_CALLBACK_ERROR]", error || "No authorization code");
    return NextResponse.redirect(
      `${baseUrl}/settings?google=error&message=${encodeURIComponent(
        error || "Google authorization was cancelled or denied."
      )}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/settings?google=error&message=${encodeURIComponent(
        "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in server environment variables."
      )}`
    );
  }

  try {
    const oauth2Client = getGoogleOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      console.warn("[GOOGLE_NO_REFRESH_TOKEN_IN_RESPONSE]", tokens);
      const existingToken = await getGoogleRefreshToken();

      if (existingToken) {
        console.log("[GOOGLE_CALLBACK] Using existing refresh token in Database.");
        return NextResponse.redirect(`${baseUrl}/settings?google=success`);
      }

      return NextResponse.redirect(
        `${baseUrl}/settings?google=error&message=${encodeURIComponent(
          "Google did not return a refresh token. Please click Reconnect and approve consent."
        )}`
      );
    }

    await saveGoogleRefreshToken(refreshToken);

    return NextResponse.redirect(`${baseUrl}/settings?google=success`);
  } catch (err: any) {
    console.error("[GOOGLE_CALLBACK_EXCEPTION]", err);
    return NextResponse.redirect(
      `${baseUrl}/settings?google=error&message=${encodeURIComponent(
        err.message || "Internal server error during Google OAuth callback."
      )}`
    );
  }
}
