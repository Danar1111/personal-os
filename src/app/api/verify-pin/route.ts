import { NextRequest, NextResponse } from "next/server";
import { getStoredPin, sanitizePin, createSessionHash } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correctPin = await getStoredPin();
  if (!correctPin) {
    return NextResponse.json({ configured: false, authenticated: true });
  }

  const sessionCookie = req.cookies.get("personal_os_session")?.value;
  const expectedHash = await createSessionHash(correctPin);
  const authenticated = Boolean(sessionCookie && sessionCookie === expectedHash);

  return NextResponse.json({ configured: true, authenticated });
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inputPin = sanitizePin(body?.pin);

    const correctPin = await getStoredPin();

    if (!correctPin) {
      const response = NextResponse.json({
        success: true,
        configured: false,
        message: "No PIN configured in environment or database.",
      });
      return response;
    }

    if (!inputPin) {
      return NextResponse.json({ success: false, message: "PIN is required" }, { status: 400 });
    }

    if (inputPin === correctPin) {
      const sessionHash = await createSessionHash(correctPin);
      const response = NextResponse.json({ success: true, configured: true });
      response.cookies.set({
        name: "personal_os_session",
        value: sessionHash,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      return response;
    }

    return NextResponse.json({ success: false, message: "Incorrect password or PIN" }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set({
    name: "personal_os_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
