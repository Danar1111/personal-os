import { NextResponse } from "next/server";
import { getUserPlaylists } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getUserPlaylists(24);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, playlists: [] },
        { status: result.error === "Not connected to Spotify or token expired." ? 401 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      playlists: result.playlists,
    });
  } catch (err: any) {
    console.error("[SPOTIFY_PLAYLISTS_API_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch playlists", playlists: [] },
      { status: 500 }
    );
  }
}
