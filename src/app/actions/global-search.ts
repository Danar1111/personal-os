"use server";

import { db } from "@/db";
import { notes, tasks, skills, transactions, assets, calendarEvents, folders, applications } from "@/db/schema";
import { like, or } from "drizzle-orm";

export interface GlobalSearchResult {
  id: string | number;
  type: "page" | "note" | "task" | "skill" | "finance" | "asset" | "drive" | "calendar" | "folder" | "app";
  group: string;
  title: string;
  subtitle?: string;
  url: string;
}

export async function globalSearchAction(query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;

  try {
    const [
      notesRes,
      tasksRes,
      skillsRes,
      txRes,
      assetsRes,
      calRes,
      foldersRes,
      appsRes
    ] = await Promise.all([
      db.select().from(notes).where(or(like(notes.title, pattern), like(notes.tags, pattern), like(notes.content, pattern))).limit(8),
      db.select().from(tasks).where(or(like(tasks.title, pattern), like(tasks.description, pattern))).limit(8),
      db.select().from(skills).where(or(like(skills.title, pattern), like(skills.description, pattern))).limit(5),
      db.select().from(transactions).where(or(like(transactions.category, pattern), like(transactions.description, pattern))).limit(5),
      db.select().from(assets).where(or(like(assets.title, pattern), like(assets.tags, pattern))).limit(5),
      db.select().from(calendarEvents).where(like(calendarEvents.title, pattern)).limit(5),
      db.select().from(folders).where(like(folders.name, pattern)).limit(5),
      db.select().from(applications).where(or(like(applications.name, pattern), like(applications.category, pattern), like(applications.url, pattern))).limit(8),
    ]);

    const results: GlobalSearchResult[] = [];

    notesRes.forEach((n) => {
      results.push({
        id: `note-${n.id}`,
        type: "note",
        group: "Second Brain Vault",
        title: n.title,
        subtitle: n.category ? `Category: ${n.category}` : "Vault Note",
        url: `/vault?noteId=${n.id}`,
      });
    });

    tasksRes.forEach((t) => {
      results.push({
        id: `task-${t.id}`,
        type: "task",
        group: "Task Omni-Kanban",
        title: t.title,
        subtitle: `Status: ${t.status} • Priority: ${t.priority}`,
        url: `/tasks?search=${encodeURIComponent(t.title)}`,
      });
    });

    skillsRes.forEach((s) => {
      results.push({
        id: `skill-${s.id}`,
        type: "skill",
        group: "Skill Matrix",
        title: s.title,
        subtitle: `Proficiency: ${s.proficiency} • Category: ${s.category}`,
        url: `/skills?search=${encodeURIComponent(s.title)}`,
      });
    });

    txRes.forEach((tx) => {
      results.push({
        id: `tx-${tx.id}`,
        type: "finance",
        group: "Finance Hub",
        title: `${tx.type === "expense" ? "-" : "+"}$${tx.amount} (${tx.category})`,
        subtitle: tx.description || "Transaction",
        url: `/finance?search=${encodeURIComponent(tx.description || tx.category)}`,
      });
    });

    assetsRes.forEach((a) => {
      const isDriveFile =
        a.type !== "link" || a.urlOrPath.startsWith("/uploads") || a.urlOrPath.toLowerCase().includes("drive");

      if (isDriveFile) {
        results.push({
          id: `drive-${a.id}`,
          type: "drive",
          group: "Local Drive",
          title: a.title,
          subtitle: `Type: ${a.type} ${a.tags ? "• #" + a.tags : ""}`,
          url: `/drive?search=${encodeURIComponent(a.title)}`,
        });
      } else {
        results.push({
          id: `asset-${a.id}`,
          type: "asset",
          group: "Asset Vault",
          title: a.title,
          subtitle: `Type: ${a.type} ${a.tags ? "• #" + a.tags : ""}`,
          url: `/inventory?search=${encodeURIComponent(a.title)}`,
        });
      }
    });

    calRes.forEach((c) => {
      const dateStr = c.startTime ? new Date(c.startTime).toISOString().split("T")[0] : "";
      results.push({
        id: `cal-${c.id}`,
        type: "calendar",
        group: "Master Calendar",
        title: c.title,
        subtitle: `Event (${c.eventType})`,
        url: `/calendar?date=${encodeURIComponent(dateStr)}&search=${encodeURIComponent(c.title)}`,
      });
    });

    foldersRes.forEach((f) => {
      results.push({
        id: `folder-${f.id}`,
        type: "folder",
        group: "Vault Folders",
        title: f.name,
        subtitle: "Folder",
        url: `/vault?search=${encodeURIComponent(f.name)}`,
      });
    });

    appsRes.forEach((app) => {
      results.push({
        id: `app-${app.id}`,
        type: "app",
        group: "App Launcher",
        title: app.name,
        subtitle: `Category: ${app.category} • ${app.url}`,
        url: app.url.startsWith("http") || app.url.startsWith("/") ? app.url : `https://${app.url}`,
      });
    });

    return results;
  } catch (err) {
    console.error("Global search error:", err);
    return [];
  }
}
