"use server";

import { db } from "@/db";
import { knowledgeVault, KnowledgeEntry } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  try {
    const entries = await db
      .select()
      .from(knowledgeVault)
      .orderBy(desc(knowledgeVault.createdAt));
    return entries;
  } catch (error) {
    console.error("[KNOWLEDGE_VAULT] Failed to fetch entries:", error);
    return [];
  }
}

export async function createKnowledgeEntry(data: {
  category: string;
  title: string;
  content: string;
  isSensitive: boolean;
}): Promise<{ success: boolean; message?: string; entry?: KnowledgeEntry }> {
  try {
    const title = data.title.trim();
    const content = data.content.trim();
    const category = data.category.trim() || "Preferences";
    const isSensitive = Boolean(data.isSensitive);

    if (!title) {
      return { success: false, message: "Title is required." };
    }
    if (!content) {
      return { success: false, message: "Content is required." };
    }

    const id = crypto.randomUUID();

    await db.insert(knowledgeVault).values({
      id,
      title,
      category,
      content,
      isSensitive,
    });

    revalidatePath("/knowledge");
    revalidatePath("/");

    return {
      success: true,
      message: `✓ Added "${title}" to Knowledge Vault.`,
    };
  } catch (error: any) {
    console.error("[KNOWLEDGE_VAULT] Failed to create entry:", error);
    return { success: false, message: error.message || "Failed to create entry." };
  }
}

export async function updateKnowledgeEntry(
  id: string,
  data: {
    category?: string;
    title?: string;
    content?: string;
    isSensitive?: boolean;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!id) return { success: false, message: "Entry ID is required." };

    const updatePayload: Partial<KnowledgeEntry> = {};

    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.category !== undefined) updatePayload.category = data.category.trim();
    if (data.content !== undefined) updatePayload.content = data.content.trim();
    if (data.isSensitive !== undefined) updatePayload.isSensitive = Boolean(data.isSensitive);

    await db
      .update(knowledgeVault)
      .set(updatePayload)
      .where(eq(knowledgeVault.id, id));

    revalidatePath("/knowledge");
    revalidatePath("/");

    return { success: true, message: "✓ Entry updated successfully." };
  } catch (error: any) {
    console.error("[KNOWLEDGE_VAULT] Failed to update entry:", error);
    return { success: false, message: error.message || "Failed to update entry." };
  }
}

export async function deleteKnowledgeEntry(
  id: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!id) return { success: false, message: "Entry ID is required." };

    await db.delete(knowledgeVault).where(eq(knowledgeVault.id, id));

    revalidatePath("/knowledge");
    revalidatePath("/");

    return { success: true, message: "🗑️ Entry deleted from Knowledge Vault." };
  } catch (error: any) {
    console.error("[KNOWLEDGE_VAULT] Failed to delete entry:", error);
    return { success: false, message: error.message || "Failed to delete entry." };
  }
}

export async function getUserNicknameAction(): Promise<string | null> {
  try {
    const entries = await db.select().from(knowledgeVault);
    const match = entries.find((e) => {
      const titleLower = e.title.trim().toLowerCase();
      return (
        titleLower === "nickname" ||
        titleLower === "nama panggilan" ||
        titleLower === "nama" ||
        titleLower === "name" ||
        titleLower.includes("nickname")
      );
    });

    if (match && match.content.trim()) {
      return match.content.trim();
    }
    return null;
  } catch (error) {
    console.error("[getUserNicknameAction] Error:", error);
    return null;
  }
}
