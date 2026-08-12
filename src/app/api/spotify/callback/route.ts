import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSpotifyRedirectUri } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const redirectUri = getSpotifyRedirectUri(req);
  const baseUrl = redirectUri.replace("/api/spotify/callback", "");
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error("[SPOTIFY_CALLBACK_ERROR]", error || "No authorization code");
    return NextResponse.redirect(
      `${baseUrl}/settings?spotify=error&message=${encodeURIComponent(error || "Authorization cancelled or failed")}`
    );
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/settings?spotify=error&message=${encodeURIComponent("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in server environment.")}`
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");



  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[SPOTIFY_TOKEN_EXCHANGE_ERROR]", tokenRes.status, errText);
      return NextResponse.redirect(
        `${baseUrl}/settings?spotify=error&message=${encodeURIComponent("Failed to exchange authorization code for tokens.")}`
      );
    }

    const tokenData = await tokenRes.json();
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      console.error("[SPOTIFY_NO_REFRESH_TOKEN]", tokenData);
      return NextResponse.redirect(
        `${baseUrl}/settings?spotify=error&message=${encodeURIComponent("Spotify did not return a refresh token.")}`
      );
    }

    // Upsert SPOTIFY_REFRESH_TOKEN into system_settings table
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "SPOTIFY_REFRESH_TOKEN"));

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({
          value: refreshToken,
          isSecret: true,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, "SPOTIFY_REFRESH_TOKEN"));
    } else {
      await db.insert(systemSettings).values({
        key: "SPOTIFY_REFRESH_TOKEN",
        value: refreshToken,
        isSecret: true,
      });
    }

    return NextResponse.redirect(`${baseUrl}/settings?spotify=success`);
  } catch (err: any) {
    console.error("[SPOTIFY_CALLBACK_EXCEPTION]", err);
    return NextResponse.redirect(
      `${baseUrl}/settings?spotify=error&message=${encodeURIComponent(err.message || "Internal server error during Spotify OAuth callback.")}`
    );
  }
}
