"use server";

import { db } from "@/db";
import { skills, skillMilestones, assets, notes, Skill, SkillMilestone, Asset, Note } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getSkillsWithMilestones() {
  try {
    let allSkills = await db.select().from(skills).orderBy(desc(skills.createdAt));
    let allMilestones = await db.select().from(skillMilestones);
    const allAssets = await db.select().from(assets).orderBy(desc(assets.createdAt));
    const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt));

    // Seed default sample skills & milestones if database is empty
    if (allSkills.length === 0) {
      await seedDefaultSkillsData();
      allSkills = await db.select().from(skills).orderBy(desc(skills.createdAt));
      allMilestones = await db.select().from(skillMilestones);
    }

    return {
      skills: allSkills,
      milestones: allMilestones,
      assets: allAssets,
      notes: allNotes,
    };
  } catch (error) {
    console.error("Failed to fetch skills:", error);
    return {
      skills: [],
      milestones: [],
      assets: [],
      notes: [],
    };
  }
}

export async function createSkillAction(data: {
  title: string;
  description?: string;
  category: "hard_skill" | "creative" | "language" | "soft_skill";
  proficiency?: "beginner" | "intermediate" | "advanced" | "mastery";
  status?: "learning" | "paused" | "completed";
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Skill title is required");
  }

  await db.insert(skills).values({
    title: data.title.trim(),
    description: data.description?.trim() || null,
    category: data.category || "hard_skill",
    proficiency: data.proficiency || "beginner",
    status: data.status || "learning",
  });

  revalidatePath("/skills");
  revalidatePath("/");
  return { success: true };
}

export async function updateSkillAction(
  id: number,
  data: {
    title?: string;
    description?: string;
    category?: "hard_skill" | "creative" | "language" | "soft_skill";
    proficiency?: "beginner" | "intermediate" | "advanced" | "mastery";
    status?: "learning" | "paused" | "completed";
  }
) {
  await db.update(skills).set(data).where(eq(skills.id, id));

  revalidatePath("/skills");
  revalidatePath("/");
  return { success: true };
}

export async function deleteSkillAction(id: number) {
  // Delete all milestones associated with this skill
  await db.delete(skillMilestones).where(eq(skillMilestones.skillId, id));
  // Delete the skill
  await db.delete(skills).where(eq(skills.id, id));

  revalidatePath("/skills");
  revalidatePath("/");
  return { success: true };
}

export async function createMilestoneAction(skillId: number, description: string) {
  if (!description || description.trim() === "") {
    throw new Error("Milestone description is required");
  }

  await db.insert(skillMilestones).values({
    skillId,
    description: description.trim(),
    isCompleted: false,
  });

  revalidatePath("/skills");
  revalidatePath("/");
  return { success: true };
}

export async function toggleMilestoneAction(id: number, isCompleted: boolean) {
  await db
    .update(skillMilestones)
    .set({ isCompleted })
    .where(eq(skillMilestones.id, id));

  revalidatePath("/skills");
  revalidatePath("/");
  return { success: true };
}

export async function deleteMilestoneAction(id: number) {
  await db.delete(skillMilestones).where(eq(skillMilestones.id, id));

  revalidatePath("/skills");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultSkillsData() {
  await db.insert(skills).values([
    {
      title: "Next.js App Router Architecture",
      description: "Master full stack App Router patterns, Server Actions, and Turbopack.",
      category: "hard_skill",
      proficiency: "advanced",
      status: "learning",
    },
    {
      title: "Dark Mode Glassmorphism Design",
      description: "Designing translucent Obsidian dark mode interfaces with Tailwind CSS.",
      category: "creative",
      proficiency: "intermediate",
      status: "learning",
    },
    {
      title: "Japanese Conversational (JLPT N3)",
      description: "Daily audio shadowing and Kanji vocabulary memorization.",
      category: "language",
      proficiency: "beginner",
      status: "learning",
    },
    {
      title: "Systemic Problem Solving & Architecture",
      description: "Deconstructing complex enterprise software systems into resilient components.",
      category: "soft_skill",
      proficiency: "mastery",
      status: "completed",
    },
  ]);

  const createdSkills = await db.select().from(skills);
  const s1 = createdSkills.find((s) => s.category === "hard_skill")?.id;
  const s2 = createdSkills.find((s) => s.category === "creative")?.id;
  const s3 = createdSkills.find((s) => s.category === "language")?.id;

  if (s1) {
    await db.insert(skillMilestones).values([
      { skillId: s1, description: "Master Server Actions & Revalidation", isCompleted: true },
      { skillId: s1, description: "Integrate Drizzle ORM Relational Schemas", isCompleted: true },
      { skillId: s1, description: "Implement Drag & Drop Omni-Kanban", isCompleted: true },
      { skillId: s1, description: "Deploy Vercel AI SDK Streaming Routes", isCompleted: false },
    ]);
  }

  if (s2) {
    await db.insert(skillMilestones).values([
      { skillId: s2, description: "Construct Bento Grid Layout Systems", isCompleted: true },
      { skillId: s2, description: "Design Obsidian Translucent Glass Panels", isCompleted: true },
      { skillId: s2, description: "Implement Micro-Interactions & Hover FX", isCompleted: false },
    ]);
  }

  if (s3) {
    await db.insert(skillMilestones).values([
      { skillId: s3, description: "Master Hiragana & Katakana Syllabary", isCompleted: true },
      { skillId: s3, description: "Memorize 300 Core N5/N4 Kanji Characters", isCompleted: true },
      { skillId: s3, description: "Practice 15-min Daily Audio Shadowing", isCompleted: false },
    ]);
  }
}
