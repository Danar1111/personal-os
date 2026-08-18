import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PassThrough, Readable } from "stream";
import { getDriveClient, getGoogleRefreshToken } from "@/lib/google";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ZipArchive } from "archiver";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large archives

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const destination = searchParams.get("destination") || "local";
    const targetFolderId = searchParams.get("folderId")?.trim();

    // 1. DYNAMIC TABLE DISCOVERY via SHOW TABLES
    const [tablesResult]: any = await db.execute(sql.raw("SHOW TABLES;"));
    const tableNames: string[] = Array.isArray(tablesResult)
      ? tablesResult.map((row: any) => Object.values(row)[0] as string)
      : [];

    const tablesData: Record<string, any[]> = {};

    // 2. Fetch all records dynamically for each discovered table
    for (const tableName of tableNames) {
      try {
        const [rows]: any = await db.execute(sql.raw(`SELECT * FROM \`${tableName}\`;`));
        tablesData[tableName] = Array.isArray(rows) ? rows : [];
      } catch (tableErr) {
        console.warn(`[Export Warning] Failed to dump table ${tableName}:`, tableErr);
        tablesData[tableName] = [];
      }
    }

    const databaseDump = {
      meta: {
        version: "1.0.0",
        app: "Personal OS",
        exportedAt: new Date().toISOString(),
        tablesCount: tableNames.length,
      },
      tables: tablesData,
    };

    const jsonString = JSON.stringify(databaseDump, null, 2);

    // 3. Initialize Archiver ZIP Stream
    const archive = new ZipArchive({
      zlib: { level: 9 }, // Sets the compression level.
    });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    // Append database.json
    archive.append(jsonString, { name: "database.json" });

    // Append /public/uploads folder if it exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, "uploads");
    }

    archive.on("error", (err) => {
      console.error("[Archiver Export Error]:", err);
      passThrough.destroy(err);
    });

    archive.finalize();

    // Formatted backup filename: PersonalOS_Backup_YYYYMMDD_HHmm.zip
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const backupFileName = `PersonalOS_Backup_${yyyy}${mm}${dd}_${hh}${min}.zip`;

    // 4. DESTINATION CHOICE: SAVE DIRECTLY TO GOOGLE DRIVE
    if (destination === "gdrive") {
      const refreshToken = await getGoogleRefreshToken();
      if (!refreshToken) {
        return NextResponse.json(
          { success: false, error: "Google Drive is not connected." },
          { status: 401 }
        );
      }

      const drive = await getDriveClient(req);
      const parents = targetFolderId && targetFolderId !== "root" ? [targetFolderId] : undefined;

      const driveResponse = await drive.files.create({
        requestBody: {
          name: backupFileName,
          mimeType: "application/zip",
          parents,
        },
        media: {
          mimeType: "application/zip",
          body: passThrough,
        },
        fields: "id, name, webViewLink",
      });

      return NextResponse.json({
        success: true,
        message: `Successfully uploaded "${backupFileName}" to Google Drive!`,
        driveFile: {
          id: driveResponse.data.id,
          name: driveResponse.data.name,
          webViewLink: driveResponse.data.webViewLink,
        },
      });
    }

    // 5. DESTINATION CHOICE: STREAM DOWNLOAD TO LOCAL COMPUTER
    const webStream = Readable.toWeb(passThrough);

    return new Response(webStream as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${backupFileName}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[Migration Export Route Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to export backup archive" },
      { status: 500 }
    );
  }
}
