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

async function fetchCalendarEvents() {
  try {
    const events = await db.select().from(calendarEvents).orderBy(desc(calendarEvents.startTime));
    return events;
  } catch (error) {
    console.error("[fetchCalendarEvents error]:", error);
    return [];
  }
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

export default async function DashboardPage() {
  // Fetch Tasks for Kanban Widget
  let recentTasks: Task[] = [];
  let totalTasks = 0;
  let completedTasks = 0;

  try {
    const allTasks = await db.select().from(tasks);
    totalTasks = allTasks.length;
    completedTasks = allTasks.filter((t) => t.status === "done").length;

    // Prioritize status: in_progress (1), todo (2), done (3)
    const statusPriority: Record<string, number> = {
      in_progress: 1,
      todo: 2,
      done: 3,
    };

    const sortedTasks = [...allTasks].sort((a, b) => {
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
  const events = await fetchCalendarEvents();
  const topMovies = await fetchTopThreeMovies();
  const apps = await getApplications();

  // Find the next upcoming event (startTime or endTime >= now)
  const now = new Date();
  const upcomingEvents = events
    .filter((ev) => new Date(ev.endTime || ev.startTime).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

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
            pendingTasksCount={totalTasks - completedTasks}
            totalTasksCount={totalTasks}
            completionRate={completionRate}
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
