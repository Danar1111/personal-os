import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import os from "os";
import { getDriveClient, getGoogleRefreshToken } from "@/lib/google";
import { db } from "@/db";
import { sql } from "drizzle-orm";
const AdmZip = require("adm-zip");

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for restore

export async function POST(req: NextRequest) {
  try {
    let zipBuffer: Buffer | null = null;
    let driveFileId: string | null = null;

    let tempId: string | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      driveFileId = (formData.get("driveFileId") as string)?.trim() || null;
      tempId = (formData.get("tempId") as string)?.trim() || null;

      if (file) {
        const arrayBuf = await file.arrayBuffer();
        zipBuffer = Buffer.from(arrayBuf);
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      driveFileId = body.driveFileId?.trim() || null;
      tempId = body.tempId?.trim() || null;
    } else {
      const arrayBuf = await req.arrayBuffer();
      if (arrayBuf && arrayBuf.byteLength > 0) {
        zipBuffer = Buffer.from(arrayBuf);
      }
    }

    let activeTempPath: string | null = null;
    if (tempId) {
      const projPath = path.join(process.cwd(), ".tmp_migrations", tempId);
      const osPath = path.join(os.tmpdir(), tempId);
      activeTempPath = fs.existsSync(projPath) ? projPath : (fs.existsSync(osPath) ? osPath : null);
      
      if (activeTempPath && !fs.statSync(activeTempPath).isDirectory()) {
        zipBuffer = fs.readFileSync(activeTempPath);
        fs.unlinkSync(activeTempPath);
        activeTempPath = null;
      }
    }

    // If restoring directly from a Google Drive file ID without validation
    if (!zipBuffer && driveFileId && !activeTempPath) {
      const refreshToken = await getGoogleRefreshToken();
      if (!refreshToken) {
        return NextResponse.json(
          { success: false, error: "Google Drive is not connected." },
          { status: 401 }
        );
      }

      const drive = await getDriveClient(req);
      const driveFileRes = await drive.files.get(
        { fileId: driveFileId, alt: "media" },
        { responseType: "arraybuffer" }
      );

      if (driveFileRes.data) {
        zipBuffer = Buffer.from(driveFileRes.data as ArrayBuffer);
      }
    }

    let parsedBackup: any;
    let zipEntriesForLegacy: any[] = [];
    let isPhysicalFolder = Boolean(activeTempPath);

    let targetTempDir: string | null = null;
    if (isPhysicalFolder && activeTempPath) {
      let tempDir = activeTempPath;
      let dbJsonPath = path.join(tempDir, "database.json");

      if (!fs.existsSync(dbJsonPath)) {
        const items = fs.readdirSync(tempDir);
        for (const item of items) {
          const subPath = path.join(tempDir, item);
          if (fs.statSync(subPath).isDirectory()) {
            const nestedDb = path.join(subPath, "database.json");
            if (fs.existsSync(nestedDb)) {
              tempDir = subPath;
              dbJsonPath = nestedDb;
              break;
            }
          }
        }
      }

      if (!fs.existsSync(dbJsonPath)) {
        return NextResponse.json({ success: false, error: "Missing database.json in temp folder" }, { status: 400 });
      }
      targetTempDir = tempDir;
      try {
        parsedBackup = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Corrupted database.json: ${err.message}` }, { status: 400 });
      }
    } else {
      if (!zipBuffer || zipBuffer.length === 0) {
        return NextResponse.json({ success: false, error: "No valid backup archive file received." }, { status: 400 });
      }
      // Legacy AdmZip processing
      const zip = new AdmZip(zipBuffer);
      zipEntriesForLegacy = zip.getEntries();
      const dbEntry = zip.getEntry("database.json");
      if (!dbEntry) return NextResponse.json({ success: false, error: "Invalid backup archive: missing 'database.json'." }, { status: 400 });
      try {
        parsedBackup = JSON.parse(dbEntry.getData().toString("utf8"));
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Corrupted database.json: ${err.message}` }, { status: 400 });
      }
    }

    const tablesData = parsedBackup.tables || parsedBackup;
    const restoredSummary: Record<string, number> = {};

    // 3. DYNAMIC DATABASE RESTORE ENGINE
    await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 0;"));

    try {
      // Step A: Discover existing database tables dynamically via SHOW TABLES
      const [tablesResult]: any = await db.execute(sql.raw("SHOW TABLES;"));
      const existingTables: string[] = Array.isArray(tablesResult)
        ? tablesResult.map((row: any) => Object.values(row)[0] as string)
        : [];

      // Step B: Truncate existing tables
      for (const tableName of existingTables) {
        try {
          await db.execute(sql.raw(`TRUNCATE TABLE \`${tableName}\`;`));
        } catch {
          try {
            await db.execute(sql.raw(`DELETE FROM \`${tableName}\`;`));
          } catch (delErr) {
            console.warn(`[Restore Warning] Could not clear table ${tableName}:`, delErr);
          }
        }
      }

      // Step C: Dynamically Insert rows for all tables found in database.json
      for (const [tableName, rows] of Object.entries(tablesData)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const colNamesSql = columns.map((c) => `\`${c}\``).join(", ");
        const BATCH_SIZE = 100;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const rowPlaceholders: string[] = [];

          for (const row of batch) {
            const valStrings: string[] = [];
            for (const col of columns) {
              const val = row[col];
              if (val === null || val === undefined) {
                valStrings.push("NULL");
              } else if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                const formattedDate = new Date(val).toISOString().slice(0, 19).replace("T", " ");
                valStrings.push(`'${formattedDate}'`);
              } else if (typeof val === "boolean") {
                valStrings.push(val ? "1" : "0");
              } else if (typeof val === "number") {
                valStrings.push(`${val}`);
              } else if (typeof val === "object") {
                const escaped = JSON.stringify(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                valStrings.push(`'${escaped}'`);
              } else {
                const escaped = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                valStrings.push(`'${escaped}'`);
              }
            }
            rowPlaceholders.push(`(${valStrings.join(", ")})`);
          }

          const bulkInsertSql = `INSERT INTO \`${tableName}\` (${colNamesSql}) VALUES ${rowPlaceholders.join(", ")};`;
          await db.execute(sql.raw(bulkInsertSql));
        }

        restoredSummary[tableName] = rows.length;
      }
    } finally {
      await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 1;"));
    }

    // 4. Extract uploads/ directory to /public/uploads
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let restoredFilesCount = 0;
    
    if (isPhysicalFolder && activeTempPath) {
      const tempUploadsDir = path.join(targetTempDir || activeTempPath, "uploads");
      if (fs.existsSync(tempUploadsDir)) {
        const copyRecursiveSync = (src: string, dest: string) => {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          const entries = fs.readdirSync(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              copyRecursiveSync(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
              restoredFilesCount++;
            }
          }
        };
        copyRecursiveSync(tempUploadsDir, uploadsDir);
      }
      
      // Cleanup the physical folder after successful import
      try {
        fs.rmSync(activeTempPath, { recursive: true, force: true });
      } catch (err) {
        console.error("[Cleanup Error]", err);
      }
    } else {
      for (const entry of zipEntriesForLegacy) {
        if (entry.entryName.startsWith("uploads/") && !entry.isDirectory) {
          const relativeFilePath = entry.entryName.replace(/^uploads\//, "");
          if (relativeFilePath) {
            const destFilePath = path.join(uploadsDir, relativeFilePath);
            const destDir = path.dirname(destFilePath);
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }
            fs.writeFileSync(destFilePath, entry.getData());
            restoredFilesCount++;
          }
        }
      }
    }

    // Revalidate app cache
    revalidatePath("/");
    revalidatePath("/settings");

    return NextResponse.json({
      success: true,
      message: "Personal OS database and media files restored successfully!",
      restoredSummary,
      restoredFilesCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Migration Import Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to restore backup archive.",
      },
      { status: 500 }
    );
  }
}
