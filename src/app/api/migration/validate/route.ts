import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getDriveClient, getGoogleRefreshToken } from "@/lib/google";
const AdmZip = require("adm-zip");

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  const isSse = contentType.includes("application/json");

  // Base directory for temp migrations
  const baseTempDir = path.join(process.cwd(), ".tmp_migrations");
  if (!fs.existsSync(baseTempDir)) {
    fs.mkdirSync(baseTempDir, { recursive: true });
  } else {
    // Auto-cleanup any old/stale migration folders
    try {
      const existingItems = fs.readdirSync(baseTempDir);
      for (const item of existingItems) {
        if (item.startsWith("migration_")) {
          fs.rmSync(path.join(baseTempDir, item), { recursive: true, force: true });
        }
      }
    } catch (cleanupErr) {
      console.warn("Failed to clean up stale temp folders:", cleanupErr);
    }
  }

  const tempDirId = `migration_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempDir = path.join(baseTempDir, tempDirId);
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = path.join(tempDir, "backup.zip");

  // Helper to extract and analyze backup folder
  const processAndAnalyzeBackup = (folderPath: string, fileName: string) => {
    // 1. Physically extract ZIP
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(folderPath, true);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // 2. Discover database.json
    let targetDir = folderPath;
    let dbJsonPath = path.join(targetDir, "database.json");

    if (!fs.existsSync(dbJsonPath)) {
      const items = fs.readdirSync(folderPath);
      for (const item of items) {
        const subPath = path.join(folderPath, item);
        if (fs.statSync(subPath).isDirectory()) {
          const nestedDb = path.join(subPath, "database.json");
          if (fs.existsSync(nestedDb)) {
            targetDir = subPath;
            dbJsonPath = nestedDb;
            break;
          }
        }
      }
    }

    if (!fs.existsSync(dbJsonPath)) {
      throw new Error("Invalid backup archive: missing 'database.json'. Please check your ZIP file.");
    }

    const dbJsonString = fs.readFileSync(dbJsonPath, "utf8");
    let parsedBackup: any;
    try {
      parsedBackup = JSON.parse(dbJsonString);
    } catch (parseErr: any) {
      throw new Error(`Corrupted database.json: ${parseErr.message}`);
    }

    const tablesData = parsedBackup.tables || parsedBackup;
    let totalDbRows = 0;
    const tableCounts: Record<string, number> = {};

    for (const [tableName, rows] of Object.entries(tablesData)) {
      if (Array.isArray(rows)) {
        tableCounts[tableName] = rows.length;
        totalDbRows += rows.length;
      }
    }

    // 3. Count uploads
    let uploadFileCount = 0;
    let uploadTotalSize = 0;
    const uploadsDir = path.join(targetDir, "uploads");

    if (fs.existsSync(uploadsDir)) {
      const readDirRecursive = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            readDirRecursive(filePath);
          } else {
            uploadFileCount++;
            uploadTotalSize += stat.size;
          }
        }
      };
      readDirRecursive(uploadsDir);
    }

    return {
      fileName,
      tempId: tempDirId,
      tablesCount: Object.keys(tableCounts).length,
      tableCounts,
      totalDbRows,
      uploads: {
        fileCount: uploadFileCount,
        totalSizeBytes: uploadTotalSize,
        totalSizeMB: (uploadTotalSize / (1024 * 1024)).toFixed(2),
      },
    };
  };

  // If request is from Google Drive -> Use SSE Stream for real-time progress
  if (isSse) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (data: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    (async () => {
      try {
        const body = await req.json();
        const driveFileId = body.driveFileId?.trim();
        let fileName = body.fileName || "drive_backup.zip";

        if (!driveFileId) {
          throw new Error("No Google Drive File ID provided.");
        }

        await sendEvent({ step: "starting", progress: 5, message: "Connecting to Google Drive..." });

        const refreshToken = await getGoogleRefreshToken();
        if (!refreshToken) {
          throw new Error("Google Drive is not connected.");
        }

        const drive = await getDriveClient(req);

        // Fetch metadata to get file size
        const meta = await drive.files.get({ fileId: driveFileId, fields: "size, name" });
        const totalBytes = parseInt(meta.data.size || "0", 10);
        if (meta.data.name) fileName = meta.data.name;

        await sendEvent({
          step: "downloading",
          progress: 10,
          loadedBytes: 0,
          totalBytes,
          message: `Starting download (${(totalBytes / 1024 / 1024).toFixed(1)} MB)...`,
        });

        // Stream file chunks and report progress
        const driveFileRes = await drive.files.get(
          { fileId: driveFileId, alt: "media" },
          { responseType: "stream" }
        );

        const dest = fs.createWriteStream(zipPath);
        let loadedBytes = 0;
        let lastReport = Date.now();

        await new Promise((resolve, reject) => {
          (driveFileRes.data as any).on("data", (chunk: Buffer) => {
            loadedBytes += chunk.length;
            const now = Date.now();
            if (now - lastReport > 150 || loadedBytes === totalBytes) {
              lastReport = now;
              const progress = totalBytes > 0 ? Math.min(80, Math.round((loadedBytes / totalBytes) * 80)) : 50;
              sendEvent({
                step: "downloading",
                progress,
                loadedBytes,
                totalBytes,
                message: `Downloading from Google Drive: ${(loadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
              });
            }
          });

          dest.on("finish", resolve);
          dest.on("error", reject);
          (driveFileRes.data as any).on("error", reject);
          (driveFileRes.data as any).pipe(dest);
        });

        // Extracting step
        await sendEvent({ step: "extracting", progress: 85, message: "Unzipping & extracting backup archive..." });
        
        // Analyzing step
        await sendEvent({ step: "analyzing", progress: 95, message: "Analyzing database records & files..." });
        const validationResult = processAndAnalyzeBackup(tempDir, fileName);

        // Done
        await sendEvent({
          step: "done",
          progress: 100,
          message: "Backup verified successfully!",
          data: validationResult,
        });
      } catch (err: any) {
        console.error("[VALIDATE_SSE_ERROR]", err);
        // Clean up on error
        if (fs.existsSync(tempDir)) {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch {}
        }
        await sendEvent({ step: "error", error: err.message || "Failed to validate backup." });
      } finally {
        writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  }

  // Local File Upload (Multipart Form Data)
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new Error("No backup archive file uploaded.");
    }

    const fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

    const result = processAndAnalyzeBackup(tempDir, fileName);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[VALIDATE_LOCAL_ERROR]", error);
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to validate backup." },
      { status: 500 }
    );
  }
}
