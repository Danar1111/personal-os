"use server";

import { db } from "@/db";
import {
  projects,
  projectPhases,
  tasks,
  assets,
  notes,
  Project,
  ProjectPhase,
  Task,
  Asset,
  Note,
} from "@/db/schema";
import { eq, desc, asc, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { getDriveClient, getGoogleRefreshToken } from "@/lib/google";
import { getSyncFolderSettingAction } from "@/app/drive/actions";
import { computeProjectAutoStatus } from "@/lib/project-status-engine";

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT STATUS SYNCHRONIZER
// ─────────────────────────────────────────────────────────────────────────────

export async function syncProjectAutoStatusInDb(projectId: number) {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return;

    const [pPhases, pTasks] = await Promise.all([
      db.select().from(projectPhases).where(eq(projectPhases.projectId, projectId)),
      db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    ]);

    // Sync phase status & progress from its tasks if tasks exist
    for (const ph of pPhases) {
      const phTasks = pTasks.filter((t) => t.phaseId === ph.id);
      if (phTasks.length > 0) {
        const doneCount = phTasks.filter((t) => t.status === "done").length;
        const inProgCount = phTasks.filter((t) => t.status === "in_progress").length;
        const prog = Math.round((doneCount / phTasks.length) * 100);
        let st = ph.status;
        if (prog === 100) st = "DONE";
        else if (prog === 0 && inProgCount === 0 && st !== "BLOCKED") st = "PLANNED";
        else if (st !== "BLOCKED") st = "IN_PROGRESS";

        if (st !== ph.status || prog !== ph.progress) {
          await db
            .update(projectPhases)
            .set({ status: st, progress: prog })
            .where(eq(projectPhases.id, ph.id));
          ph.status = st;
          ph.progress = prog;
        }
      }
    }

    const autoStatusInfo = computeProjectAutoStatus(project, pPhases, pTasks);

    if (project.status !== autoStatusInfo.status) {
      await db
        .update(projects)
        .set({ status: autoStatusInfo.status })
        .where(eq(projects.id, projectId));
    }
    return autoStatusInfo.status;
  } catch (err) {
    console.error("[syncProjectAutoStatusInDb]", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllProjectsAction() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.isHub, true))
      .orderBy(desc(projects.createdAt));

    const [allPhases, allTasks, allAssets] = await Promise.all([
      db.select().from(projectPhases),
      db.select().from(tasks),
      db.select().from(assets),
    ]);

    const updatesToSync: Promise<any>[] = [];

    const enrichedProjects = allProjects.map((p) => {
      const pPhases = allPhases.filter((ph) => ph.projectId === p.id);
      const pTasks = allTasks.filter((t) => t.projectId === p.id);
      const pDocs = allAssets.filter((a) => a.projectId === p.id && a.type !== "link");
      const pLinks = allAssets.filter((a) => a.projectId === p.id && a.type === "link");
      const doneTasks = pTasks.filter((t) => t.status === "done");

      let calculatedProgress = 0;
      if (pTasks.length > 0) {
        calculatedProgress = Math.round((doneTasks.length / pTasks.length) * 100);
      } else if (pPhases.length > 0) {
        const totalProgress = pPhases.reduce((acc, ph) => acc + (ph.progress || 0), 0);
        calculatedProgress = Math.round(totalProgress / pPhases.length);
      }

      const autoStatusInfo = computeProjectAutoStatus(p, pPhases, pTasks);

      if (p.status !== autoStatusInfo.status) {
        updatesToSync.push(
          db.update(projects).set({ status: autoStatusInfo.status }).where(eq(projects.id, p.id))
        );
      }

      // Resolve cloud / Google Drive cover & icon URLs if physical file is cloud-only
      let resolvedCover = p.coverUrl;
      if (p.coverUrl && !p.coverUrl.startsWith("http") && !p.coverUrl.startsWith("/api/drive/preview")) {
        const matchedAsset = allAssets.find((a) => a.urlOrPath === p.coverUrl);
        if (matchedAsset?.gdriveId) {
          resolvedCover = `/api/drive/preview/${matchedAsset.gdriveId}`;
        }
      }

      let resolvedIcon = p.icon;
      if (p.icon && !p.icon.startsWith("http") && !p.icon.startsWith("/api/drive/preview") && p.icon.startsWith("/uploads/")) {
        const matchedAsset = allAssets.find((a) => a.urlOrPath === p.icon);
        if (matchedAsset?.gdriveId) {
          resolvedIcon = `/api/drive/preview/${matchedAsset.gdriveId}`;
        }
      }

      return {
        ...p,
        coverUrl: resolvedCover,
        icon: resolvedIcon,
        status: autoStatusInfo.status,
        statusLabel: autoStatusInfo.label,
        statusReason: autoStatusInfo.reason,
        statusBadgeClass: autoStatusInfo.badgeClass,
        phaseCount: pPhases.length,
        taskCount: pTasks.length,
        doneTaskCount: doneTasks.length,
        docCount: pDocs.length,
        linkCount: pLinks.length,
        progress: calculatedProgress,
      };
    });

    const imageAssets = allAssets.filter(
      (a) =>
        a.type === "image" ||
        (a.thumbnailUrl && typeof a.thumbnailUrl === "string" && a.thumbnailUrl.trim().length > 0) ||
        (a.urlOrPath && (a.urlOrPath.includes("youtube.com") || a.urlOrPath.includes("youtu.be"))) ||
        (a.title && /\.(png|jpg|jpeg|webp|gif|svg|ico|bmp|avif)$/i.test(a.title)) ||
        (a.urlOrPath && /\.(png|jpg|jpeg|webp|gif|svg|ico|bmp|avif)$/i.test(a.urlOrPath))
    );

    return { success: true, projects: enrichedProjects, imageAssets };
  } catch (error) {
    console.error("[getAllProjectsAction]", error);
    return { success: false, projects: [], imageAssets: [], error: "Failed to fetch projects" };
  }
}

