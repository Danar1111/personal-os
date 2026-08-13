import { NextResponse } from "next/server";
import { getNowPlaying } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getNowPlaying();

    if (!result || !result.isConnected) {
      return NextResponse.json({ isConnected: false, isPlaying: false });
    }

    const resObj = result.response;

    if (!resObj || resObj.status === 204 || resObj.status >= 400) {
      return NextResponse.json({ isConnected: true, isPlaying: false });
    }

    const song = await resObj.json().catch(() => null);

    if (!song || !song.item) {
      return NextResponse.json({ isConnected: true, isPlaying: false });
    }

    const isPlaying = song.is_playing;
    const title = song.item.name;
    const artist = song.item.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist";
    const album = song.item.album?.name || "Unknown Album";
    const albumImageUrl = song.item.album?.images?.[0]?.url || "";
    const songUrl = song.item.external_urls?.spotify || "";
    const progress_ms = song.progress_ms || 0;
    const duration_ms = song.item.duration_ms || 0;

    return NextResponse.json({
      isConnected: true,
      isPlaying,
      title,
      artist,
      album,
      albumImageUrl,
      songUrl,
      progress_ms,
      duration_ms,
    });
  } catch (error) {
    console.error("[SPOTIFY_NOW_PLAYING_ERROR]", error);
    return NextResponse.json({ isConnected: false, isPlaying: false });
  }
}

