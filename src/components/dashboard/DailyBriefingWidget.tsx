import React from "react";
import Link from "next/link";
import { Sparkles, Calendar, Clock, CheckSquare, TrendingUp, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DailyBriefingWidgetProps {
  pendingTasksCount: number;
  totalTasksCount: number;
  completionRate: number;
  nextEvent?: { title: string; startTime: Date } | null;
  aiSkillsCount?: number;
}

export function DailyBriefingWidget({
  pendingTasksCount,
  totalTasksCount,
  completionRate,
  nextEvent,
  aiSkillsCount = 54,
}: DailyBriefingWidgetProps) {
  const currentDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const nextEventTimeStr = nextEvent
    ? `${new Date(nextEvent.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${new Date(nextEvent.startTime).toLocaleDateString([], { month: "short", day: "numeric" })})`
    : "";

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-6 border border-white/10 flex flex-col justify-between h-full relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 blur-[100px] pointer-events-none" />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-white tracking-wide uppercase">
                DAILY AI BRIEFING &amp; SYSTEM STATUS
              </h2>
              <p className="text-xs text-slate-400 font-mono">
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
              <span>☀️ Welcome back, Chief Operating Officer!</span>
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