export async function getProjectDetailAction(id: number) {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const phases = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, id))
      .orderBy(asc(projectPhases.orderIndex), asc(projectPhases.startDate));

    const scopedTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, id))
      .orderBy(asc(tasks.position), desc(tasks.createdAt));

    const scopedAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.projectId, id))
      .orderBy(desc(assets.createdAt));

    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const allAssets = await db.select().from(assets).orderBy(desc(assets.createdAt));
    const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt));

    const autoStatusInfo = computeProjectAutoStatus(project, phases, scopedTasks);

    if (project.status !== autoStatusInfo.status) {
      await db
        .update(projects)
        .set({ status: autoStatusInfo.status })
        .where(eq(projects.id, id));
    }

    // Resolve cloud / Google Drive cover & icon URLs if physical file is cloud-only
    let resolvedCover = project.coverUrl;
    if (project.coverUrl && !project.coverUrl.startsWith("http") && !project.coverUrl.startsWith("/api/drive/preview")) {
      const matchedAsset = allAssets.find((a) => a.urlOrPath === project.coverUrl);
      if (matchedAsset?.gdriveId) {
        resolvedCover = `/api/drive/preview/${matchedAsset.gdriveId}`;
      }
    }

    let resolvedIcon = project.icon;
    if (project.icon && !project.icon.startsWith("http") && !project.icon.startsWith("/api/drive/preview") && project.icon.startsWith("/uploads/")) {
      const matchedAsset = allAssets.find((a) => a.urlOrPath === project.icon);
      if (matchedAsset?.gdriveId) {
        resolvedIcon = `/api/drive/preview/${matchedAsset.gdriveId}`;
      }
    }

    const enrichedProject = {
      ...project,
      coverUrl: resolvedCover,
      icon: resolvedIcon,
      status: autoStatusInfo.status,
      statusLabel: autoStatusInfo.label,
      statusReason: autoStatusInfo.reason,
      statusBadgeClass: autoStatusInfo.badgeClass,
    };

    return {
      success: true,
      project: enrichedProject,
      phases,
      tasks: scopedTasks,
      assets: scopedAssets,
      allProjects,
      allAssets,
      allNotes,
    };
  } catch (error) {
    console.error("[getProjectDetailAction]", error);
    return { success: false, error: "Failed to fetch project" };
  }
}

export async function createProjectHubAction(data: {
  name: string;
  description?: string;
  status?: string;
  startDate?: string;
  targetDate?: string;
  coverUrl?: string;
  icon?: string;
  isHub?: boolean;
}) {
  if (!data.name?.trim()) throw new Error("Project name is required");

  const [result] = await db.insert(projects).values({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    status: data.status || "PLANNING",
    startDate: data.startDate ? data.startDate : null,
    targetDate: data.targetDate ? data.targetDate : null,
    coverUrl: data.coverUrl?.trim() || null,
    icon: data.icon?.trim() || null,
    isHub: data.isHub ?? true,
  });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true, insertId: (result as any).insertId };
}

