import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calendarEvents, systemSettings, tasks, projects, projectPhases } from "@/db/schema";
import { getCalendarClient, getGoogleRefreshToken } from "@/lib/google";
import { UnifiedCalendarEvent } from "@/lib/calendar-utils";
import { gte, lte, and, or, asc, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatStatus(status?: string | null): string {
  if (!status) return "Planned";
  const s = status.toLowerCase().replace(/_/g, " ");
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Default start and end range (current month +/- 1 month if not specified)
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999).toISOString();

    const startParam = searchParams.get("start") || defaultStart;
    const endParam = searchParams.get("end") || defaultEnd;

    const startDate = new Date(startParam);
    const endDate = new Date(endParam);

    const unifiedEvents: UnifiedCalendarEvent[] = [];
    let gcalConnected = false;

    // 1. FETCH LOCAL DRIZZLE CALENDAR EVENTS
    try {
      const localRows = await db
        .select()
        .from(calendarEvents)
        .where(
          and(
            lte(calendarEvents.startTime, endDate),
            gte(calendarEvents.endTime, startDate)
          )
        )
        .orderBy(asc(calendarEvents.startTime));

      for (const row of localRows) {
        const rowStart = new Date(row.startTime);
        const rowEnd = new Date(row.endTime);
        const isAllDay =
          rowStart.getHours() === 0 &&
          rowStart.getMinutes() === 0 &&
          rowEnd.getHours() === 23 &&
          rowEnd.getMinutes() === 59;

        unifiedEvents.push({
          id: `local-${row.id}`,
          localId: row.id,
          title: row.title,
          start: row.startTime.toISOString(),
          end: row.endTime.toISOString(),
          source: "LOCAL",
          eventType: (row.eventType as "task" | "learning" | "general") || "general",
          isAllDay,
        });
      }
    } catch (localDbErr) {
      console.error("[CALENDAR_API_LOCAL_FETCH_ERROR]:", localDbErr);
    }

    // 2. FETCH GOOGLE CALENDAR EVENTS
    try {
      const refreshToken = await getGoogleRefreshToken();

      if (refreshToken) {
        gcalConnected = true;
        const calendar = await getCalendarClient(req);

        const gcalRes = await calendar.events.list({
          calendarId: "primary",
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 250,
        });

        const items = gcalRes.data.items || [];

        for (const item of items) {
          if (!item.id || !item.summary) continue;

          // Check if this is an all-day event
          const isAllDay = Boolean(item.start?.date && item.end?.date);

          let startIso: string;
          let endIso: string;

          if (isAllDay && item.start?.date && item.end?.date) {
            // All-day event: start.date is e.g. "2026-08-25"
            // GCAL END DATE FIX: Google Calendar returns exclusive end date (e.g. "2026-08-26" for a 1-day event on Aug 25)
            // We parse the exclusive end date and subtract 1 day to get the inclusive end date.
            const [sYear, sMonth, sDay] = item.start.date.split("-").map(Number);
            const [eYear, eMonth, eDay] = item.end.date.split("-").map(Number);

            const inclusiveStartDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
            const rawEndDate = new Date(eYear, eMonth - 1, eDay, 0, 0, 0, 0);

            // Subtract 1 day from the exclusive end date
            const inclusiveEndDate = new Date(rawEndDate);
            inclusiveEndDate.setDate(inclusiveEndDate.getDate() - 1);
            inclusiveEndDate.setHours(23, 59, 59, 999);

            // Fallback check in case start and end were identical
            if (inclusiveEndDate.getTime() < inclusiveStartDate.getTime()) {
              inclusiveEndDate.setTime(inclusiveStartDate.getTime());
              inclusiveEndDate.setHours(23, 59, 59, 999);
            }

            startIso = inclusiveStartDate.toISOString();
            endIso = inclusiveEndDate.toISOString();
          } else {
            // Timed event
            startIso = item.start?.dateTime || new Date().toISOString();
            endIso = item.end?.dateTime || startIso;
          }

          unifiedEvents.push({
            id: `gcal-${item.id}`,
            title: item.summary || "Untitled Google Event",
            description: item.description || null,
            start: startIso,
            end: endIso,
            source: "GCAL",
            isAllDay,
            htmlLink: item.htmlLink || undefined,
            location: item.location || undefined,
          });
        }
      }
    } catch (gcalErr: any) {
      console.warn("[CALENDAR_API_GCAL_FETCH_WARNING]:", gcalErr.message || gcalErr);
      // We do not fail the request if Google Calendar has permission or network issues;
      // Local events are still returned.
    }

    // 3. FETCH KANBAN TASKS WITH DUE DATE (DEADLINES)
    try {
      const taskRows = await db
        .select()
        .from(tasks)
        .where(
          and(
            isNotNull(tasks.dueDate),
            lte(tasks.dueDate, endDate),
            gte(tasks.dueDate, startDate)
          )
        )
        .orderBy(asc(tasks.dueDate));

      for (const t of taskRows) {
        if (!t.dueDate) continue;
        const d = new Date(t.dueDate);
        
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
        let startIso: string;
        let endIso: string;

        if (hasTime) {
          startIso = d.toISOString();
          const end = new Date(d.getTime() + 60 * 60 * 1000); // 1 hour block
          endIso = end.toISOString();
        } else {
          const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
          const endDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
          startIso = startDay.toISOString();
          endIso = endDay.toISOString();
        }

        unifiedEvents.push({
          id: `task-${t.id}`,
          taskId: t.id,
          title: t.title,
          description: t.description || null,
          start: startIso,
          end: endIso,
          source: "KANBAN",
          eventType: "task",
          taskStatus: t.status,
          taskPriority: t.priority,
          isAllDay: !hasTime,
        });
      }
    } catch (taskDbErr) {
      console.warn("[CALENDAR_API_TASK_FETCH_WARN]:", taskDbErr);
    }

    // 4. FETCH PROJECT & PHASE MILESTONES (START & TARGET DATES)
    try {
      const [allProjects, allPhases] = await Promise.all([
        db.select().from(projects),
        db.select().from(projectPhases),
      ]);

      const projectMap = new Map(allProjects.map((p) => [p.id, p]));

      // 4a. Phase Milestones (Kickoff & Target)
      for (const phase of allPhases) {
        const proj = projectMap.get(phase.projectId);
        const projName = proj?.name || "Project";

        // Phase Kickoff (startDate)
        if (phase.startDate) {
          const sDate = new Date(phase.startDate);
          if (!isNaN(sDate.getTime()) && sDate >= startDate && sDate <= endDate) {
            const startDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 0, 0, 0, 0);
            const endDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 23, 59, 59, 999);

            const formattedStatus = formatStatus(phase.status);

            unifiedEvents.push({
              id: `phase-start-${phase.id}`,
              projectId: phase.projectId,
              phaseId: phase.id,
              projectName: projName,
              title: `🚀 Kickoff: ${phase.title}`,
              description: `Project: ${projName} • Status: ${formattedStatus} • Progress: ${phase.progress || 0}%`,
              start: startDay.toISOString(),
              end: endDay.toISOString(),
              source: "MILESTONE",
              eventType: "milestone",
              milestoneType: "PHASE_START",
              phaseStatus: formattedStatus,
              isAllDay: true,
            });
          }
        }

        // Phase Target / Deadline (endDate)
        if (phase.endDate) {
          const eDate = new Date(phase.endDate);
          if (!isNaN(eDate.getTime()) && eDate >= startDate && eDate <= endDate) {
            const startDay = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate(), 0, 0, 0, 0);
            const endDay = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate(), 23, 59, 59, 999);
            const formattedStatus = formatStatus(phase.status);

            unifiedEvents.push({
              id: `phase-end-${phase.id}`,
              projectId: phase.projectId,
              phaseId: phase.id,
              projectName: projName,
              title: `🏁 Target: ${phase.title}`,
              description: `Project: ${projName} • Status: ${formattedStatus} • Progress: ${phase.progress || 0}%`,
              start: startDay.toISOString(),
              end: endDay.toISOString(),
              source: "MILESTONE",
              eventType: "milestone",
              milestoneType: "PHASE_END",
              phaseStatus: formattedStatus,
              isAllDay: true,
            });
          }
        }
      }

      // 4b. Project-Level Milestones (if start or target date set)
      for (const p of allProjects) {
        if (p.startDate) {
          const sDate = new Date(p.startDate);
          if (!isNaN(sDate.getTime()) && sDate >= startDate && sDate <= endDate) {
            const startDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 0, 0, 0, 0);
            const endDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 23, 59, 59, 999);

            unifiedEvents.push({
              id: `project-start-${p.id}`,
              projectId: p.id,
              projectName: p.name,
              title: `🎯 Project Start: ${p.name}`,
              description: p.description || `Strategic Project Start`,
              start: startDay.toISOString(),
              end: endDay.toISOString(),
              source: "MILESTONE",
              eventType: "milestone",
              milestoneType: "PROJECT_START",
              isAllDay: true,
            });
          }
        }

        if (p.targetDate) {
          const tDate = new Date(p.targetDate);
          if (!isNaN(tDate.getTime()) && tDate >= startDate && tDate <= endDate) {
            const startDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), 0, 0, 0, 0);
            const endDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), 23, 59, 59, 999);

            unifiedEvents.push({
              id: `project-end-${p.id}`,
              projectId: p.id,
              projectName: p.name,
              title: `🏆 Project Deadline: ${p.name}`,
              description: p.description || `Strategic Project Target Completion Date`,
              start: startDay.toISOString(),
              end: endDay.toISOString(),
              source: "MILESTONE",
              eventType: "milestone",
              milestoneType: "PROJECT_END",
              isAllDay: true,
            });
          }
        }
      }
    } catch (milestoneErr) {
      console.warn("[CALENDAR_API_MILESTONE_FETCH_WARN]:", milestoneErr);
    }

    // 5. CHRONOLOGICALLY SORT MERGED EVENTS
    unifiedEvents.sort((a, b) => {
      const timeA = new Date(a.start).getTime();
      const timeB = new Date(b.start).getTime();
      if (timeA !== timeB) return timeA - timeB;
      // If same start time, prioritize multi-day / all-day events first
      return (b.isAllDay ? 1 : 0) - (a.isAllDay ? 1 : 0);
    });

    return NextResponse.json({
      success: true,
      events: unifiedEvents,
      count: unifiedEvents.length,
      gcalConnected,
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[CALENDAR_EVENTS_API_ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch unified calendar events.",
        events: [],
      },
      { status: 500 }
    );
  }
}
