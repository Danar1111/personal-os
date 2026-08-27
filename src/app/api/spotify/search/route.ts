import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!query.trim()) {
      return NextResponse.json({ success: true, tracks: [] });
    }

    const result = await searchTracks(query, isNaN(limit) ? 10 : limit);

    if (!result.success) {
      return NextResponse.json(
        { success: false, tracks: [], message: result.error || "Failed to search Spotify." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tracks: result.tracks,
    });
  } catch (err: any) {
    console.error("[SPOTIFY_SEARCH_API_ERROR]", err);
    return NextResponse.json(
      { success: false, tracks: [], message: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
