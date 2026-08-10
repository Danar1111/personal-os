import React from "react";
import Link from "next/link";
import { Sparkles, Calendar, Clock, CheckSquare, TrendingUp, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { OMNI_AI_SKILLS_REGISTRY } from "@/lib/ai-skills-registry";

interface DailyBriefingWidgetProps {
  userNickname?: string | null;
  pendingTasksCount: number;
  totalTasksCount: number;
  completionRate: number;
  nextEvent?: { title: string; startTime: Date } | null;
  aiSkillsCount?: number;
}

export function DailyBriefingWidget({
  userNickname,
  pendingTasksCount,
  totalTasksCount,
  completionRate,
  nextEvent,
  aiSkillsCount = OMNI_AI_SKILLS_REGISTRY.length,
}: DailyBriefingWidgetProps) {
  const greetingName = userNickname || "Chief Operating Officer";
  const currentDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const nextEventTimeStr = nextEvent
    ? new Date(nextEvent.startTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="bg-[#0e0e14]/90 border border-white/10 p-5 rounded-3xl backdrop-blur-xl shadow-2xl space-y-4 font-sans relative overflow-hidden flex flex-col justify-between h-full">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-white tracking-wide">
                DAILY AI BRIEFING & SYSTEM STATUS
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {currentDateStr} • Live Neural Agent Context
              </p>
            </div>
          </div>

          <Link
            href="/ai-briefing"
            className="text-xs font-mono text-purple-400 hover:text-purple-300 underline flex items-center gap-1 shrink-0"
          >
            Full AI Briefing →
          </Link>
        </div>

        {/* Dynamic Executive Synthesis Content */}
        <div className="space-y-3 font-sans text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-4 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white font-mono flex items-center gap-2">
              <span>☀️ Welcome back, {greetingName}!</span>
            </p>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[9px]">
              LIVE CONTEXT
            </Badge>
          </div>

          <p className="text-slate-300 leading-relaxed">
            Your Personal OS is running smoothly. You currently have{" "}
            <span className="text-purple-300 font-bold font-mono">{pendingTasksCount} pending task{pendingTasksCount !== 1 ? "s" : ""}</span>{" "}
            in your Omni-Kanban queue ({completionRate}% completion rate across {totalTasksCount} total items).
          </p>

          <p className="text-slate-300 leading-relaxed">
            {nextEvent ? (
              <>
                Next on your Master Calendar schedule is{" "}
                <span className="text-white font-semibold font-mono">
                  &quot;{nextEvent.title}&quot;
                </span>{" "}
                at <span className="text-indigo-300 font-mono">{nextEventTimeStr}</span>.
              </>
            ) : (
              <span className="text-slate-400 italic">No upcoming calendar events scheduled today.</span>
            )}
          </p>
        </div>

        {/* Live Context Pills Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3 font-mono text-[11px]">
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">Pending Tasks</span>
              <span className="text-white font-bold">{pendingTasksCount} Active</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">Next Event</span>
              <span
                title={nextEvent ? nextEvent.title : "None"}
                className="text-white font-bold truncate block w-full"
              >
                {nextEvent ? nextEvent.title : "None"}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 col-span-2 sm:col-span-1">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 text-[9px] block uppercase">AI Engine Skills</span>
              <span className="text-emerald-400 font-bold">
                {aiSkillsCount} Skills Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse glow-emerald" />
          <span>All {aiSkillsCount} AI Core Engine Skills Operational</span>
        </div>
        <Link href="/tasks" className="text-purple-400 hover:text-purple-300 underline">
          View Task Omni-Kanban →
        </Link>
      </div>
    </div>
  );
}
