import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // TODO: Implement manual file upload logic using googleapis drive.files.create
    return NextResponse.json(
      { message: "Sync endpoint ready" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DRIVE_SYNC_API_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to process drive sync request" },
      { status: 500 }
    );
  }
}
