import { NextRequest, NextResponse } from "next/server";
import { controlPlayback } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as "play" | "pause" | "next" | "previous";

    if (!action || !["play", "pause", "next", "previous"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be play, pause, next, or previous." },
        { status: 400 }
      );
    }

    const result = await controlPlayback(action);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[SPOTIFY_CONTROLS_ERROR]", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
