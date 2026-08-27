import { NextRequest, NextResponse } from "next/server";
import { setShuffle } from "@/lib/spotify";

export const dynamic = "force-dynamic";

async function handleShuffle(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let state = true;

    if (searchParams.has("state")) {
      state = searchParams.get("state") !== "false";
    } else {
      const body = await req.json().catch(() => ({}));
      if (body?.state !== undefined) {
        state = Boolean(body.state);
      }
    }

    const deviceId = searchParams.get("device_id") || undefined;
    const result = await setShuffle(state, deviceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Failed to set shuffle." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      state: result.state ?? state,
      message: `Shuffle mode ${state ? "enabled" : "disabled"}.`,
    });
  } catch (err: any) {
    console.error("[SPOTIFY_SHUFFLE_API_ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleShuffle(req);
}

export async function POST(req: NextRequest) {
  return handleShuffle(req);
}

export async function GET(req: NextRequest) {
  return handleShuffle(req);
}
