"use server";

import { db } from "@/db";
import { assets, Asset } from "@/db/schema";
import { ne, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

export async function getDriveAssets() {
  try {
    let driveAssets = await db
      .select()
      .from(assets)
      .where(ne(assets.type, "link"))
      .orderBy(desc(assets.createdAt));

    // Migrate any legacy internet-sourced sample items to type = 'link' so they appear in Asset Vault
    let needsReFetch = false;
    for (const item of driveAssets) {
      if (
        item.title.includes("Drizzle ORM") ||
        item.title.includes("Synthetic Intelligence") ||
        item.title.includes("Vercel AI SDK") ||
        item.urlOrPath.startsWith("http://") ||
        item.urlOrPath.startsWith("https://")
      ) {
        needsReFetch = true;
        let originalUrl = item.urlOrPath;
        if (item.title.includes("Drizzle")) {
          originalUrl = "https://orm.drizzle.team/docs/overview";
        } else if (item.title.includes("Synthetic")) {
          originalUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80";
        } else if (item.title.includes("Vercel")) {
          originalUrl = "https://sdk.vercel.ai/docs";
        }

        await db
          .update(assets)
          .set({
            type: "link",
            urlOrPath: originalUrl,
          })
          .where(eq(assets.id, item.id));
      }
    }

    if (needsReFetch) {
      driveAssets = await db
        .select()
        .from(assets)
        .where(ne(assets.type, "link"))
        .orderBy(desc(assets.createdAt));
    }

    return driveAssets;
  } catch (error) {
    console.error("Failed to fetch drive assets:", error);
    return [];
  }
}

export async function createDriveAssetAction(data: {
  title: string;
  type: "pdf" | "image" | "video";
  urlOrPath: string;
  thumbnailUrl?: string;
  tags?: string;
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("File title is required");
  }
  if (!data.urlOrPath || data.urlOrPath.trim() === "") {
    throw new Error("File path is required");
  }

  await db.insert(assets).values({
    title: data.title.trim(),
    type: data.type || "pdf",
    urlOrPath: data.urlOrPath.trim(),
    thumbnailUrl: data.thumbnailUrl?.trim() || null,
    tags: data.tags?.trim() || "",
  });

  revalidatePath("/drive");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
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
    // Fetch asset record first to physically delete file from disk if it exists
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));

    if (asset && asset.urlOrPath && asset.urlOrPath.startsWith("/uploads/")) {
      const relativePath = asset.urlOrPath.replace(/^\//, "");
      const fullFilePath = path.join(process.cwd(), "public", relativePath);

      if (fs.existsSync(fullFilePath)) {
        try {
          fs.unlinkSync(fullFilePath);
          console.log(`Physically unlinked disk file: ${fullFilePath}`);
        } catch (unlinkError) {
          console.error("Error unlinking file from disk:", unlinkError);
        }
      }
    }

    // Delete record from database
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
