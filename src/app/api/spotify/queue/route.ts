import { NextRequest, NextResponse } from "next/server";
import { getQueue, addToQueue } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getQueue();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[SPOTIFY_QUEUE_GET_ERROR]", err);
    return NextResponse.json(
      { success: false, currentlyPlaying: null, queue: [], error: err.message || "Failed to fetch queue." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const trackUri: string | undefined = body?.trackUri;

    if (!trackUri) {
      return NextResponse.json(
        { success: false, error: "MISSING_URI", message: "trackUri is required." },
        { status: 400 }
      );
    }

    const result = await addToQueue(trackUri);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[SPOTIFY_QUEUE_POST_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add track to queue." },
      { status: 500 }
    );
  }
}
