import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function sanitizePin(val?: string | null): string | null {
  if (!val) return null;
  // Remove surrounding quotes, Windows CRLF \r, and whitespace
  const cleaned = val.replace(/^["']|["']$/g, "").replace(/\r/g, "").trim();
  return cleaned || null;
}

async function getStoredPin(): Promise<string | null> {
  let pin = sanitizePin(process.env.ACCESS_PIN) || sanitizePin(process.env.PIN) || sanitizePin(process.env.ACCESS_PASSWORD);
  if (!pin) {
    try {
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "access_pin"));
      pin = sanitizePin(row?.value);
    } catch (e) {
      console.warn("Could not read systemSettings for access_pin:", e);
    }
  }
  return pin;
}

export async function GET() {
  const correctPin = await getStoredPin();
  return NextResponse.json({ configured: Boolean(correctPin) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inputPin = sanitizePin(body?.pin);

    const correctPin = await getStoredPin();

    if (!correctPin) {
      // No PIN configured in .env or DB — allow access but notify
      return NextResponse.json({
        success: true,
        configured: false,
        message: "No PIN configured in environment or database.",
      });
    }

    if (!inputPin) {
      return NextResponse.json({ success: false, message: "PIN is required" }, { status: 400 });
    }

    if (inputPin === correctPin) {
      return NextResponse.json({ success: true, configured: true });
    }

    return NextResponse.json({ success: false, message: "Incorrect password or PIN" }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Server error" }, { status: 500 });
  }
}
