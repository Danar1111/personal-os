import { NextRequest, NextResponse } from "next/server";

function sanitizePin(val?: string | null): string | null {
  if (!val) return null;
  const cleaned = val.replace(/^["']|["']$/g, "").replace(/\r/g, "").trim();
  return cleaned || null;
}

async function createSessionHash(pin: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || "personal_os_super_secret_auth_key_2026";
  const encoder = new TextEncoder();
  const data = encoder.encode(`${secret}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect all /api/* routes except public auth & health endpoints
  if (pathname.startsWith("/api/")) {
    if (
      pathname === "/api/verify-pin" ||
      pathname === "/api/health/db" ||
      pathname === "/api/spotify/login" ||
      pathname === "/api/spotify/callback" ||
      pathname === "/api/google/login" ||
      pathname === "/api/google/callback"
    ) {
      return NextResponse.next();
    }


    const pin = sanitizePin(process.env.ACCESS_PIN) || sanitizePin(process.env.PIN) || sanitizePin(process.env.ACCESS_PASSWORD);
    if (!pin) {
      // No PIN configured in env — allow access
      return NextResponse.next();
    }

    const sessionCookie = req.cookies.get("personal_os_session")?.value;
    const expectedHash = await createSessionHash(pin);

    if (!sessionCookie || sessionCookie !== expectedHash) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Valid authentication session cookie is required to access Personal OS API routes.",
        },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