export async function updateProjectAction(
  id: number,
  data: {
    name?: string;
    description?: string;
    status?: string;
    startDate?: string | null;
    targetDate?: string | null;
    coverUrl?: string | null;
    icon?: string | null;
    isHub?: boolean;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startDate !== undefined)
    updateData.startDate = data.startDate ? data.startDate : null;
  if (data.targetDate !== undefined)
    updateData.targetDate = data.targetDate ? data.targetDate : null;
  if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl?.trim() || null;
  if (data.icon !== undefined) updateData.icon = data.icon?.trim() || null;
  if (data.isHub !== undefined) updateData.isHub = data.isHub;

  await db.update(projects).set(updateData as any).where(eq(projects.id, id));

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

export async function deleteProjectHubAction(id: number) {
  // Tasks with this projectId will be set null via FK (set null)
  await db.delete(projects).where(eq(projects.id, id));

  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT PHASES
// ─────────────────────────────────────────────────────────────────────────────

export async function createPhaseAction(data: {
  projectId: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  status?: string;
  orderIndex?: number;
  dependsOnPhaseId?: number | null;
  progress?: number;
}) {
  if (!data.title?.trim()) throw new Error("Phase title is required");

  // Get current max orderIndex
  const existing = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, data.projectId))
    .orderBy(desc(projectPhases.orderIndex))
    .limit(1);

  const nextOrder = existing.length > 0 ? (existing[0].orderIndex ?? 0) + 1 : 0;

  // Ensure dependsOnPhaseId is a valid safe 32-bit integer
  let safeDependsOnId: number | null = null;
  if (data.dependsOnPhaseId && Number.isInteger(data.dependsOnPhaseId) && data.dependsOnPhaseId > 0 && data.dependsOnPhaseId <= 2147483647) {
    // Verify referenced phase exists
    const [dep] = await db
      .select({ id: projectPhases.id })
      .from(projectPhases)
      .where(eq(projectPhases.id, data.dependsOnPhaseId))
      .limit(1);
    if (dep) {
      safeDependsOnId = dep.id;
    }
  }

  const [result] = await db.insert(projectPhases).values({
    projectId: data.projectId,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status || "PLANNED",
    orderIndex: data.orderIndex ?? nextOrder,
    dependsOnPhaseId: safeDependsOnId,
    progress: data.progress ?? 0,
  });

  await syncProjectAutoStatusInDb(data.projectId);

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
  return { success: true, insertId: Number((result as any).insertId) };
}

export async function updatePhaseAction(
  id: number,
  data: {
    title?: string;
    description?: string | null;
    startDate?: string;
    endDate?: string;
    status?: string;
    orderIndex?: number;
    dependsOnPhaseId?: number | null;
    progress?: number;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
  if (data.dependsOnPhaseId !== undefined) {
    let safeDepId: number | null = null;
    if (
      data.dependsOnPhaseId &&
      Number.isInteger(data.dependsOnPhaseId) &&
      data.dependsOnPhaseId > 0 &&
      data.dependsOnPhaseId <= 2147483647 &&
      data.dependsOnPhaseId !== id
    ) {
      const [dep] = await db
        .select({ id: projectPhases.id })
        .from(projectPhases)
        .where(eq(projectPhases.id, data.dependsOnPhaseId))
        .limit(1);
      if (dep) safeDepId = dep.id;
    }
    updateData.dependsOnPhaseId = safeDepId;
  }
  if (data.progress !== undefined) updateData.progress = data.progress;

  const [phase] = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.id, id))
    .limit(1);

  await db.update(projectPhases).set(updateData as any).where(eq(projectPhases.id, id));

  if (phase) {
    await syncProjectAutoStatusInDb(phase.projectId);
    revalidatePath(`/projects/${phase.projectId}`);
    revalidatePath("/projects");
    revalidatePath("/");
  }
  return { success: true };
}

