import React, { Suspense } from "react";
import Link from "next/link";
import { db } from "@/db";
import { tasks, projects, calendarEvents, Task, Project } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  Sparkles,
  CheckSquare,
  Clock,
  ArrowUpRight,
  Plus,
  Zap,
  CheckCircle2,
  ListTodo,
  ExternalLink,
  DollarSign,
  Database,
  Film,
  Globe,
  Activity,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CurrencyWidget } from "@/components/dashboard/CurrencyWidget";
import { NewsWidget } from "@/components/dashboard/NewsWidget";
import { MarketWidget } from "@/components/dashboard/MarketWidget";
import { MiniCalendarWidget } from "@/components/dashboard/MiniCalendarWidget";
import { DailyBriefingWidget } from "@/components/dashboard/DailyBriefingWidget";
import { TaskKanbanWidget } from "@/components/dashboard/TaskKanbanWidget";
import { MovieRecommendationWidget } from "@/components/dashboard/MovieRecommendationWidget";
import { AppLauncherWidget } from "@/components/dashboard/AppLauncherWidget";
import { getTrendingMovies } from "@/app/watchlist/actions";

export const revalidate = 0; // Live DB data fetching

function WidgetSkeleton({ title }: { title: string }) {
  return (
    <div className="glass-panel rounded-3xl p-5 animate-pulse flex flex-col justify-between h-60 border border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/10" />
        <div className="space-y-1">
          <div className="w-28 h-3.5 bg-white/10 rounded" />
          <div className="w-16 h-2.5 bg-white/5 rounded" />
        </div>
      </div>
      <div className="space-y-2.5 my-3">
        <div className="w-full h-10 bg-white/5 rounded-xl" />
        <div className="w-3/4 h-4 bg-white/5 rounded-lg" />
      </div>
      <div className="w-full h-3 bg-white/5 rounded" />
    </div>
  );
}

import { getApplications } from "@/lib/actions/appActions";
import { getCalendarClient, getGoogleRefreshToken } from "@/lib/google";

async function fetchUnifiedUpcomingEvents() {
  const now = new Date();
  const upcomingUnified: { title: string; startTime: Date; source: "GCAL" | "LOCAL" }[] = [];

  // 1. Fetch Local Drizzle Events
  try {
    const localRows = await db.select().from(calendarEvents);
    for (const row of localRows) {
      const end = new Date(row.endTime || row.startTime);
      if (end.getTime() >= now.getTime()) {
        upcomingUnified.push({
          title: row.title,
          startTime: new Date(row.startTime),
          source: "LOCAL",
        });
      }
    }
  } catch (e) {
    console.error("[Local events fetch error]:", e);
  }

  // 2. Fetch Google Calendar Events if connected
  try {
    const refreshToken = await getGoogleRefreshToken();
    if (refreshToken) {
      const calendar = await getCalendarClient();
      const endWindow = new Date();
      endWindow.setDate(endWindow.getDate() + 30); // 30 days ahead

      const gcalRes = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: endWindow.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      });

      const items = gcalRes.data.items || [];
      for (const item of items) {
        if (!item.summary) continue;
        let startIso = item.start?.dateTime || item.start?.date;
        if (!startIso) continue;
        const startDate = new Date(startIso);
        let endDate = item.end?.dateTime ? new Date(item.end.dateTime) : new Date(startDate.getTime() + 60 * 60 * 1000);
        if (endDate.getTime() >= now.getTime()) {
          upcomingUnified.push({
            title: item.summary,
            startTime: startDate,
            source: "GCAL",
          });
        }
      }
    }
  } catch (e: any) {
    console.warn("[GCal events fetch warning]:", e?.message || e);
  }

  // Sort chronologically
  upcomingUnified.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return upcomingUnified;
}

async function fetchTopThreeMovies() {
  try {
    const trendingRes = await getTrendingMovies();
    const list = trendingRes?.results || [];
    return list.slice(0, 3);
  } catch (e) {
    console.error("[fetchTopThreeMovies error]:", e);
  }
  return [];
}

import { OMNI_AI_SKILLS_REGISTRY } from "@/lib/ai-skills-registry";
import { getUserNicknameAction } from "@/app/knowledge/actions";

