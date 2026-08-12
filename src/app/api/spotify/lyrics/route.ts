import { NextRequest, NextResponse } from "next/server";
import { parseLrc } from "@/lib/lrc-parser";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const artist = searchParams.get("artist")?.trim();
    const track = searchParams.get("track")?.trim();

    if (!artist || !track) {
      return NextResponse.json(
        { error: "Both 'artist' and 'track' query parameters are required." },
        { status: 400 }
      );
    }

    const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`;

    const response = await fetch(lrclibUrl, {
      headers: {
        "User-Agent": "PersonalOS-Dashboard/1.0",
      },
      next: { revalidate: 86400 }, // Cache lyrics for 24 hours in Next.js
    });

    if (!response.ok) {
      return NextResponse.json(
        { lyrics: null },
        {
          headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
          },
        }
      );
    }

    const data = await response.json().catch(() => null);

    if (!data || !data.syncedLyrics) {
      return NextResponse.json(
        { lyrics: null },
        {
          headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
          },
        }
      );
    }

    const parsedArray = parseLrc(data.syncedLyrics);

    return NextResponse.json(
      { lyrics: parsedArray },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[SPOTIFY_LYRICS_ERROR]", error);
    return NextResponse.json({ lyrics: null });
  }
}
