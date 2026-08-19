"use server";

import { db, poolConnection } from "@/db";
import { tasks, projects, assets, notes, Task, Project, Asset, Note } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getTasksWithProjects() {
  try {
    // Ensure position and due_date columns exist in MySQL tasks table
    try {
      await poolConnection.query("ALTER TABLE tasks ADD COLUMN position INT DEFAULT 0");
    } catch {
      // Column already exists or already updated
    }
    try {
      await poolConnection.query("ALTER TABLE tasks ADD COLUMN due_date TIMESTAMP NULL");
    } catch {
      // Column already exists or already updated
    }

    const allTasks = await db.select().from(tasks).orderBy(asc(tasks.position), desc(tasks.createdAt));
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const allAssets = await db.select().from(assets).orderBy(desc(assets.createdAt));
    const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt));
    
    return { tasks: allTasks, projects: allProjects, assets: allAssets, notes: allNotes };
  } catch (error) {
    console.error("Failed to fetch tasks/projects:", error);
    return { tasks: [], projects: [], assets: [], notes: [] };
  }
}

export async function reorderTasksAction(
  orderedItems: { id: number; status: "todo" | "in_progress" | "done"; position: number }[]
) {
  if (!orderedItems || orderedItems.length === 0) return { success: true };

  try {
    const ids = orderedItems.map((item) => item.id);

    let statusCases = "CASE id ";
    let positionCases = "CASE id ";

    orderedItems.forEach((item) => {
      statusCases += `WHEN ${item.id} THEN ${poolConnection.escape(item.status)} `;
      positionCases += `WHEN ${item.id} THEN ${item.position} `;
    });

    statusCases += "END";
    positionCases += "END";

    const query = `
      UPDATE tasks 
      SET 
        status = ${statusCases},
        position = ${positionCases}
      WHERE id IN (${ids.join(",")})
    `;

    await poolConnection.query(query);
  } catch (error) {
    console.error("Failed to reorder tasks in DB:", error);
    return { success: false };
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function createTaskAction(data: {
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: number | null;
  dueDate?: Date | string | null;
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Task title is required");
  }

  let finalDueDate: Date | null = null;
  if (data.dueDate) {
    const d = new Date(data.dueDate);
    if (!isNaN(d.getTime())) finalDueDate = d;
  }

  await db.insert(tasks).values({
    title: data.title.trim(),
    description: data.description?.trim() || null,
    status: data.status || "todo",
    priority: data.priority || "medium",
    projectId: data.projectId || null,
    position: 0,
    dueDate: finalDueDate,
  });

  revalidatePath("/tasks");
  revalidatePath("/calendar");
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
  revalidatePath("/calendar");
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
    dueDate?: Date | string | null;
  }
) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Task title is required");
  }

  let finalDueDate: Date | null = null;
  if (data.dueDate) {
    const d = new Date(data.dueDate);
    if (!isNaN(d.getTime())) finalDueDate = d;
  }

  await db
    .update(tasks)
    .set({
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      projectId: data.projectId || null,
      dueDate: finalDueDate,
    })
    .where(eq(tasks.id, taskId));

  revalidatePath("/tasks");
  revalidatePath("/calendar");
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

export async function renameProjectAction(projectId: number, name: string) {
  if (!name || name.trim() === "") {
    throw new Error("Project name is required");
  }

  await db
    .update(projects)
    .set({ name: name.trim() })
    .where(eq(projects.id, projectId));

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