export async function deletePhaseAction(id: number) {
  const [phase] = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.id, id))
    .limit(1);

  await db.delete(projectPhases).where(eq(projectPhases.id, id));

  if (phase) {
    await syncProjectAutoStatusInDb(phase.projectId);
    revalidatePath(`/projects/${phase.projectId}`);
    revalidatePath("/projects");
    revalidatePath("/");
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPED TASKS (reuse existing task actions but with projectId locked in)
// ─────────────────────────────────────────────────────────────────────────────

export async function createScopedTaskAction(data: {
  projectId: number;
  phaseId?: number | null;
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
}) {
  if (!data.title?.trim()) throw new Error("Task title is required");

  await db.insert(tasks).values({
    title: data.title.trim(),
    description: data.description?.trim() || null,
    status: data.status || "todo",
    priority: data.priority || "medium",
    projectId: data.projectId,
    phaseId: data.phaseId ?? null,
    position: 0,
  });

  await syncProjectAutoStatusInDb(data.projectId);

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT DOCUMENTS (assets with projectId)
// ─────────────────────────────────────────────────────────────────────────────

export async function createProjectAssetAction(data: {
  projectId: number;
  phaseId?: number | null;
  title: string;
  type: string;
  urlOrPath: string;
  sizeBytes?: number;
  docVersion?: string;
  docStatus?: string;
}) {
  await db.insert(assets).values({
    title: data.title,
    type: data.type as any,
    urlOrPath: data.urlOrPath,
    tags: "",
    syncStatus: "LOCAL_UNSYNCED",
    sizeBytes: data.sizeBytes ?? null,
    projectId: data.projectId,
    phaseId: data.phaseId ?? null,
    docVersion: data.docVersion || "v1.0",
    docStatus: data.docStatus || "DRAFT",
  });

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/drive");
  return { success: true };
}

export async function updateProjectAssetAction(
  assetId: number,
  data: {
    docVersion?: string;
    docStatus?: string;
    title?: string;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.docVersion !== undefined) updateData.docVersion = data.docVersion;
  if (data.docStatus !== undefined) updateData.docStatus = data.docStatus;
  if (data.title !== undefined) updateData.title = data.title;

  await db.update(assets).set(updateData as any).where(eq(assets.id, assetId));

  revalidatePath("/projects");
  revalidatePath("/drive");
  return { success: true };
}

export async function deleteProjectAssetAction(assetId: number, projectId: number) {
  await db.delete(assets).where(eq(assets.id, assetId));
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/drive");
  return { success: true };
}

export async function uploadProjectMediaAction(formData: FormData): Promise<{
  success: boolean;
  url?: string;
  gdriveId?: string | null;
  assetId?: number;
  error?: string;
}> {
  try {
    const file = formData.get("file") as File | null;
    const mediaType = (formData.get("mediaType") as string) || "cover"; // 'cover' | 'icon'
    const projectIdRaw = formData.get("projectId");
    const projectId = projectIdRaw ? Number(projectIdRaw) : null;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitizedName = (file.name || `media-${Date.now()}.png`).replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitizedName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${uniqueFileName}`;

    // Upload to Google Drive if connected
    let gdriveId: string | null = null;
    let syncStatus = "LOCAL_UNSYNCED";

    try {
      const refreshToken = await getGoogleRefreshToken();
      if (refreshToken) {
        const driveClient = await getDriveClient();
        const syncFolder = await getSyncFolderSettingAction();
        const parents = syncFolder.folderId && syncFolder.folderId !== "root" ? [syncFolder.folderId] : undefined;

        const stream = fs.createReadStream(filePath);
        const driveRes = await driveClient.files.create({
          requestBody: {
            name: file.name || uniqueFileName,
            mimeType: file.type || "image/png",
            parents,
          },
          media: {
            mimeType: file.type || "image/png",
            body: stream,
          },
          fields: "id, name, webViewLink, thumbnailLink",
        });

        if (driveRes.data?.id) {
          gdriveId = driveRes.data.id;
          syncStatus = "SYNCED_LOCAL_KEPT";
        }
      }
    } catch (driveErr) {
      console.warn("[uploadProjectMediaAction] Google Drive sync skipped/failed:", driveErr);
    }

    // Register asset in assets database table
    const [inserted] = await db.insert(assets).values({
      title: file.name || uniqueFileName,
      type: "image",
      urlOrPath: publicUrl,
      sizeBytes: buffer.length,
      syncStatus,
      gdriveId,
      projectId,
      tags: `project-${mediaType},upload`,
    });

    revalidatePath("/drive");
    revalidatePath("/inventory");
    revalidatePath("/projects");
    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }

    return {
      success: true,
      url: publicUrl,
      gdriveId,
      assetId: (inserted as any)?.insertId,
    };
  } catch (error: any) {
    console.error("[uploadProjectMediaAction]", error);
    return { success: false, error: error.message || "Failed to upload project media" };
  }
}
