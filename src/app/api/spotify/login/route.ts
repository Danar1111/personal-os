import { NextRequest, NextResponse } from "next/server";
import { getSpotifyRedirectUri } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();

  if (!clientId) {
    return NextResponse.json(
      { error: "SPOTIFY_CLIENT_ID is not configured in environment variables." },
      { status: 500 }
    );
  }

  const redirectUri = getSpotifyRedirectUri(req);


  const scopes = [
    "user-read-currently-playing",
    "user-read-playback-state",
    "user-modify-playback-state",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    show_dialog: "true",
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
