import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assetId, gdriveId, syncStatus } = body;

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    await db
      .update(assets)
      .set({
        syncStatus: syncStatus || "SYNCED_LOCAL_KEPT",
        gdriveId: gdriveId || null,
      })
      .where(eq(assets.id, Number(assetId)));

    revalidatePath("/drive");
    revalidatePath("/inventory");
    revalidatePath("/");

    return NextResponse.json({ success: true, assetId, gdriveId, syncStatus });
  } catch (error: any) {
    console.error("[ASSET_SYNC_API_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to update asset sync status" },
      { status: 500 }
    );
  }
}
