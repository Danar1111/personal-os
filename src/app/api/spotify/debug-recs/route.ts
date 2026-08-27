import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getRelatedRecommendationUris } from "@/lib/spotify";

export const dynamic = "force-dynamic";

// Debug endpoint: GET /api/spotify/debug-recs?trackId=TRACK_ID
// Returns step-by-step result of getRelatedRecommendationUris
export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("trackId");
  if (!trackId) {
    return NextResponse.json({ error: "trackId query param required" }, { status: 400 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "No Spotify access token" }, { status: 401 });
  }

  const cleanId = trackId.replace("spotify:track:", "");
  const steps: any[] = [];

  // Step 1: track info
  const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${cleanId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const trackStatus = trackRes.status;
  const trackJson = trackRes.ok ? await trackRes.json() : await trackRes.text();
  steps.push({ step: "get_track", status: trackStatus, artistId: trackJson?.artists?.[0]?.id, artistName: trackJson?.artists?.[0]?.name });

  const primaryArtistId = trackJson?.artists?.[0]?.id;
  if (!primaryArtistId) {
    return NextResponse.json({ steps, error: "No artist found" });
  }

  // Step 2: related artists
  const relatedRes = await fetch(`https://api.spotify.com/v1/artists/${primaryArtistId}/related-artists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const relatedStatus = relatedRes.status;
  const relatedJson = relatedRes.ok ? await relatedRes.json() : await relatedRes.text();
  const relatedCount = relatedJson?.artists?.length ?? 0;
  const firstRelatedId = relatedJson?.artists?.[0]?.id;
  steps.push({ step: "related_artists", status: relatedStatus, count: relatedCount, firstArtistId: firstRelatedId });

  // Step 3: top tracks for first related artist (with market=from_token)
  if (firstRelatedId) {
    const topRes = await fetch(`https://api.spotify.com/v1/artists/${firstRelatedId}/top-tracks?market=from_token`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const topStatus = topRes.status;
    const topJson = topRes.ok ? await topRes.json() : await topRes.text();
    const tracksCount = topJson?.tracks?.length ?? 0;
    steps.push({ step: "top_tracks_with_from_token", artistId: firstRelatedId, status: topStatus, tracksCount, response: typeof topJson === "string" ? topJson : undefined });

    // Step 3b: try without market param
    const topRes2 = await fetch(`https://api.spotify.com/v1/artists/${firstRelatedId}/top-tracks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const topStatus2 = topRes2.status;
    const topJson2 = topRes2.ok ? await topRes2.json() : await topRes2.text();
    const tracksCount2 = topJson2?.tracks?.length ?? 0;
    steps.push({ step: "top_tracks_without_market", artistId: firstRelatedId, status: topStatus2, tracksCount: tracksCount2, response: typeof topJson2 === "string" ? topJson2 : undefined });
  }

  // Step 4: full recommendation run
  const uris = await getRelatedRecommendationUris(trackId, accessToken, 8);
  steps.push({ step: "full_recommendation_uris", count: uris.length, uris });

  return NextResponse.json({ steps, success: true });
}
