"use server";

import { db } from "@/db";
import {
  dailyRoutineMaster,
  dailyTimeblockInstances,
  dailyHabits,
  dailyHabitLogs,
  tasks,
  projects,
  skills,
  DailyTimeblockInstance,
  NewDailyTimeblockInstance,
  DailyRoutineMaster,
  NewDailyRoutineMaster,
} from "@/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type DayProfileType = "WEEKDAY" | "FRIDAY" | "WEEKEND";

/** Helper to convert "HH:MM" to minutes from midnight */
function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

/** Helper to shift date by N days (YYYY-MM-DD) */
function getShiftedDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Internal helper to determine Day Profile from a date string (YYYY-MM-DD) */
function getDayProfileForDate(dateStr: string): DayProfileType {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  if (day === 5) return "FRIDAY";
  if (day === 0 || day === 6) return "WEEKEND";
  return "WEEKDAY";
}

export async function getDayProfileForDateAction(dateStr: string): Promise<DayProfileType> {
  return getDayProfileForDate(dateStr);
}

/**
 * Fetch timeblocks for a date.
 * Automatically handles seamless cross-day carryover from yesterday's overnight tasks!
 * If no instances exist yet for that date, AUTOMATICALLY generates them from dailyRoutineMaster.
 */
export async function getRoutineForDateAction(dateStr: string) {
  try {
    let dayBlocks: any[] = [];
    let isAuto = false;
    const dayProfile = getDayProfileForDate(dateStr);

    // Fetch master routines for this dayProfile
    const masterRoutines = await db
      .select()
      .from(dailyRoutineMaster)
      .where(eq(dailyRoutineMaster.dayProfile, dayProfile))
      .orderBy(asc(dailyRoutineMaster.startTime));

    // 1. Check existing instances for this date
    const existing = await db
      .select({
        id: dailyTimeblockInstances.id,
        date: dailyTimeblockInstances.date,
        startTime: dailyTimeblockInstances.startTime,
        endTime: dailyTimeblockInstances.endTime,
        title: dailyTimeblockInstances.title,
        category: dailyTimeblockInstances.category,
        status: dailyTimeblockInstances.status,
        taskId: dailyTimeblockInstances.taskId,
        notes: dailyTimeblockInstances.notes,
        orderIndex: dailyTimeblockInstances.orderIndex,
        createdAt: dailyTimeblockInstances.createdAt,
        taskTitle: tasks.title,
        projectName: projects.name,
      })
      .from(dailyTimeblockInstances)
      .leftJoin(tasks, eq(dailyTimeblockInstances.taskId, tasks.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(dailyTimeblockInstances.date, dateStr))
      .orderBy(asc(dailyTimeblockInstances.startTime));

    if (existing.length > 0) {
      dayBlocks = existing;
    } else {
      // 2. If none exist for this date, automatically instantiate from dailyRoutineMaster
      if (masterRoutines.length > 0) {
        const inserts = masterRoutines.map((m) => ({
          date: dateStr,
          startTime: m.startTime,
          endTime: m.endTime,
          title: m.title,
          category: m.category,
          status: "PLANNED",
          orderIndex: m.orderIndex,
        }));

        for (const item of inserts) {
          await db.insert(dailyTimeblockInstances).values(item);
        }

        // Re-fetch with joins
        dayBlocks = await db
          .select({
            id: dailyTimeblockInstances.id,
            date: dailyTimeblockInstances.date,
            startTime: dailyTimeblockInstances.startTime,
            endTime: dailyTimeblockInstances.endTime,
            title: dailyTimeblockInstances.title,
            category: dailyTimeblockInstances.category,
            status: dailyTimeblockInstances.status,
            taskId: dailyTimeblockInstances.taskId,
            notes: dailyTimeblockInstances.notes,
            orderIndex: dailyTimeblockInstances.orderIndex,
            createdAt: dailyTimeblockInstances.createdAt,
            taskTitle: tasks.title,
            projectName: projects.name,
          })
          .from(dailyTimeblockInstances)
          .leftJoin(tasks, eq(dailyTimeblockInstances.taskId, tasks.id))
          .leftJoin(projects, eq(tasks.projectId, projects.id))
          .where(eq(dailyTimeblockInstances.date, dateStr))
          .orderBy(asc(dailyTimeblockInstances.startTime));

        isAuto = true;
      }
    }

    // 3. Query Yesterday (dateStr - 1 day) for overnight tasks crossing into today!
    const yesterdayStr = getShiftedDate(dateStr, -1);
    const yesterdayInstances = await db
      .select({
        id: dailyTimeblockInstances.id,
        date: dailyTimeblockInstances.date,
        startTime: dailyTimeblockInstances.startTime,
        endTime: dailyTimeblockInstances.endTime,
        title: dailyTimeblockInstances.title,
        category: dailyTimeblockInstances.category,
        status: dailyTimeblockInstances.status,
        taskId: dailyTimeblockInstances.taskId,
        notes: dailyTimeblockInstances.notes,
        orderIndex: dailyTimeblockInstances.orderIndex,
        createdAt: dailyTimeblockInstances.createdAt,
        taskTitle: tasks.title,
        projectName: projects.name,
      })
      .from(dailyTimeblockInstances)
      .leftJoin(tasks, eq(dailyTimeblockInstances.taskId, tasks.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(dailyTimeblockInstances.date, yesterdayStr));

    const carryOvers: any[] = [];

    if (yesterdayInstances.length > 0) {
      yesterdayInstances.forEach((yTask) => {
        const s = timeToMinutes(yTask.startTime);
        const e = timeToMinutes(yTask.endTime);
        if (s > e && e > 0) {
          carryOvers.push({
            ...yTask,
            date: dateStr,
            startTime: "00:00",
            endTime: yTask.endTime,
            isCarryOverFromYesterday: true,
            originalStartTime: yTask.startTime,
            originalDate: yesterdayStr,
          });
        }
      });
    } else {
      // If yesterday has no saved instances, check yesterday's master routine profile
      const yesterdayProfile = getDayProfileForDate(yesterdayStr);
      const yesterdayMasters = await db
        .select()
        .from(dailyRoutineMaster)
        .where(eq(dailyRoutineMaster.dayProfile, yesterdayProfile));

      yesterdayMasters.forEach((m) => {
        const s = timeToMinutes(m.startTime);
        const e = timeToMinutes(m.endTime);
        if (s > e && e > 0) {
          carryOvers.push({
            id: -m.id,
            date: dateStr,
            startTime: "00:00",
            endTime: m.endTime,
            title: m.title,
            category: m.category,
            status: "PLANNED",
            taskId: null,
            notes: null,
            orderIndex: -1,
            createdAt: new Date(),
            taskTitle: null,
            projectName: null,
            isCarryOverFromYesterday: true,
            originalStartTime: m.startTime,
            originalDate: yesterdayStr,
          });
        }
      });
    }

    // Tag each block as custom or master
    const remainingMaster = [...masterRoutines];
    const taggedDayBlocks = dayBlocks.map((block) => {
      const matchIdx = remainingMaster.findIndex(
        (m) =>
          m.startTime === block.startTime &&
          m.endTime === block.endTime &&
          m.title.trim().toLowerCase() === block.title.trim().toLowerCase() &&
          m.category === block.category &&
          !block.taskId &&
          (!block.notes || block.notes.trim() === "")
      );
      if (matchIdx !== -1) {
        remainingMaster.splice(matchIdx, 1);
        return { ...block, isCustom: false };
      }
      return { ...block, isCustom: true };
    });

    // Carryovers belong to yesterday, so they are not custom to today
    const taggedCarryOvers = carryOvers.map((c) => ({ ...c, isCustom: false }));

    // Combine carryovers at 00:00 with today's blocks
    const combinedBlocks = [...taggedCarryOvers, ...taggedDayBlocks].sort((a, b) => {
      const diff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (diff !== 0) return diff;
      return a.isCarryOverFromYesterday ? -1 : 1;
    });

    return {
      success: true,
      date: dateStr,
      dayProfile,
      timeblocks: combinedBlocks,
      masterRoutines,
      isAutoGenerated: isAuto,
    };
  } catch (error: any) {
    console.error("[getRoutineForDateAction Error]:", error);
    return { success: false, error: error.message, timeblocks: [] };
  }
}

/**
 * Check if an overnight task (e.g. 23:00 - 00:30) collides with tomorrow's schedule (00:00 - endTime)
 * Checks both tomorrow's custom instances and tomorrow's master template profile!
 */
export async function checkNextDayTimeConflictAction(
  dateStr: string,
  startTime: string,
  endTime: string,
  currentId?: number | null
) {
  try {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);

    // Only applies if task crosses midnight (e <= s) and e > 0
    if (e > s || e === 0) {
      return { hasConflict: false, conflictingSlot: null };
    }

    const tomorrowStr = getShiftedDate(dateStr, 1);
    const tomorrowDayProfile = getDayProfileForDate(tomorrowStr);

    // 1. Fetch tomorrow's actual instances
    const tomorrowInstances = await db
      .select({
        id: dailyTimeblockInstances.id,
        startTime: dailyTimeblockInstances.startTime,
        endTime: dailyTimeblockInstances.endTime,
        title: dailyTimeblockInstances.title,
      })
      .from(dailyTimeblockInstances)
      .where(eq(dailyTimeblockInstances.date, tomorrowStr));

    const slotsToCheck =
      tomorrowInstances.length > 0
        ? tomorrowInstances
        : (
            await db
              .select({
                id: dailyRoutineMaster.id,
                startTime: dailyRoutineMaster.startTime,
                endTime: dailyRoutineMaster.endTime,
                title: dailyRoutineMaster.title,
              })
              .from(dailyRoutineMaster)
              .where(eq(dailyRoutineMaster.dayProfile, tomorrowDayProfile))
          );

    // Carryover interval on tomorrow: [0, e] (00:00 to endTime)
    for (const slot of slotsToCheck) {
      if (currentId && slot.id === currentId) continue;
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);

      const segStart = slotStart;
      const segEnd = slotEnd < slotStart ? 1440 : slotEnd;

      if (Math.max(0, segStart) < Math.min(e, segEnd)) {
        return {
          hasConflict: true,
          conflictingSlot: slot,
          tomorrowDate: tomorrowStr,
          message: `Overlaps on tomorrow (${tomorrowStr}) with "${slot.title}" (${slot.startTime} - ${slot.endTime}).`,
        };
      }
    }

    return { hasConflict: false, conflictingSlot: null };
  } catch (error: any) {
    console.error("[checkNextDayTimeConflictAction Error]:", error);
    return { hasConflict: false, error: error.message };
  }
}

