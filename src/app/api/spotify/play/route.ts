import { NextRequest, NextResponse } from "next/server";
import { playTrack } from "@/lib/spotify";

export const dynamic = "force-dynamic";

async function handlePlay(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const trackUri = body?.trackUri || body?.uri;
    const contextUri = body?.contextUri || body?.albumUri;
    const uris = body?.uris;
    const deviceId = body?.deviceId;
    const shuffle = typeof body?.shuffle === "boolean" ? body.shuffle : undefined;

    const result = await playTrack({
      trackUri,
      contextUri,
      uris,
      deviceId,
      shuffle,
    });

    if (!result.success) {
      const status =
        result.error === "NO_ACTIVE_DEVICE"
          ? 404
          : result.error === "PREMIUM_REQUIRED"
          ? 403
          : result.error === "NOT_CONNECTED"
          ? 401
          : 400;

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message:
            result.message ||
            "No active Spotify device found. Please open Spotify on your device first.",
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Playback started.",
    });
  } catch (err: any) {
    console.error("[SPOTIFY_PLAY_API_ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to trigger Spotify playback." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handlePlay(req);
}

export async function POST(req: NextRequest) {
  return handlePlay(req);
}