export default async function DashboardPage() {
  const userNickname = await getUserNicknameAction();
  // Fetch Tasks for Kanban Widget
  let allTasksList: Task[] = [];
  let recentTasks: Task[] = [];
  let totalTasks = 0;
  let completedTasks = 0;

  try {
    allTasksList = await db.select().from(tasks);
    totalTasks = allTasksList.length;
    completedTasks = allTasksList.filter((t) => t.status === "done").length;

    // Prioritize status: in_progress (1), todo (2), done (3)
    const statusPriority: Record<string, number> = {
      in_progress: 1,
      todo: 2,
      done: 3,
    };

    const sortedTasks = [...allTasksList].sort((a, b) => {
      const pA = statusPriority[a.status] || 2;
      const pB = statusPriority[b.status] || 2;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    recentTasks = sortedTasks.slice(0, 4);
  } catch (e) {
    console.error("[Dashboard Tasks Error]:", e);
  }

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const events = await db.select().from(calendarEvents).orderBy(desc(calendarEvents.startTime));
  const upcomingEvents = await fetchUnifiedUpcomingEvents();
  const topMovies = await fetchTopThreeMovies();
  const apps = await getApplications();

  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

  // Active tasks sorted: tasks with deadlines first (earliest deadline first), then newest
  const activeTasks = allTasksList.filter((t) => t.status !== "done");
  activeTasks.sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const activeTaskTitles = activeTasks.map((t) => {
    if (t.dueDate) {
      const d = new Date(t.dueDate);
      const dateStr = d.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
      const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
      if (hasTime) {
        const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        return `${t.title} (Deadline: ${dateStr} jam ${timeStr})`;
      }
      return `${t.title} (Deadline: ${dateStr})`;
    }
    return t.title;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <Zap className="w-7 h-7 text-purple-400 animate-pulse" />
            <span>COMMAND CENTER OVERVIEW</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Personal OS Executive Dashboard • Dynamic 12-Column CSS Grid
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 font-mono text-xs py-1.5 px-3">
            SYSTEM ACTIVE
          </Badge>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 12-COLUMN DASHBOARD GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* ----------------------------------------------------------------------- */}
        {/* ROW 1: DAILY BRIEFING (Col 8) & KANBAN (Col 4) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="col-span-12 md:col-span-8">
          <DailyBriefingWidget
            userNickname={userNickname}
            pendingTasksCount={totalTasks - completedTasks}
            totalTasksCount={totalTasks}
            completionRate={completionRate}
            topTaskTitles={activeTaskTitles}
            nextEvent={nextEvent}
            aiSkillsCount={OMNI_AI_SKILLS_REGISTRY.length}
          />
        </div>

        <div className="col-span-12 md:col-span-4">
          <TaskKanbanWidget
            tasks={recentTasks}
            totalTasks={totalTasks}
            completedTasks={completedTasks}
          />
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* ROW 2: MARKETS (Col 8) & MINI CALENDAR (Col 4) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="col-span-12 md:col-span-8">
          <Suspense fallback={<WidgetSkeleton title="Markets" />}>
            <MarketWidget />
          </Suspense>
        </div>

        <div className="col-span-12 md:col-span-4">
          <Suspense fallback={<WidgetSkeleton title="Calendar" />}>
            <MiniCalendarWidget events={events} />
          </Suspense>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* ROW 3: NEWS (Col 6), CURRENCY (Col 3) & MOVIE RECOMMENDATION (Col 3) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="col-span-12 md:col-span-6">
          <Suspense fallback={<WidgetSkeleton title="Daily Tech & Business News" />}>
            <NewsWidget />
          </Suspense>
        </div>

        <div className="col-span-12 md:col-span-3">
          <Suspense fallback={<WidgetSkeleton title="USD Exchange" />}>
            <CurrencyWidget />
          </Suspense>
        </div>

        <div className="col-span-12 md:col-span-3">
          <Suspense fallback={<WidgetSkeleton title="Movie Pick" />}>
            <MovieRecommendationWidget movies={topMovies} />
          </Suspense>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* ROW 4: APP LAUNCHER (Col 12) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="col-span-12">
          <AppLauncherWidget apps={apps} />
        </div>

      </div>
    </div>
  );
}