/**
 * Check if a master routine slot collides within its profile or across into the next day profile (if overnight)
 */
export async function checkMasterTemplateConflictAction(
  dayProfile: DayProfileType,
  startTime: string,
  endTime: string,
  currentId?: number | null
) {
  try {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);

    if (s === e) {
      return {
        hasConflict: true,
        conflictingSlot: null,
        message: "Start time and End time cannot be identical (duration is 0 minutes).",
      };
    }

    const isOvernight = e <= s && e > 0;

    // 1. Check current profile collisions
    const currentMasters = await db
      .select({
        id: dailyRoutineMaster.id,
        startTime: dailyRoutineMaster.startTime,
        endTime: dailyRoutineMaster.endTime,
        title: dailyRoutineMaster.title,
        dayProfile: dailyRoutineMaster.dayProfile,
      })
      .from(dailyRoutineMaster)
      .where(eq(dailyRoutineMaster.dayProfile, dayProfile));

    // For current day segment:
    // If overnight, this slot occupies [s, 1440] on this day.
    const curSeg = isOvernight ? { start: s, end: 1440 } : { start: s, end: e };

    for (const slot of currentMasters) {
      if (currentId && slot.id === currentId) continue;
      const slotS = timeToMinutes(slot.startTime);
      const slotE = timeToMinutes(slot.endTime);
      if (slotS === slotE) continue;
      const otherSeg = slotE <= slotS ? { start: slotS, end: 1440 } : { start: slotS, end: slotE };

      if (Math.max(curSeg.start, otherSeg.start) < Math.min(curSeg.end, otherSeg.end)) {
        return {
          hasConflict: true,
          conflictingSlot: slot,
          message: `Time conflict: Overlaps with "${slot.title}" (${slot.startTime} - ${slot.endTime}) in ${dayProfile} protocol.`,
        };
      }
    }

    // 2. If overnight, check next-day profiles for collision with [0, e]
    if (isOvernight) {
      const nextProfiles: DayProfileType[] =
        dayProfile === "WEEKDAY"
          ? ["WEEKDAY", "FRIDAY"]
          : dayProfile === "FRIDAY"
          ? ["WEEKEND"]
          : ["WEEKEND", "WEEKDAY"];

      // Check each possible next-day master routine profile
      for (const nextProf of nextProfiles) {
        const nextMasters = await db
          .select({
            id: dailyRoutineMaster.id,
            startTime: dailyRoutineMaster.startTime,
            endTime: dailyRoutineMaster.endTime,
            title: dailyRoutineMaster.title,
            dayProfile: dailyRoutineMaster.dayProfile,
          })
          .from(dailyRoutineMaster)
          .where(eq(dailyRoutineMaster.dayProfile, nextProf));

        for (const slot of nextMasters) {
          if (currentId && slot.id === currentId) continue;
          const slotS = timeToMinutes(slot.startTime);
          const slotE = timeToMinutes(slot.endTime);
          const segStart = slotS;
          const segEnd = slotE <= slotS ? 1440 : slotE;

          if (Math.max(0, segStart) < Math.min(e, segEnd)) {
            return {
              hasConflict: true,
              conflictingSlot: slot,
              message: `Overnight carryover (00:00 - ${endTime}) collides with "${slot.title}" (${slot.startTime} - ${slot.endTime}) in next day's (${nextProf}) master protocol.`,
            };
          }
        }
      }
    }

    return { hasConflict: false, conflictingSlot: null };
  } catch (error: any) {
    console.error("[checkMasterTemplateConflictAction Error]:", error);
    return { hasConflict: false, error: error.message };
  }
}

