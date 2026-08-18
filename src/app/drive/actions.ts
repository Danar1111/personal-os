"use server";

import { db } from "@/db";
import { assets, Asset, systemSettings } from "@/db/schema";
import { ne, eq, desc, inArray, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { getDriveClient, getGoogleRefreshToken } from "@/lib/google";

export async function getSyncFolderSettingAction(): Promise<{ folderId: string; folderName: string }> {
  try {
    const idRecord = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "GOOGLE_DRIVE_SYNC_FOLDER_ID"))
      .limit(1);

    const nameRecord = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "GOOGLE_DRIVE_SYNC_FOLDER_NAME"))
      .limit(1);

    return {
      folderId: idRecord[0]?.value || "root",
      folderName: nameRecord[0]?.value || "Root (My Drive)",
    };
  } catch (err) {
    console.error("Failed to get sync folder setting:", err);
    return { folderId: "root", folderName: "Root (My Drive)" };
  }
}

export async function saveSyncFolderAction(folderId: string, folderName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const upsertSetting = async (key: string, value: string) => {
      const existing = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(systemSettings.key, key));
      } else {
        await db.insert(systemSettings).values({ key, value, isSecret: false });
      }
    };

    await upsertSetting("GOOGLE_DRIVE_SYNC_FOLDER_ID", folderId);
    await upsertSetting("GOOGLE_DRIVE_SYNC_FOLDER_NAME", folderName);

    revalidatePath("/drive");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to save sync folder:", err);
    return { success: false, error: err.message };
  }
}

function determineFileType(fileName: string): "pdf" | "image" | "video" {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext)) {
    return "image";
  }
  if (["mp4", "webm", "mkv", "mov", "avi"].includes(ext)) {
    return "video";
  }
  return "pdf";
}

