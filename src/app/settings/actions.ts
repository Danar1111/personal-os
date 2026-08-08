"use server";

import { db } from "@/db";
import { systemSettings, aiSkills, SystemSetting, AISkill } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  try {
    const records = await db.select().from(systemSettings);
    const settingsMap: Record<string, string> = {};

    for (const item of records) {
      settingsMap[item.key] = item.value;
    }

    // Set defaults if missing
    if (!settingsMap["active_model"]) {
      settingsMap["active_model"] = "gpt-4o-mini";
    }
    if (!settingsMap["system_prompt"]) {
      settingsMap["system_prompt"] =
        "You are the Personal OS AI Core, an intelligent autonomous system assistant embedded inside the user's Personal OS dashboard. You assist with productivity, task management, second brain notes, finance tracking, time blocking, and local files. Execute tools proactively when requested.";
    }

    return settingsMap;
  } catch (error) {
    console.error("Failed to fetch system settings:", error);
    return {
      active_model: "gpt-4o-mini",
      system_prompt:
        "You are the Personal OS AI Core, an intelligent autonomous system assistant embedded inside the user's Personal OS dashboard. You assist with productivity, task management, second brain notes, finance tracking, time blocking, and local files. Execute tools proactively when requested.",
    };
  }
}

export async function saveSettingAction(key: string, value: string) {
  if (!key || key.trim() === "") throw new Error("Setting key is required");

  const cleanKey = key.trim();
  const cleanVal = value ? value.trim() : "";

  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, cleanKey));

  if (existing) {
    await db
      .update(systemSettings)
      .set({ value: cleanVal, updatedAt: new Date() })
      .where(eq(systemSettings.key, cleanKey));
  } else {
    await db.insert(systemSettings).values({
      key: cleanKey,
      value: cleanVal,
    });
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

export async function saveMultipleSettingsAction(settingsMap: Record<string, string>) {
  try {
    for (const [key, value] of Object.entries(settingsMap)) {
      const cleanKey = key.trim();
      const cleanVal = value ? value.trim() : "";

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, cleanKey));

      if (existing) {
        await db
          .update(systemSettings)
          .set({ value: cleanVal, updatedAt: new Date() })
          .where(eq(systemSettings.key, cleanKey));
      } else {
        await db.insert(systemSettings).values({
          key: cleanKey,
          value: cleanVal,
        });
      }
    }

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, message: "Settings saved successfully!" };
  } catch (error: any) {
    console.error("[saveMultipleSettingsAction error]:", error);
    return { success: false, message: error.message || "Failed to save settings" };
  }
}

export async function getAISkills() {
  try {
    const skillsList = await db.select().from(aiSkills).orderBy(desc(aiSkills.createdAt));
    return skillsList;
  } catch (error) {
    console.error("Failed to fetch AI skills:", error);
    return [];
  }
}

export async function createAISkillAction(data: {
  name: string;
  module: string;
  description: string;
}) {
  if (!data.name || data.name.trim() === "") throw new Error("Skill name is required");
  if (!data.module || data.module.trim() === "") throw new Error("Skill module is required");
  if (!data.description || data.description.trim() === "") throw new Error("Skill description is required");

  await db.insert(aiSkills).values({
    name: data.name.trim().toLowerCase().replace(/\s+/g, "_"),
    module: data.module.trim(),
    description: data.description.trim(),
    isEnabled: true,
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAISkillAction(id: number) {
  await db.delete(aiSkills).where(eq(aiSkills.id, id));

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultAISkills() {
  await db.insert(aiSkills).values([
    {
      name: "create_task",
      module: "Task Omni-Kanban",
      description: "Creates a new task record in local MySQL database with title and priority.",
      isEnabled: true,
    },
    {
      name: "list_tasks",
      module: "Task Omni-Kanban",
      description: "Lists tasks in Kanban filtered by status or priority.",
      isEnabled: true,
    },
    {
      name: "create_calendar_event",
      module: "Master Calendar",
      description: "Schedules a start/end event in the master calendar database.",
      isEnabled: true,
    },
    {
      name: "log_expense",
      module: "Finance Hub",
      description: "Logs income or expense transactions to local financial ledger.",
      isEnabled: true,
    },
    {
      name: "search_vault",
      module: "Second Brain Vault",
      description: "Performs full-text search across Zettelkasten Markdown notes.",
      isEnabled: true,
    },
    {
      name: "search_assets",
      module: "Asset Vault",
      description: "Searches bookmarks, web links, and resources in Asset Vault by title or keyword.",
      isEnabled: true,
    },
    {
      name: "list_assets",
      module: "Asset Vault",
      description: "Lists all saved bookmarks, web links, and media resources in Asset Vault.",
      isEnabled: true,
    },
    {
      name: "list_skills",
      module: "Skill Matrix",
      description: "Lists all skills currently tracked or being learned in Skill Matrix.",
      isEnabled: true,
    },
    {
      name: "search_skills",
      module: "Skill Matrix",
      description: "Searches skills in Skill Matrix by title, name, or category.",
      isEnabled: true,
    },
    {
      name: "list_applications",
      module: "App Launcher",
      description: "Lists all registered web apps and local services in App Launcher.",
      isEnabled: true,
    },
  ]);
}
