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

export async function getActiveModelAction() {
  try {
    const settings = await getSettings();
    return settings["active_model"] || "gpt-4o-mini";
  } catch (error) {
    return "gpt-4o-mini";
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

import { OMNI_AI_SKILLS_REGISTRY } from "@/lib/ai-skills-registry";

export async function syncAiSkillsAction() {
  try {
    const existing = await db.select().from(aiSkills);
    const existingMap = new Map(existing.map((s) => [s.name, s]));

    const regNames = new Set(OMNI_AI_SKILLS_REGISTRY.map((s) => s.name));

    // Delete obsolete skills from DB that are no longer in registry
    for (const existingSkill of existing) {
      if (!regNames.has(existingSkill.name)) {
        await db.delete(aiSkills).where(eq(aiSkills.id, existingSkill.id));
      }
    }

    for (const regSkill of OMNI_AI_SKILLS_REGISTRY) {
      const match = existingMap.get(regSkill.name);
      const descWithPrompt = regSkill.examplePrompt
        ? `${regSkill.description}\n\n💡 Example: "${regSkill.examplePrompt}"`
        : regSkill.description;

      if (!match) {
        await db.insert(aiSkills).values({
          name: regSkill.name,
          module: regSkill.module,
          description: descWithPrompt,
          isEnabled: true,
        });
      } else if (match.module !== regSkill.module || match.description !== descWithPrompt) {
        await db
          .update(aiSkills)
          .set({
            module: regSkill.module,
            description: descWithPrompt,
          })
          .where(eq(aiSkills.id, match.id));
      }
    }

    return { success: true, count: OMNI_AI_SKILLS_REGISTRY.length };
  } catch (error: any) {
    console.error("[syncAiSkillsAction error]:", error);
    return { success: false, message: error.message };
  }
}

export async function forceSyncAiSkillsAction() {
  const result = await syncAiSkillsAction();
  revalidatePath("/settings");
  revalidatePath("/");
  return result;
}

export async function revokeSpotifyTokenAction() {
  try {
    await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, "SPOTIFY_REFRESH_TOKEN"));
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, message: "Spotify authorization revoked." };
  } catch (error: any) {
    console.error("[revokeSpotifyTokenAction error]:", error);
    return { success: false, message: error.message || "Failed to revoke token" };
  }
}

export async function revokeGoogleTokenAction() {
  try {
    await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, "GOOGLE_REFRESH_TOKEN"));
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, message: "Google Drive authorization revoked." };
  } catch (error: any) {
    console.error("[revokeGoogleTokenAction error]:", error);
    return { success: false, message: error.message || "Failed to revoke Google token" };
  }
}


export async function getAISkills() {

  try {
    await syncAiSkillsAction();
    const skillsList = await db.select().from(aiSkills).orderBy(desc(aiSkills.createdAt));
    return skillsList;
  } catch (error) {
    console.error("Failed to fetch AI skills:", error);
    return [];
  }
}