export async function getDriveAssets(): Promise<Asset[]> {
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 1. Scan physical disk files in /public/uploads
    const diskFiles = fs.readdirSync(uploadsDir);
    const existingAssets = await db.select().from(assets);

    const assetMapByUrl = new Map<string, Asset>();
    existingAssets.forEach((a) => {
      assetMapByUrl.set(a.urlOrPath, a);
    });

    // 2. Synchronize untracked disk files into assets table
    for (const fileName of diskFiles) {
      const fullPath = path.join(uploadsDir, fileName);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          const urlPath = `/uploads/${fileName}`;
          const existing = assetMapByUrl.get(urlPath);

          if (!existing) {
            // Insert missing disk file into assets table
            await db.insert(assets).values({
              title: fileName,
              type: determineFileType(fileName),
              urlOrPath: urlPath,
              sizeBytes: stats.size,
              syncStatus: "LOCAL_UNSYNCED",
              tags: "local,upload",
            });
          } else if (existing.sizeBytes !== stats.size) {
            // Update size if physical disk size differs
            await db.update(assets).set({ sizeBytes: stats.size }).where(eq(assets.id, existing.id));
          }
        }
      } catch (err) {
        console.warn(`[DriveActions] Failed to stat file ${fileName}:`, err);
      }
    }

    // 3. Check for deleted physical files and adjust sync_status to CLOUD_ONLY if gdriveId exists
    for (const asset of existingAssets) {
      if (asset.urlOrPath.startsWith("/uploads/")) {
        const relativePath = asset.urlOrPath.replace(/^\//, "");
        const fullFilePath = path.join(process.cwd(), "public", relativePath);
        const physicalExists = fs.existsSync(fullFilePath);

        if (!physicalExists) {
          if (asset.gdriveId && asset.syncStatus !== "CLOUD_ONLY") {
            await db
              .update(assets)
              .set({ syncStatus: "CLOUD_ONLY" })
              .where(eq(assets.id, asset.id));
          }
        }
      }
    }

    // 4. Auto-reconcile with Google Drive files if connected
    try {
      const refreshToken = await getGoogleRefreshToken();
      if (refreshToken) {
        const driveClient = await getDriveClient();
        const gdriveRes = await driveClient.files.list({
          pageSize: 100,
          q: "trashed = false",
          fields: "files(id, name, mimeType, size)",
        });

        const driveFiles = gdriveRes.data.files || [];
        const driveFileMapByName = new Map<string, any>();
        driveFiles.forEach((df) => {
          if (df.name) {
            driveFileMapByName.set(df.name.toLowerCase().trim(), df);
          }
        });

        // Reconcile existing assets with Google Drive files
        const currentAssets = await db.select().from(assets);
        for (const asset of currentAssets) {
          const cleanTitle = asset.title.toLowerCase().trim();
          const cleanFileName = path.basename(asset.urlOrPath).toLowerCase().trim();
          
          // Match by title or physical filename (e.g. "Jenis jenis subject.pdf")
          const matchedDriveFile =
            driveFileMapByName.get(cleanTitle) ||
            driveFileMapByName.get(cleanFileName) ||
            // strip timestamp prefix if any (e.g., 1786111769026-Jenis_jenis_subject.pdf -> Jenis_jenis_subject.pdf)
            driveFileMapByName.get(cleanFileName.replace(/^\d+[-_]/, "").replace(/_/g, " "));

          if (matchedDriveFile) {
            const isLocal =
              asset.urlOrPath.startsWith("/uploads/") &&
              fs.existsSync(path.join(process.cwd(), "public", asset.urlOrPath.replace(/^\//, "")));

            const targetStatus = isLocal ? "SYNCED_LOCAL_KEPT" : "CLOUD_ONLY";

            const needsUpdate =
              asset.gdriveId !== matchedDriveFile.id ||
              asset.syncStatus !== targetStatus;

            if (needsUpdate) {
              await db
                .update(assets)
                .set({
                  gdriveId: matchedDriveFile.id,
                  syncStatus: targetStatus,
                })
                .where(eq(assets.id, asset.id));

              console.log(`[AutoReconcile] Synced asset "${asset.title}" with Google Drive ID: ${matchedDriveFile.id}`);
            }
          }
        }
      }
    } catch (gdriveSyncErr) {
      console.warn("[getDriveAssets] Auto Google Drive reconciliation skipped:", gdriveSyncErr);
    }

    // 5. Return all assets
    const driveAssets = await db
      .select()
      .from(assets)
      .where(ne(assets.type, "link"))
      .orderBy(desc(assets.createdAt));

    return driveAssets;
  } catch (error) {
    console.error("Failed to fetch drive assets:", error);
    return [];
  }
}

export async function deleteLocalCopiesAction(assetIds: number[]): Promise<{ success: boolean; modifiedCount: number }> {
  try {
    if (!assetIds || assetIds.length === 0) {
      return { success: true, modifiedCount: 0 };
    }

    const targetAssets = await db.select().from(assets).where(inArray(assets.id, assetIds));
    let modifiedCount = 0;

    for (const asset of targetAssets) {
      // 1. Physically delete file from /public/uploads
      if (asset.urlOrPath && asset.urlOrPath.startsWith("/uploads/")) {
        const relativePath = asset.urlOrPath.replace(/^\//, "");
        const fullFilePath = path.join(process.cwd(), "public", relativePath);

        if (fs.existsSync(fullFilePath)) {
          try {
            fs.unlinkSync(fullFilePath);
            console.log(`[DeleteLocalCopies] Unlinked disk file: ${fullFilePath}`);
          } catch (unlinkErr) {
            console.error("Failed to unlink disk file:", unlinkErr);
          }
        }
      }

      // 2. If backed up in Google Drive, keep row as CLOUD_ONLY ghost file
      if (asset.gdriveId) {
        await db
          .update(assets)
          .set({ syncStatus: "CLOUD_ONLY" })
          .where(eq(assets.id, asset.id));
        modifiedCount++;
      } else {
        // If not synced to Google Drive at all, delete record
        await db.delete(assets).where(eq(assets.id, asset.id));
        modifiedCount++;
      }
    }

    revalidatePath("/drive");
    revalidatePath("/inventory");
    revalidatePath("/");

    return { success: true, modifiedCount };
  } catch (error: any) {
    console.error("[deleteLocalCopiesAction Error]:", error);
    throw new Error(error.message || "Failed to delete local copies");
  }
}

export async function createDriveAssetAction(data: {
  title: string;
  type: "pdf" | "image" | "video";
  urlOrPath: string;
  thumbnailUrl?: string;
  tags?: string;
  sizeBytes?: number;
  syncStatus?: string;
  gdriveId?: string;
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("File title is required");
  }
  if (!data.urlOrPath || data.urlOrPath.trim() === "") {
    throw new Error("File path is required");
  }

  const [inserted] = await db.insert(assets).values({
    title: data.title.trim(),
    type: data.type || "pdf",
    urlOrPath: data.urlOrPath.trim(),
    thumbnailUrl: data.thumbnailUrl?.trim() || null,
    tags: data.tags?.trim() || "",
    sizeBytes: data.sizeBytes || null,
    syncStatus: data.syncStatus || "LOCAL_UNSYNCED",
    gdriveId: data.gdriveId || null,
  });

  revalidatePath("/drive");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true, id: (inserted as any)?.insertId };
}

export async function updateDriveAssetAction(
  id: number,
  data: {
    title?: string;
    type?: "pdf" | "image" | "video";
    urlOrPath?: string;
    thumbnailUrl?: string;
    tags?: string;
  }
) {
  const updatePayload: any = {};
  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.urlOrPath !== undefined) updatePayload.urlOrPath = data.urlOrPath.trim();
  if (data.thumbnailUrl !== undefined) updatePayload.thumbnailUrl = data.thumbnailUrl.trim();
  if (data.tags !== undefined) updatePayload.tags = data.tags.trim();

  await db.update(assets).set(updatePayload).where(eq(assets.id, id));

  revalidatePath("/drive");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
}

export async function deleteDriveAssetAction(id: number) {
  try {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));

    if (asset && asset.urlOrPath && asset.urlOrPath.startsWith("/uploads/")) {
      const relativePath = asset.urlOrPath.replace(/^\//, "");
      const fullFilePath = path.join(process.cwd(), "public", relativePath);

      if (fs.existsSync(fullFilePath)) {
        try {
          fs.unlinkSync(fullFilePath);
        } catch (unlinkError) {
          console.error("Error unlinking file from disk:", unlinkError);
        }
      }
    }

    await db.delete(assets).where(eq(assets.id, id));

    revalidatePath("/drive");
    revalidatePath("/inventory");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete drive asset:", error);
    throw new Error("Failed to delete drive asset");
  }
}

