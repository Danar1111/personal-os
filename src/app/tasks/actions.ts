"use server";

import { db } from "@/db";
import { tasks, projects, assets, notes, Task, Project, Asset, Note } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getTasksWithProjects() {
  try {
    const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const allAssets = await db.select().from(assets).orderBy(desc(assets.createdAt));
    const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt));
    
    // Seed initial projects and tasks if database is empty
    if (allProjects.length === 0 && allTasks.length === 0) {
      await seedDefaultData();
      const freshTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      const freshProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
      return { tasks: freshTasks, projects: freshProjects, assets: allAssets, notes: allNotes };
    }

    return { tasks: allTasks, projects: allProjects, assets: allAssets, notes: allNotes };
  } catch (error) {
    console.error("Failed to fetch tasks/projects:", error);
    return { tasks: [], projects: [], assets: [], notes: [] };
  }
}

export async function createTaskAction(data: {
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: number | null;
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Task title is required");
  }

  await db.insert(tasks).values({
    title: data.title.trim(),
    description: data.description?.trim() || null,
    status: data.status || "todo",
    priority: data.priority || "medium",
    projectId: data.projectId || null,
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

export async function updateTaskStatusAction(
  taskId: number,
  newStatus: "todo" | "in_progress" | "done"
) {
  await db
    .update(tasks)
    .set({ status: newStatus })
    .where(eq(tasks.id, taskId));

  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

export async function updateTaskFullAction(
  taskId: number,
  data: {
    title: string;
    description?: string;
    status?: "todo" | "in_progress" | "done";
    priority?: "low" | "medium" | "high";
    projectId?: number | null;
  }
) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Task title is required");
  }

  await db
    .update(tasks)
    .set({
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      projectId: data.projectId || null,
    })
    .where(eq(tasks.id, taskId));

  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

export async function deleteTaskAction(taskId: number) {
  await db.delete(tasks).where(eq(tasks.id, taskId));

  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

export async function createProjectAction(name: string) {
  if (!name || name.trim() === "") {
    throw new Error("Project name is required");
  }

  await db.insert(projects).values({
    name: name.trim(),
    status: "active",
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

export async function deleteProjectAction(projectId: number) {
  // Delete all tasks associated with this project first
  await db.delete(tasks).where(eq(tasks.projectId, projectId));
  // Delete the project
  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultData() {
  // Insert default projects
  await db.insert(projects).values([
    { name: "Personal OS Core", status: "active" },
    { name: "AI Assistant Engine", status: "active" },
    { name: "Finance Hub", status: "active" },
  ]);

  const existingProjects = await db.select().from(projects);
  const p1 = existingProjects.find((p) => p.name === "Personal OS Core")?.id || null;
  const p2 = existingProjects.find((p) => p.name === "AI Assistant Engine")?.id || null;

  // Insert default tasks
  await db.insert(tasks).values([
    {
      title: "Set up Laragon MySQL & Drizzle Schema",
      description: "Configure Drizzle ORM connected to local Laragon MySQL with relations.",
      status: "done",
      priority: "high",
      projectId: p1,
    },
    {
      title: "Build Responsive Omni-Kanban UI",
      description: "Construct glassmorphic Kanban board with full CRUD server actions.",
      status: "in_progress",
      priority: "high",
      projectId: p1,
    },
    {
      title: "Integrate Vercel AI SDK Briefings",
      description: "Connect OpenAI / Gemini models to generate autonomous daily summaries.",
      status: "todo",
      priority: "medium",
      projectId: p2,
    },
    {
      title: "Design Finance Analytics Dashboard",
      description: "Implement interactive expenditure charts and budget allocation cards.",
      status: "todo",
      priority: "low",
      projectId: p1,
    },
  ]);
}
