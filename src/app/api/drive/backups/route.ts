import { NextRequest, NextResponse } from "next/server";
import { getGoogleRefreshToken, getDriveClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const refreshToken = await getGoogleRefreshToken();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Google Drive is not connected." },
        { status: 401 }
      );
    }

    const drive = await getDriveClient(req);
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    let qClause = "trashed = false and (name contains '.zip' or mimeType = 'application/zip' or name contains 'PersonalOS')";
    if (query) {
      const sanitized = query.replace(/'/g, "\\'");
      qClause += ` and name contains '${sanitized}'`;
    }

    const response = await drive.files.list({
      pageSize: 50,
      q: qClause,
      orderBy: "modifiedTime desc",
      fields: "files(id, name, size, modifiedTime, webViewLink)",
    });

    const files = (response.data.files || []).map((f) => {
      const bytes = Number(f.size || 0);
      const sizeMB = (bytes / (1024 * 1024)).toFixed(2);
      return {
        id: f.id || "",
        name: f.name || "Backup.zip",
        sizeBytes: bytes,
        sizeDisplay: bytes > 0 ? `${sizeMB} MB` : "Unknown size",
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        webViewLink: f.webViewLink || "",
      };
    });

    return NextResponse.json({ success: true, files });
  } catch (error: any) {
    console.error("[DRIVE_BACKUPS_API_ERROR]", error);
    const status = error.code === 401 || error.status === 401 ? 401 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch backup files from Google Drive" },
      { status }
    );
  }
}
