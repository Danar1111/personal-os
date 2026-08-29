"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Calendar, Clock, CheckSquare, TrendingUp, Cpu, RefreshCw, PartyPopper, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OMNI_AI_SKILLS_REGISTRY } from "@/lib/ai-skills-registry";
import { getSmartDailySummaryAction, ActiveProjectBrief } from "@/app/actions/daily-summary";
import { cn } from "@/lib/utils";

const CACHE_KEY = "personal_os_daily_ai_briefing_cache_v4";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Jam (1 hour)

interface DailyBriefingWidgetProps {
  userNickname?: string | null;
  pendingTasksCount: number;
  totalTasksCount: number;
  completionRate: number;
  topTaskTitles?: string[];
  nextEvent?: { title: string; startTime: Date; source?: string } | null;
  aiSkillsCount?: number;
  activeProjects?: ActiveProjectBrief[];
}

function getTimeOfDayEmoji() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) {
    return "🌅";
  } else if (hour >= 11 && hour < 15) {
    return "☀️";
  } else if (hour >= 15 && hour < 18) {
    return "🌤️";
  } else {
    return "🌙";
  }
}

export function DailyBriefingWidget({
  userNickname,
  pendingTasksCount,
  totalTasksCount,
  completionRate,
  topTaskTitles = [],
  nextEvent,
  aiSkillsCount = OMNI_AI_SKILLS_REGISTRY.length,
  activeProjects = [],
}: DailyBriefingWidgetProps) {
  const greetingName = userNickname || "Danar";
  const timeEmoji = getTimeOfDayEmoji();
  const now = new Date();
  const currentDateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const nextEventTimeStr = nextEvent
    ? new Date(nextEvent.startTime).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const taskSnippet = topTaskTitles.length > 0 ? ` seputar "${topTaskTitles[0]}"` : "";
  const projSnippet =
    activeProjects.length > 0
      ? `, serta progres project "${activeProjects[0].name}"${
          activeProjects[0].currentPhaseTitle ? ` (${activeProjects[0].currentPhaseTitle})` : ""
        }`
      : "";

  // Initial immediate fallback text
  const initialFallback = `Halo ${greetingName}, selamat beraktivitas! Personal OS berjalan lancar dengan ${pendingTasksCount} tugas aktif di kanban (${completionRate}% progres)${taskSnippet}${projSnippet}${
    nextEvent ? `, plus agenda "${nextEvent.title}" jam ${nextEventTimeStr}` : ""
  }. Tetap fokus, santai, dan nikmati hari kamu!`;

  const [summaryText, setSummaryText] = useState<string>(initialFallback);
  const [holidayBadge, setHolidayBadge] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Compute cache key based on dynamic state
  const todayDateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const projectsKey = activeProjects.map((p) => `${p.id}:${p.progress}:${p.currentPhaseTitle || ""}`).join(",");
  const currentKey = `${greetingName}_${pendingTasksCount}_${completionRate}_${nextEvent?.title || "none"}_${topTaskTitles.slice(0, 2).join(",")}_${projectsKey}_${todayDateKey}`;

  const fetchSummary = (force: boolean = false) => {
    startTransition(async () => {
      try {
        // 1. Check localStorage Cache if not forcing
        if (!force && typeof window !== "undefined") {
          const cachedRaw = localStorage.getItem(CACHE_KEY);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            const isFresh = Date.now() - cached.timestamp < CACHE_TTL_MS;
            if (isFresh && cached.key === currentKey && cached.summary) {
              setSummaryText(cached.summary);
              setHolidayBadge(cached.holidayName || null);
              setIsAiGenerated(Boolean(cached.isAiGenerated));
              return;
            }
          }
        }

        // 2. Fetch fresh Smart AI Summary via Server Action
        const res = await getSmartDailySummaryAction({
          userName: greetingName,
          pendingTasksCount,
          totalTasksCount,
          completionRate,
          topTaskTitles,
          nextEvent: nextEvent
            ? {
                title: nextEvent.title,
                startTime: nextEvent.startTime,
                source: nextEvent.source,
              }
            : null,
          activeProjects,
        });

        if (res.success && res.summary) {
          setSummaryText(res.summary);
          setHolidayBadge(res.holidayName || null);
          setIsAiGenerated(res.isAiGenerated);

          // Save to localStorage
          if (typeof window !== "undefined") {
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({
                key: currentKey,
                summary: res.summary,
                holidayName: res.holidayName,
                isAiGenerated: res.isAiGenerated,
                timestamp: Date.now(),
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to load daily briefing summary:", err);
      }
    });
  };

  useEffect(() => {
    fetchSummary(false);
  }, [currentKey]);

  return (
    <div className="bg-[#0e0e14]/90 border border-white/10 p-5 rounded-3xl backdrop-blur-xl shadow-2xl space-y-4 font-sans relative overflow-hidden flex flex-col justify-between h-full min-h-[340px]">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header & Executive Synthesis Content */}
      <div className="space-y-3.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-white tracking-wide">
                DAILY AI BRIEFING &amp; SYSTEM STATUS
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {currentDateStr} • Neural Agent Context
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSummary(true)}
              disabled={isPending}
              title="Refresh AI Summary (1 jam cache)"
              className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isPending && "animate-spin text-purple-400")} />
            </button>

            <Link
              href="/ai-briefing"
              className="text-xs font-mono text-purple-400 hover:text-purple-300 underline flex items-center gap-1 shrink-0"
            >
              Full AI Briefing →
            </Link>
          </div>
        </div>

        {/* Dynamic Executive Synthesis Content */}
        <div className="space-y-2.5 font-sans text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-4.5 rounded-2xl border border-white/5 relative flex-1 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>{timeEmoji} Welcome back, {greetingName}!</span>
            </p>

            <div className="flex items-center gap-1.5">
              {holidayBadge && (
                <Badge variant="outline" className="border-rose-500/40 text-rose-300 bg-rose-500/10 font-mono text-[9px] flex items-center gap-1">
                  <PartyPopper className="w-3 h-3 text-rose-400" />
                  <span>{holidayBadge}</span>
                </Badge>
              )}
              <Badge variant="outline" className={cn("font-mono text-[9px]", isAiGenerated ? "border-purple-500/40 text-purple-300 bg-purple-500/10" : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10")}>
                {isAiGenerated ? "AI SYNTHESIS" : "LIVE CONTEXT"}
              </Badge>
            </div>
          </div>

          <p className="text-slate-200 leading-relaxed text-xs font-sans whitespace-pre-wrap">
            {summaryText}
          </p>
        </div>
      </div>

      {/* Pinned Bottom Section: Context Pills & Footer */}
      <div className="mt-auto space-y-3.5 pt-2">
        {/* Live Context Pills Row (4-Grid) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono text-[11px]">
          <Link
            href="/tasks"
            className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/30 transition-all flex items-center gap-2"
          >
            <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">Pending Tasks</span>
              <span className="text-white font-bold">{pendingTasksCount} Active</span>
            </div>
          </Link>

          <Link
            href="/projects"
            className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-indigo-500/30 transition-all flex items-center gap-2"
            title={
              activeProjects.length > 0
                ? activeProjects
                    .map(
                      (p) =>
                        `${p.name} (${p.currentPhaseTitle ? p.currentPhaseTitle + " • " : ""}${p.progress || 0}%)`
                    )
                    .join("\n")
                : "No active projects"
            }
          >
            <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">Projects</span>
              <span className="text-indigo-300 font-bold truncate block">
                {activeProjects.length > 0 ? `${activeProjects.length} Active` : "None"}
              </span>
            </div>
          </Link>

          <Link
            href="/calendar"
            className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-blue-500/30 transition-all flex items-center gap-2"
          >
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">Next Event</span>
              <span
                title={nextEvent ? `${nextEvent.title} (${nextEventTimeStr})` : "None"}
                className="text-white font-bold truncate block w-full"
              >
                {nextEvent ? nextEvent.title : "None"}
              </span>
            </div>
          </Link>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">AI Core Engine</span>
              <span className="text-emerald-400 font-bold truncate block">
                {aiSkillsCount} Skills Active
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse glow-emerald" />
            <span>Executive Neural Agent Ready</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-indigo-400 hover:text-indigo-300 hover:underline">
              Project Hub →
            </Link>
            <span>•</span>
            <Link href="/tasks" className="text-purple-400 hover:text-purple-300 hover:underline">
              Omni-Kanban →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
