import { Project, ProjectPhase, Task } from "@/db/schema";

export type ProjectAutoStatus = "PLANNING" | "ACTIVE" | "PAUSED" | "OVERDUE" | "COMPLETED";

export interface ProjectStatusInfo {
  status: ProjectAutoStatus;
  label: string;
  badgeClass: string;
  reason: string;
}

/**
 * Calculates the dynamic real-time status of a project based on its phases, tasks, and deadlines.
 */
export function computeProjectAutoStatus(
  project: {
    startDate?: string | Date | null;
    targetDate?: string | Date | null;
    status?: string | null;
  },
  phases: Array<{
    id?: number;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    status?: string | null;
    progress?: number | null;
  }> = [],
  tasks: Array<{
    id?: number;
    status?: string | null;
    phaseId?: number | null;
  }> = []
): ProjectStatusInfo {
  const now = new Date();
  // Normalize today to start of day (midnight)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // 1. Task calculations
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const inProgTasks = tasks.filter((t) => t.status === "in_progress").length;
  const hasUnfinishedTasks = tasks.some((t) => t.status !== "done");

  // 2. Synchronize / Enrich Phase progress & status from scoped tasks
  const effectivePhases = phases.map((p) => {
    const pTasks = p.id ? tasks.filter((t) => t.phaseId === p.id) : [];
    let effectiveStatus = (p.status || "PLANNED").toUpperCase();
    let effectiveProgress = p.progress ?? 0;

    if (pTasks.length > 0) {
      const taskDoneCount = pTasks.filter((t) => t.status === "done").length;
      const taskInProgCount = pTasks.filter((t) => t.status === "in_progress").length;
      effectiveProgress = Math.round((taskDoneCount / pTasks.length) * 100);

      if (effectiveProgress === 100) {
        effectiveStatus = "DONE";
      } else if (effectiveProgress === 0 && taskInProgCount === 0) {
        if (effectiveStatus !== "BLOCKED") {
          effectiveStatus = "PLANNED";
        }
      } else {
        if (effectiveStatus !== "BLOCKED") {
          effectiveStatus = "IN_PROGRESS";
        }
      }
    }

    return {
      ...p,
      status: effectiveStatus,
      progress: effectiveProgress,
    };
  });

  const totalPhases = effectivePhases.length;
  const donePhases = effectivePhases.filter(
    (p) => (p.status || "").toUpperCase() === "DONE" || (p.progress ?? 0) >= 100
  ).length;
  const inProgPhases = effectivePhases.filter(
    (p) =>
      (p.status || "").toUpperCase() === "IN_PROGRESS" ||
      ((p.progress ?? 0) > 0 && (p.progress ?? 0) < 100)
  ).length;
  const blockedPhases = effectivePhases.filter(
    (p) => (p.status || "").toUpperCase() === "BLOCKED"
  ).length;

  const hasUnfinishedPhases = effectivePhases.some(
    (p) => (p.status || "PLANNED").toUpperCase() !== "DONE" && (p.progress ?? 0) < 100
  );

  // Parse Project Start & Target Date
  let projectStartDay: Date | null = null;
  if (project.startDate) {
    const sd = new Date(project.startDate);
    if (!isNaN(sd.getTime())) {
      projectStartDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, 0, 0, 0);
    }
  }

  let projectTargetDay: Date | null = null;
  if (project.targetDate) {
    const td = new Date(project.targetDate);
    if (!isNaN(td.getTime())) {
      projectTargetDay = new Date(td.getFullYear(), td.getMonth(), td.getDate(), 23, 59, 59, 999);
    }
  }

  // ── RULE 1: COMPLETED ───────────────────────────────────────────────────────
  // Condition: Must have at least 1 phase or task, AND ZERO unfinished phases AND ZERO unfinished tasks.
  const hasWorkItems = totalPhases > 0 || totalTasks > 0;
  const isAllWorkDone = hasWorkItems && !hasUnfinishedPhases && !hasUnfinishedTasks;

  if (isAllWorkDone) {
    return {
      status: "COMPLETED",
      label: "Completed",
      badgeClass: "bg-purple-500/20 text-purple-400 border-purple-500/40",
      reason: "All tasks and roadmap phases are 100% completed",
    };
  }

  // ── RULE 2: OVERDUE ────────────────────────────────────────────────────────
  // Condition: Work is unfinished, AND (project targetDate has passed OR any phase endDate has passed without completion).
  let hasOverduePhase = false;
  let overduePhaseDays = 0;

  for (const ph of effectivePhases) {
    const isPhaseDone = (ph.status || "").toUpperCase() === "DONE" || (ph.progress ?? 0) >= 100;
    if (!isPhaseDone && ph.endDate) {
      const ed = new Date(ph.endDate);
      if (!isNaN(ed.getTime())) {
        const phEndDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59, 999);
        if (today > phEndDay) {
          hasOverduePhase = true;
          const diff = Math.ceil((today.getTime() - phEndDay.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > overduePhaseDays) overduePhaseDays = diff;
        }
      }
    }
  }

  const isProjectTargetOverdue = Boolean(
    projectTargetDay && today > projectTargetDay && !isAllWorkDone
  );

  if ((isProjectTargetOverdue || hasOverduePhase) && !isAllWorkDone) {
    const diff = isProjectTargetOverdue && projectTargetDay
      ? Math.ceil((today.getTime() - projectTargetDay.getTime()) / (1000 * 60 * 60 * 24))
      : overduePhaseDays;

    return {
      status: "OVERDUE",
      label: "Overdue",
      badgeClass: "bg-rose-500/20 text-rose-400 border-rose-500/40",
      reason: isProjectTargetOverdue
        ? `Project target deadline exceeded by ${diff} day(s) with pending work`
        : `Phase deadline exceeded by ${diff} day(s) without completion`,
    };
  }

  // ── RULE 3: ACTIVE ─────────────────────────────────────────────────────────
  // Condition: Any phase is IN_PROGRESS, or tasks in progress, or today is inside an unfinished phase's timeline,
  // or an unfinished phase's scheduled startDate <= today (kickoff date reached), or project has begun.
  let isWithinActivePhaseTimeline = false;
  let hasUnfinishedPhaseScheduledStarted = false;

  for (const ph of effectivePhases) {
    const isPhaseDone = (ph.status || "").toUpperCase() === "DONE" || (ph.progress ?? 0) >= 100;
    if (!isPhaseDone) {
      let startDay: Date | null = null;
      let endDay: Date | null = null;

      if (ph.startDate) {
        const s = new Date(ph.startDate);
        if (!isNaN(s.getTime())) {
          startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
        }
      }
      if (ph.endDate) {
        const e = new Date(ph.endDate);
        if (!isNaN(e.getTime())) {
          endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
        }
      }

      if (startDay && endDay && today >= startDay && today <= endDay) {
        isWithinActivePhaseTimeline = true;
      }
      if (startDay && today >= startDay) {
        hasUnfinishedPhaseScheduledStarted = true;
      }
    }
  }

  const isProjectScheduledStarted = Boolean(
    projectStartDay && today >= projectStartDay && hasUnfinishedPhases
  );

  const isExplicitlyActive =
    inProgPhases > 0 ||
    inProgTasks > 0 ||
    isWithinActivePhaseTimeline ||
    hasUnfinishedPhaseScheduledStarted ||
    isProjectScheduledStarted;

  if (isExplicitlyActive) {
    return {
      status: "ACTIVE",
      label: "Active",
      badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      reason: inProgPhases > 0
        ? "Phases currently in progress"
        : inProgTasks > 0
        ? "Tasks currently in progress"
        : isWithinActivePhaseTimeline
        ? "Within scheduled phase timeline for today"
        : "Project kickoff date reached with pending phases",
    };
  }

  // ── RULE 4: PAUSED ─────────────────────────────────────────────────────────
  // Condition: Some work was completed in the past (e.g. donePhases > 0 or doneTasks > 0),
  // but today is outside any active phase schedule (intermission/gap), OR all remaining phases are BLOCKED.
  const hasStartedWork = donePhases > 0 || doneTasks > 0;
  const areAllRemainingPhasesBlocked =
    totalPhases > 0 &&
    blockedPhases > 0 &&
    donePhases + blockedPhases === totalPhases;

  if (hasStartedWork || areAllRemainingPhasesBlocked) {
    return {
      status: "PAUSED",
      label: "Paused",
      badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40",
      reason: areAllRemainingPhasesBlocked
        ? "All remaining phases are currently blocked"
        : "No active phase scheduled for today (gap between phases)",
    };
  }

  // ── RULE 5: PLANNING ───────────────────────────────────────────────────────
  // Fallback: All phases are in planning (0% done, start dates in future or unset)
  return {
    status: "PLANNING",
    label: "Planning",
    badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    reason: "All phases in planning stage, awaiting kickoff",
  };
}
