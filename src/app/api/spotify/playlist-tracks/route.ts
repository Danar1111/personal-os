import { NextRequest, NextResponse } from "next/server";
import { getPlaylistTracks } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const playlistId = req.nextUrl.searchParams.get("playlistId");

    if (!playlistId) {
      return NextResponse.json(
        { success: false, error: "playlistId query parameter is required", tracks: [], total: 0 },
        { status: 400 }
      );
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
    const result = await getPlaylistTracks(playlistId, limit, offset);


    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, tracks: [], total: 0 },
        { status: result.error?.includes("Not connected") ? 401 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tracks: result.tracks,
      total: result.total,
    });
  } catch (err: any) {
    console.error("[SPOTIFY_PLAYLIST_TRACKS_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch playlist tracks", tracks: [], total: 0 },
      { status: 500 }
    );
  }
}
