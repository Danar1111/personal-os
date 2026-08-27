import { NextRequest, NextResponse } from "next/server";
import { controlPlayback } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const result = await controlPlayback("next");
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Failed to skip to next track." },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, message: "Skipped to next track." });
  } catch (err: any) {
    console.error("[SPOTIFY_NEXT_API_ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
