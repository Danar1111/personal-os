"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Timer,
  Zap,
  Briefcase,
  Heart,
  Sun,
  Coffee,
  Moon,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { getRoutineForDateAction } from "@/app/routine/actions";
import { cn } from "@/lib/utils";

interface RoutineSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: string;
  status: string;
  taskId: number | null;
  notes: string | null;
  orderIndex: number;
  taskTitle?: string | null;
  projectName?: string | null;
  isCarryOverFromYesterday?: boolean;
}

const CATEGORY_MAP: Record<
  string,
  {
    label: string;
    color: string;
    border: string;
    bg: string;
    badgeBg: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DEEP_WORK: {
    label: "Deep Work",
    color: "#c084fc",
    border: "border-purple-500/30 hover:border-purple-500/50",
    bg: "bg-purple-950/30 hover:bg-purple-950/45",
    badgeBg: "bg-purple-500/15 border-purple-500/30 text-purple-300",
    text: "text-purple-300",
    icon: Zap,
  },
  BUSINESS: {
    label: "Business",
    color: "#fbbf24",
    border: "border-amber-500/30 hover:border-amber-500/50",
    bg: "bg-amber-950/30 hover:bg-amber-950/45",
    badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    text: "text-amber-300",
    icon: Briefcase,
  },
  HEALTH: {
    label: "Health",
    color: "#34d399",
    border: "border-emerald-500/30 hover:border-emerald-500/50",
    bg: "bg-emerald-950/30 hover:bg-emerald-950/45",
    badgeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    text: "text-emerald-300",
    icon: Heart,
  },
  PRAYER: {
    label: "Prayer",
    color: "#facc15",
    border: "border-yellow-500/30 hover:border-yellow-500/50",
    bg: "bg-yellow-950/30 hover:bg-yellow-950/45",
    badgeBg: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    text: "text-yellow-300",
    icon: Sun,
  },
  MEETING: {
    label: "Meeting",
    color: "#60a5fa",
    border: "border-blue-500/30 hover:border-blue-500/50",
    bg: "bg-blue-950/30 hover:bg-blue-950/45",
    badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    text: "text-blue-300",
    icon: Coffee,
  },
  ROUTINE: {
    label: "Routine",
    color: "#818cf8",
    border: "border-indigo-500/30 hover:border-indigo-500/50",
    bg: "bg-indigo-950/30 hover:bg-indigo-950/45",
    badgeBg: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300",
    text: "text-indigo-300",
    icon: Clock,
  },
};

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getLocalDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HeaderRoutineWidget() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [timeblocks, setTimeblocks] = useState<RoutineSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mount flag for SSR safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load today's routine data
  const fetchTodayRoutines = useCallback(async () => {
    const today = getLocalDateStr();
    try {
      const res = await getRoutineForDateAction(today);
      if (res.success && Array.isArray(res.timeblocks)) {
        setTimeblocks(res.timeblocks as RoutineSlot[]);
      }
    } catch (err) {
      console.error("[HeaderRoutineWidget Error]:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayRoutines();

    // Listen to routine mutations across the app
    const handleRoutineUpdated = () => {
      fetchTodayRoutines();
    };
    window.addEventListener("routine-updated", handleRoutineUpdated);

    // Refresh when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchTodayRoutines();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Background interval check every 45s
    const pollInterval = setInterval(fetchTodayRoutines, 45000);

    return () => {
      window.removeEventListener("routine-updated", handleRoutineUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(pollInterval);
    };
  }, [fetchTodayRoutines]);

  // Derived current time values
  const nowHours = now.getHours();
  const nowMins = now.getMinutes();
  const nowMinutes = nowHours * 60 + nowMins;
  const nowTimeFormatted = `${String(nowHours).padStart(2, "0")}:${String(nowMins).padStart(2, "0")}`;
  const nowTimeFull = `${nowTimeFormatted}:${String(now.getSeconds()).padStart(2, "0")}`;

  // Analyze active routine & upcoming next routine
  const routineState = useMemo(() => {
    if (!timeblocks.length) {
      return {
        active: null,
        next: null,
        isFreeTime: true,
        progressPct: 0,
        remainingMinutes: 0,
        minutesUntilNext: 0,
        timeLeftLabel: "No Routines",
      };
    }

    const sorted = [...timeblocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    let active: RoutineSlot | null = null;
    let activeDuration = 1;
    let activeElapsed = 0;
    let activeRemaining = 0;

    for (const b of sorted) {
      const s = timeToMinutes(b.startTime);
      let e = timeToMinutes(b.endTime);
      if (e <= s) e += 1440; // Overnight task spans past midnight

      if (nowMinutes >= s && nowMinutes < e) {
        active = b;
        activeDuration = Math.max(1, e - s);
        activeElapsed = nowMinutes - s;
        activeRemaining = Math.max(0, e - nowMinutes);
        break;
      }
    }

    let next: RoutineSlot | null = null;
    let minutesUntilNext = 0;

    if (active) {
      const activeEnd = timeToMinutes(active.endTime);
      // Next routine is the one starting at or after active's end time, or next later in the day
      next = sorted.find((b) => {
        if (b.id === active?.id) return false;
        const bs = timeToMinutes(b.startTime);
        return bs >= (activeEnd % 1440) || bs > nowMinutes;
      }) || null;

      if (next) {
        const nextStart = timeToMinutes(next.startTime);
        minutesUntilNext = nextStart >= nowMinutes ? nextStart - nowMinutes : (nextStart + 1440) - nowMinutes;
      }

      const progressPct = Math.min(100, Math.max(0, (activeElapsed / activeDuration) * 100));
      return {
        active,
        next,
        isFreeTime: false,
        progressPct,
        remainingMinutes: activeRemaining,
        minutesUntilNext,
        timeLeftLabel: `${formatMinutes(activeRemaining)} left`,
      };
    } else {
      // Currently in Free Time!
      next = sorted.find((b) => timeToMinutes(b.startTime) > nowMinutes) || null;
      if (next) {
        minutesUntilNext = timeToMinutes(next.startTime) - nowMinutes;
      } else {
        minutesUntilNext = 1440 - nowMinutes; // until midnight
      }

      return {
        active: null,
        next,
        isFreeTime: true,
        progressPct: 0,
        remainingMinutes: minutesUntilNext,
        minutesUntilNext,
        timeLeftLabel: next ? `${formatMinutes(minutesUntilNext)} free` : "Open time",
      };
    }
  }, [timeblocks, nowMinutes]);

  const { active, next, isFreeTime, progressPct, remainingMinutes, minutesUntilNext, timeLeftLabel } = routineState;

  // Active category aesthetic styling
  const activeCfg = active ? CATEGORY_MAP[active.category] || CATEGORY_MAP.ROUTINE : null;
  const ActiveIcon = activeCfg ? activeCfg.icon : Moon;

  const nextCfg = next ? CATEGORY_MAP[next.category] || CATEGORY_MAP.ROUTINE : null;
  const NextIcon = nextCfg ? nextCfg.icon : Sparkles;

  if (!mounted) {
    return (
      <div className="h-8 w-44 rounded-xl bg-white/[0.04] border border-white/5 animate-pulse hidden sm:block" />
    );
  }

  return (
    <div className="relative group/routine min-w-0 max-w-full">
      {/* ── Main Header Status Pill ── */}
      <div
        onClick={() => router.push("/routine")}
        className={cn(
          "relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer select-none group min-w-0 max-w-full",
          isFreeTime
            ? "border-sky-500/25 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-500/40 text-slate-300"
            : cn(activeCfg?.border, activeCfg?.bg, "text-slate-200")
        )}
      >
        {/* Live Clock & Pulse Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isFreeTime ? "bg-sky-400 animate-pulse" : "animate-pulse"
            )}
            style={{ backgroundColor: activeCfg ? activeCfg.color : "#38bdf8" }}
          />
          <span className="text-[11px] font-mono font-bold text-white tracking-wide">
            {nowTimeFormatted}
          </span>
        </div>

        <span className="w-px h-3.5 bg-white/10 shrink-0" />

        {/* Current Routine Title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <ActiveIcon
            className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110"
            style={{ color: activeCfg ? activeCfg.color : "#38bdf8" }}
          />
          <span className="text-[11px] font-mono font-medium truncate min-w-0 max-w-[80px] sm:max-w-[130px] md:max-w-[170px] lg:max-w-[240px] xl:max-w-[360px] 2xl:max-w-[500px] group-hover:text-white transition-colors">
            {isFreeTime ? "Free Time" : active?.title}
          </span>
        </div>

        {/* Time Left Badge */}
        <div
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 transition-colors",
            isFreeTime
              ? "bg-sky-500/15 text-sky-300 border border-sky-500/25"
              : "bg-white/10 text-amber-300 border border-white/10"
          )}
        >
          <Timer className="w-2.5 h-2.5 shrink-0 text-amber-400" />
          <span>{timeLeftLabel}</span>
        </div>

        {/* Micro Progress Bar on bottom edge of pill */}
        {!isFreeTime && (
          <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progressPct}%`,
                backgroundColor: activeCfg ? activeCfg.color : "#c084fc",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Rich Custom Floating Tooltip on Hover ── */}
      {/* Seamless hover bridge: starts immediately at top-full with pt-2 to bridge the gap */}
      <div className="absolute top-full left-0 pt-2 z-50 pointer-events-none group-hover/routine:pointer-events-auto opacity-0 invisible group-hover/routine:opacity-100 group-hover/routine:visible transition-all duration-200 transform translate-y-1 group-hover/routine:translate-y-0">
        <div className="w-80 sm:w-[350px] p-3.5 rounded-2xl bg-[#0c0c14]/95 border border-white/15 shadow-[0_12px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {/* Header: Live Clock & State */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: activeCfg ? activeCfg.color : "#38bdf8" }}
            />
            <span className="font-bold uppercase tracking-wider text-slate-300">
              {isFreeTime ? "UNSCHEDULED / FREE" : "CURRENT PROTOCOL"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 font-bold">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-white">{nowTimeFull}</span>
            <span className="text-[9px] text-slate-500">WIB</span>
          </div>
        </div>

        {/* Current Routine Details */}
        {active ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold font-mono text-white leading-snug">
                  {active.title}
                </h4>
                {active.projectName && (
                  <span className="text-[10px] font-mono text-amber-400/90 block mt-0.5">
                    ● {active.projectName}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 border",
                  activeCfg?.badgeBg
                )}
              >
                {activeCfg?.label}
              </span>
            </div>

            {/* Time Slot Range & Remaining Countdown */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span className="text-slate-400">
                {active.startTime} — {active.endTime}
              </span>
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Timer className="w-3 h-3 text-amber-400" />
                {formatMinutes(remainingMinutes)} left
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: activeCfg ? activeCfg.color : "#c084fc",
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>{Math.round(progressPct)}% completed</span>
                <span>{formatMinutes(timeToMinutes(active.endTime) - timeToMinutes(active.startTime))} total</span>
              </div>
            </div>

            {active.notes && (
              <p className="text-[10px] font-mono text-slate-400 italic line-clamp-2 bg-white/[0.03] p-1.5 rounded border border-white/5">
                "{active.notes}"
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 text-sky-300">
              <Coffee className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold">Unscheduled Free Time</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
              No routine active at this moment. You have{" "}
              <span className="text-sky-300 font-bold">{formatMinutes(minutesUntilNext)}</span> of open
              rest before the next protocol.
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="my-2.5 border-t border-white/10" />

        {/* ── Upcoming Next Routine ("nextnya apa") ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-purple-400" />
              UPCOMING NEXT
            </span>
            {next && (
              <span className="text-emerald-400 font-bold">
                In {formatMinutes(minutesUntilNext)}
              </span>
            )}
          </div>

          {next ? (
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  <NextIcon
                    className="w-3 h-3 shrink-0 mt-0.5"
                    style={{ color: nextCfg ? nextCfg.color : "#c084fc" }}
                  />
                  <span className="text-xs font-mono font-semibold text-slate-200 break-words leading-snug">
                    {next.title}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5 pl-4.5">
                  {next.startTime} — {next.endTime}
                </div>
              </div>

              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border",
                  nextCfg?.badgeBg
                )}
              >
                {nextCfg?.label}
              </span>
            </div>
          ) : (
            <div className="text-[10px] font-mono text-slate-500 italic py-1">
              All daily protocols complete for today. Reset at midnight.
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
}
