"use server";

import { db } from "@/db";
import { notes, folders, assets, Note, Folder, Asset } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getVaultData() {
  try {
    let allFolders = await db.select().from(folders).orderBy(desc(folders.createdAt));
    let allNotes = await db.select().from(notes).orderBy(desc(notes.updatedAt));
    let allAssets = await db.select().from(assets).orderBy(desc(assets.createdAt));

    return {
      notes: allNotes,
      folders: allFolders,
      assets: allAssets,
    };
  } catch (error) {
    console.error("Failed to fetch vault data:", error);
    return {
      notes: [],
      folders: [],
      assets: [],
    };
  }
}

export async function createFolderAction(name: string, parentId?: number | null) {
  if (!name || name.trim() === "") {
    throw new Error("Folder name is required");
  }

  await db.insert(folders).values({
    name: name.trim(),
    parentId: parentId || null,
  });

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true };
}

export async function renameFolderAction(id: number, name: string) {
  if (!name || name.trim() === "") {
    throw new Error("Folder name is required");
  }

  await db.update(folders).set({ name: name.trim() }).where(eq(folders.id, id));

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true };
}

export async function moveFolderAction(id: number, newParentId: number | null) {
  if (newParentId === id) {
    throw new Error("A folder cannot be moved into itself");
  }

  await db.update(folders).set({ parentId: newParentId || null }).where(eq(folders.id, id));

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true };
}

export async function deleteFolderAction(id: number) {
  await db.delete(folders).where(eq(folders.id, id));

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true };
}

export async function createNoteAction(data: {
  title: string;
  content: string;
  category?: "snippet" | "idea" | "architecture" | "journal";
  tags?: string;
  folderId?: number | null;
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Note title is required");
  }

  const [inserted] = await db.insert(notes).values({
    title: data.title.trim(),
    content: data.content || "",
    category: data.category || "idea",
    tags: data.tags?.trim() || "",
    folderId: data.folderId || null,
  });

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true, insertId: inserted.insertId };
}

export async function updateNoteAction(
  id: number,
  data: {
    title?: string;
    content?: string;
    category?: "snippet" | "idea" | "architecture" | "journal";
    tags?: string;
    folderId?: number | null;
  }
) {
  const updatePayload: any = { updatedAt: new Date() };
  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.content !== undefined) updatePayload.content = data.content;
  if (data.category !== undefined) updatePayload.category = data.category;
  if (data.tags !== undefined) updatePayload.tags = data.tags.trim();
  if (data.folderId !== undefined) updatePayload.folderId = data.folderId;

  await db.update(notes).set(updatePayload).where(eq(notes.id, id));

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true };
}

export async function deleteNoteAction(id: number) {
  await db.delete(notes).where(eq(notes.id, id));

  revalidatePath("/vault");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultVaultData() {
  await db.insert(folders).values([
    { name: "Architecture & Specs" },
    { name: "Code Snippets" },
    { name: "Ideas & Strategy" },
  ]);

  const createdFolders = await db.select().from(folders);
  const f1 = createdFolders.find((f) => f.name === "Architecture & Specs")?.id || null;
  const f2 = createdFolders.find((f) => f.name === "Code Snippets")?.id || null;
  const f3 = createdFolders.find((f) => f.name === "Ideas & Strategy")?.id || null;

  await db.insert(notes).values([
    {
      title: "Personal OS Architecture Specification",
      category: "architecture",
      tags: "architecture, nextjs, drizzle, mysql",
      folderId: f1,
      content: `# Personal OS Architecture Specification

## Core System Modules
1. **Unified Control Center**: Hub & Spoke Bento Box Dashboard.
2. **Omni-Kanban**: Data-first task management with drag and drop capabilities.
3. **Finance Control Center**: Monthly cashflow tracking and expense metrics.
4. **Universal Skill Learner**: Growth Matrix with syllabus milestone tracking.
5. **Second Brain Vault**: Zettelkasten knowledge base with wiki-links like [[Drizzle ORM Helper Snippets]].

## Tech Stack Rules
- **Framework**: Next.js 16 (App Router with Turbopack)
- **Styles**: Tailwind CSS v4 + Synthetic Intelligence Glassmorphism
- **Database**: Drizzle ORM + MySQL 8.0 (Laragon Local)
- **Reference**: Cross-link to [[Autonomous Agent System Prompt Ideas]] for AI agent integration.`,
    },
    {
      title: "Drizzle ORM Helper Snippets",
      category: "snippet",
      tags: "code, drizzle, typescript, mysql",
      folderId: f2,
      content: `### Drizzle Schema Definition

\`\`\`typescript
import { mysqlTable, int, varchar, text, timestamp } from 'drizzle-orm/mysql-core';

export const notes = mysqlTable('notes', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 50 }).notNull().default('idea'),
  tags: varchar('tags', { length: 255 }).notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
\`\`\`

See also [[Personal OS Architecture Specification]] for system overview.`,
    },
    {
      title: "Autonomous Agent System Prompt Ideas",
      category: "idea",
      tags: "ai, agents, system-prompt",
      folderId: f3,
      content: `### Agent Persona Specification

> You are **Personal OS AI Core**, an ultra-responsive executive agent operating within a glassmorphic command cockpit.

#### Key Principles:
- Maintain data integrity across MySQL tables.
- Synthesize actionable insights for daily briefings.
- Refer to [[Drizzle ORM Helper Snippets]] for schema queries.`,
    },
  ]);
}
