import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    const correctPin = process.env.ACCESS_PIN;

    if (!correctPin) {
      // No PIN configured — allow access
      return NextResponse.json({ success: true });
    }

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ success: false, message: "PIN is required" }, { status: 400 });
    }

    if (pin === correctPin) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Incorrect PIN" }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
