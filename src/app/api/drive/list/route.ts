import { NextRequest, NextResponse } from "next/server";
import { getGoogleRefreshToken, getDriveClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const refreshToken = await getGoogleRefreshToken();

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: "Google Drive not connected",
          message: "No GOOGLE_REFRESH_TOKEN found in database or environment.",
        },
        { status: 401 }
      );
    }

    const drive = await getDriveClient(req);
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    let qClause = "trashed = false";
    if (query) {
      // Escape single quotes for Google Drive API query syntax
      const sanitized = query.replace(/'/g, "\\'");
      qClause += ` and name contains '${sanitized}'`;
    }

    const response = await drive.files.list({
      pageSize: 50,
      q: qClause,
      orderBy: "modifiedTime desc",
      fields:
        "files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, modifiedTime, size)",
    });

    return NextResponse.json({
      files: response.data.files || [],
    });
  } catch (error: any) {
    console.error("[DRIVE_LIST_API_ERROR]", error);

    const status = error.code === 401 || error.status === 401 ? 401 : 500;
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch files from Google Drive",
      },
      { status }
    );
  }
}
