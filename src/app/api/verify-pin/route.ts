import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = body?.pin;

    let correctPin = process.env.ACCESS_PIN;

    if (!correctPin) {
      try {
        const [row] = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, "access_pin"));
        if (row?.value?.trim()) {
          correctPin = row.value.trim();
        }
      } catch (e) {
        console.warn("Could not read systemSettings for access_pin:", e);
      }
    }

    if (!correctPin) {
      // No PIN configured — allow access
      return NextResponse.json({ success: true });
    }

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ success: false, message: "PIN is required" }, { status: 400 });
    }

    if (pin.trim() === correctPin.trim()) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Incorrect PIN" }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Server error" }, { status: 500 });
  }
}
