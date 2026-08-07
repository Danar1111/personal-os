"use server";

import { db } from "@/db";
import { calendarEvents, CalendarEvent } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getCalendarEvents() {
  try {
    let events = await db
      .select()
      .from(calendarEvents)
      .orderBy(asc(calendarEvents.startTime));

    // Seed default sample events if empty
    if (events.length === 0) {
      await seedDefaultEventsData();
      events = await db
        .select()
        .from(calendarEvents)
        .orderBy(asc(calendarEvents.startTime));
    }

    return events;
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return [];
  }
}

export async function createEventAction(data: {
  title: string;
  startTime: Date;
  endTime: Date;
  eventType: "task" | "learning" | "general";
}) {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Event title is required");
  }
  if (!data.startTime || !data.endTime) {
    throw new Error("Start time and end time are required");
  }

  await db.insert(calendarEvents).values({
    title: data.title.trim(),
    startTime: data.startTime,
    endTime: data.endTime,
    eventType: data.eventType || "general",
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function updateEventAction(
  id: number,
  data: {
    title?: string;
    startTime?: Date;
    endTime?: Date;
    eventType?: "task" | "learning" | "general";
  }
) {
  const updatePayload: any = {};
  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.startTime !== undefined) updatePayload.startTime = data.startTime;
  if (data.endTime !== undefined) updatePayload.endTime = data.endTime;
  if (data.eventType !== undefined) updatePayload.eventType = data.eventType;

  await db.update(calendarEvents).set(updatePayload).where(eq(calendarEvents.id, id));

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function deleteEventAction(id: number) {
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultEventsData() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30, 0);

  const afternoonStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);
  const afternoonEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0);

  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0, 0);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);

  await db.insert(calendarEvents).values([
    {
      title: "Personal OS Architecture & Phase 7 Review",
      startTime: todayStart,
      endTime: todayEnd,
      eventType: "task",
    },
    {
      title: "Next.js 16 & Turbopack Masterclass",
      startTime: afternoonStart,
      endTime: afternoonEnd,
      eventType: "learning",
    },
    {
      title: "Weekly Goals & Zen Time-Block Sync",
      startTime: tomorrowStart,
      endTime: tomorrowEnd,
      eventType: "general",
    },
  ]);
}