/** Update an existing timeblock instance */
export async function updateTimeblockAction(
  id: number,
  data: Partial<NewDailyTimeblockInstance>
) {
  try {
    await db
      .update(dailyTimeblockInstances)
      .set(data)
      .where(eq(dailyTimeblockInstances.id, id));

    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    console.error("[updateTimeblockAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/** Create a new custom timeblock instance */
export async function createTimeblockAction(data: NewDailyTimeblockInstance) {
  try {
    const [result] = await db.insert(dailyTimeblockInstances).values(data);
    revalidatePath("/routine");
    return { success: true, id: (result as any)?.insertId };
  } catch (error: any) {
    console.error("[createTimeblockAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/** Delete a timeblock instance */
export async function deleteTimeblockAction(id: number) {
  try {
    await db.delete(dailyTimeblockInstances).where(eq(dailyTimeblockInstances.id, id));
    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteTimeblockAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/** Reset day to master routine */
export async function resetDayToMasterRoutineAction(dateStr: string) {
  try {
    await db
      .delete(dailyTimeblockInstances)
      .where(eq(dailyTimeblockInstances.date, dateStr));

    const dayProfile = getDayProfileForDate(dateStr);
    const masterRoutines = await db
      .select()
      .from(dailyRoutineMaster)
      .where(eq(dailyRoutineMaster.dayProfile, dayProfile))
      .orderBy(asc(dailyRoutineMaster.startTime));

    for (const m of masterRoutines) {
      await db.insert(dailyTimeblockInstances).values({
        date: dateStr,
        startTime: m.startTime,
        endTime: m.endTime,
        title: m.title,
        category: m.category,
        status: "PLANNED",
        orderIndex: m.orderIndex,
      });
    }

    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    console.error("[resetDayToMasterRoutineAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/** Get Habits and today's log status */
export async function getDailyHabitsForDateAction(dateStr: string) {
  try {
    const habits = await db
      .select({
        id: dailyHabits.id,
        title: dailyHabits.title,
        icon: dailyHabits.icon,
        sortOrder: dailyHabits.sortOrder,
        isActive: dailyHabits.isActive,
      })
      .from(dailyHabits)
      .where(eq(dailyHabits.isActive, true))
      .orderBy(asc(dailyHabits.sortOrder));

    const logs = await db
      .select()
      .from(dailyHabitLogs)
      .where(eq(dailyHabitLogs.date, dateStr));

    const enriched = habits.map((h) => {
      const log = logs.find((l) => l.habitId === h.id);
      return {
        ...h,
        isCompleted: !!log?.isCompleted,
      };
    });

    return { success: true, habits: enriched };
  } catch (error: any) {
    console.error("[getDailyHabitsForDateAction Error]:", error);
    return { success: false, error: error.message, habits: [] };
  }
}

/** Toggle a daily habit */
export async function toggleDailyHabitAction(
  habitId: number,
  dateStr: string,
  isCompleted: boolean
) {
  try {
    const existing = await db
      .select()
      .from(dailyHabitLogs)
      .where(
        and(
          eq(dailyHabitLogs.habitId, habitId),
          eq(dailyHabitLogs.date, dateStr)
        )
      );

    if (existing.length > 0) {
      await db
        .update(dailyHabitLogs)
        .set({
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        })
        .where(eq(dailyHabitLogs.id, existing[0].id));
    } else {
      await db.insert(dailyHabitLogs).values({
        habitId,
        date: dateStr,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      });
    }

    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    console.error("[toggleDailyHabitAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/** Quick add a daily habit */
export async function addDailyHabitAction(title: string) {
  try {
    await db.insert(dailyHabits).values({
      title: title.trim(),
      icon: "CheckCircle2",
      sortOrder: 99,
      isActive: true,
    });
    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    console.error("[addDailyHabitAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/** Fetch active tasks from Omni-Kanban to attach */
export async function getActiveKanbanTasksAction() {
  try {
    const activeTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        status: tasks.status,
        projectId: tasks.projectId,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(sql`${tasks.status} != 'done'`)
      .orderBy(desc(tasks.id))
      .limit(30);

    return { success: true, tasks: activeTasks };
  } catch (error: any) {
    console.error("[getActiveKanbanTasksAction Error]:", error);
    return { success: false, error: error.message, tasks: [] };
  }
}

/** Fetch suggestions for Activity Title (Projects from ProjectHub & Skills from Skill Matrix) */
export async function getActivitySuggestionsAction() {
  try {
    const activeProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      })
      .from(projects)
      .where(sql`${projects.status} != 'completed' AND ${projects.status} != 'archived'`)
      .orderBy(asc(projects.name))
      .limit(20);

    const activeSkills = await db
      .select({
        id: skills.id,
        title: skills.title,
        category: skills.category,
        proficiency: skills.proficiency,
      })
      .from(skills)
      .where(sql`${skills.status} != 'archived'`)
      .orderBy(asc(skills.title))
      .limit(20);

    return {
      success: true,
      projects: activeProjects,
      skills: activeSkills,
    };
  } catch (error: any) {
    console.error("[getActivitySuggestionsAction Error]:", error);
    return { success: false, projects: [], skills: [] };
  }
}


/** Fetch master routines for management modal */
export async function getMasterRoutinesAction(profile: DayProfileType) {
  try {
    const list = await db
      .select()
      .from(dailyRoutineMaster)
      .where(eq(dailyRoutineMaster.dayProfile, profile))
      .orderBy(asc(dailyRoutineMaster.startTime));
    return { success: true, routines: list };
  } catch (error: any) {
    return { success: false, error: error.message, routines: [] };
  }
}

/** Save/Update master routine */
export async function saveMasterRoutineAction(
  id: number | null,
  data: Partial<NewDailyRoutineMaster>
) {
  try {
    if (id) {
      await db
        .update(dailyRoutineMaster)
        .set(data)
        .where(eq(dailyRoutineMaster.id, id));
    } else {
      await db.insert(dailyRoutineMaster).values(data as NewDailyRoutineMaster);
    }
    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Delete master routine */
export async function deleteMasterRoutineAction(id: number) {
  try {
    await db.delete(dailyRoutineMaster).where(eq(dailyRoutineMaster.id, id));
    revalidatePath("/routine");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