/**
 * Permanently deletes selected assets from:
 * 1. Physical Local Disk (/public/uploads)
 * 2. Remote Google Drive (via Google Drive API)
 * 3. MySQL Database (`assets` table)
 */
export async function deleteFromDriveAndDbAction(
  assetIds: number[]
): Promise<{ success: boolean; deletedCount: number; errors?: string[] }> {
  try {
    if (!assetIds || assetIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const targetAssets = await db
      .select()
      .from(assets)
      .where(inArray(assets.id, assetIds));

    const refreshToken = await getGoogleRefreshToken();
    let driveClient: any = null;
    if (refreshToken) {
      try {
        driveClient = await getDriveClient();
      } catch (clientErr) {
        console.warn("Could not init Google Drive client for file deletion:", clientErr);
      }
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const asset of targetAssets) {
      // 1. Physically delete file from /public/uploads if present
      if (asset.urlOrPath && asset.urlOrPath.startsWith("/uploads/")) {
        const relativePath = asset.urlOrPath.replace(/^\//, "");
        const fullFilePath = path.join(process.cwd(), "public", relativePath);

        if (fs.existsSync(fullFilePath)) {
          try {
            fs.unlinkSync(fullFilePath);
            console.log(`[DeleteEverywhere] Unlinked local file: ${fullFilePath}`);
          } catch (unlinkErr: any) {
            console.error(`Failed to unlink local file ${fullFilePath}:`, unlinkErr);
          }
        }
      }

      // 2. If backed up in Google Drive, delete file from Google Drive API
      if (asset.gdriveId && driveClient) {
        try {
          await driveClient.files.delete({
            fileId: asset.gdriveId,
          });
          console.log(`[DeleteEverywhere] Deleted Google Drive file ID: ${asset.gdriveId}`);
        } catch (driveErr: any) {
          // Ignore 404 Not Found (already deleted directly from Google Drive)
          if (driveErr.code !== 404 && driveErr.status !== 404) {
            console.error(`Error deleting Google Drive file ${asset.gdriveId}:`, driveErr);
            errors.push(`Google Drive error for "${asset.title}": ${driveErr.message || "Unknown error"}`);
          }
        }
      }

      // 3. Delete record from MySQL assets table
      await db.delete(assets).where(eq(assets.id, asset.id));
      deletedCount++;
    }

    revalidatePath("/drive");
    revalidatePath("/inventory");
    revalidatePath("/");

    return {
      success: true,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("[deleteFromDriveAndDbAction Error]:", error);
    throw new Error(error.message || "Failed to delete files from Drive and Database");
  }
}
