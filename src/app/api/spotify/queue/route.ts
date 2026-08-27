import { NextRequest, NextResponse } from "next/server";
import { addToQueue } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const trackUri = body?.trackUri || body?.uri;
    const deviceId = body?.deviceId;

    if (!trackUri) {
      return NextResponse.json(
        { success: false, error: "trackUri is required" },
        { status: 400 }
      );
    }

    const result = await addToQueue(trackUri, deviceId);

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
            "No active Spotify device found. Please open Spotify first.",
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Added to queue.",
    });
  } catch (err: any) {
    console.error("[SPOTIFY_QUEUE_API_ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to add track to Spotify queue." },
      { status: 500 }
    );
  }
}
