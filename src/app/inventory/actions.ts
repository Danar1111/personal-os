"use server";

import { db } from "@/db";
import { assets, Asset } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAssets() {
  try {
    let bookmarkAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.type, "link"))
      .orderBy(desc(assets.createdAt));

    return bookmarkAssets;
  } catch (error) {
    console.error("Failed to fetch bookmark assets:", error);
    return [];
  }
}

function extractYouTubeThumbnail(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    let videoId: string | null = null;

    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.slice(1);
    } else if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
    }

    if (videoId) {
      videoId = videoId.split("?")[0].split("&")[0];
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } catch {}
  return null;
}

async function scrapeOpenGraphImage(urlStr: string): Promise<string | null> {
  try {
    const ytThumb = extractYouTubeThumbnail(urlStr);
    if (ytThumb) return ytThumb;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const html = await res.text();

    const ogMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

    if (ogMatch && ogMatch[1]) {
      let ogUrl = ogMatch[1].trim();
      if (ogUrl.startsWith("//")) {
        ogUrl = "https:" + ogUrl;
      } else if (ogUrl.startsWith("/")) {
        const parsed = new URL(urlStr);
        ogUrl = `${parsed.protocol}//${parsed.host}${ogUrl}`;
      }
      return ogUrl;
    }
  } catch (e) {
    console.warn("OpenGraph fetch skipped for:", urlStr);
  }
  return null;
}

export async function createAssetAction(data: {
  title: string;
  urlOrPath: string;
  thumbnailUrl?: string;
  tags?: string;
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Asset title is required");
  }
  if (!data.urlOrPath || data.urlOrPath.trim() === "") {
    throw new Error("Asset URL is required");
  }

  const cleanUrl = data.urlOrPath.trim();
  let finalThumbnail = data.thumbnailUrl?.trim() || null;

  if (!finalThumbnail) {
    const scraped = await scrapeOpenGraphImage(cleanUrl);
    if (scraped) {
      finalThumbnail = scraped;
    }
  }

  await db.insert(assets).values({
    title: data.title.trim(),
    type: "link",
    urlOrPath: cleanUrl,
    thumbnailUrl: finalThumbnail,
    tags: data.tags?.trim() || "",
  });

  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
}

export async function updateAssetAction(
  id: number,
  data: {
    title?: string;
    type?: "link" | "pdf" | "image" | "video";
    urlOrPath?: string;
    thumbnailUrl?: string;
    tags?: string;
  }
) {
  const updatePayload: any = {};
  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.urlOrPath !== undefined) {
    updatePayload.urlOrPath = data.urlOrPath.trim();
    if (!data.thumbnailUrl) {
      const scraped = await scrapeOpenGraphImage(updatePayload.urlOrPath);
      if (scraped) {
        updatePayload.thumbnailUrl = scraped;
      }
    }
  }
  if (data.thumbnailUrl !== undefined) updatePayload.thumbnailUrl = data.thumbnailUrl.trim();
  if (data.tags !== undefined) updatePayload.tags = data.tags.trim();

  await db.update(assets).set(updatePayload).where(eq(assets.id, id));

  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAssetAction(id: number) {
  await db.delete(assets).where(eq(assets.id, id));

  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultBookmarksData() {
  await db.insert(assets).values([
    {
      title: "Next.js 16 Documentation & App Router Spec",
      type: "link",
      urlOrPath: "https://nextjs.org/docs",
      thumbnailUrl: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&auto=format&fit=crop&q=80",
      tags: "nextjs, framework, docs",
    },
    {
      title: "Drizzle ORM Official MySQL Documentation",
      type: "link",
      urlOrPath: "https://orm.drizzle.team/docs/overview",
      thumbnailUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
      tags: "drizzle, database, mysql",
    },
    {
      title: "Vercel AI SDK Core Concepts Walkthrough",
      type: "link",
      urlOrPath: "https://sdk.vercel.ai/docs",
      thumbnailUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80",
      tags: "ai, agents, vercel-sdk",
    },
  ]);
}
