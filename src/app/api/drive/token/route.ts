import { NextRequest, NextResponse } from "next/server";
import { getGoogleRefreshToken, setGoogleCredentials } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const refreshToken = await getGoogleRefreshToken();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Google Drive is not connected. Please authenticate in Settings." },
        { status: 401 }
      );
    }

    const oauth2Client = setGoogleCredentials(refreshToken, req);
    const tokenResponse = await oauth2Client.getAccessToken();

    if (!tokenResponse.token) {
      return NextResponse.json(
        { error: "Failed to obtain Google access token." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accessToken: tokenResponse.token,
      expiresIn: tokenResponse.res?.data?.expires_in || 3600,
    });
  } catch (error: any) {
    console.error("[DRIVE_TOKEN_API_ERROR]", error);
    const isAuthError =
      error?.response?.data?.error === "invalid_grant" ||
      error?.message?.includes("invalid_grant") ||
      error?.message?.includes("No refresh token") ||
      error?.code === 401 ||
      error?.status === 401;

    const friendlyMsg = isAuthError
      ? "Google Drive session expired or disconnected. Please reconnect Google Drive in Settings."
      : (error.message || "Failed to generate Google Drive access token.");

    return NextResponse.json(
      { error: friendlyMsg },
      { status: 401 }
    );
  }
}
