"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Project, ProjectPhase } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Calendar,
  Layers,
  ZoomIn,
  Move,
  Clock,
  Sparkles,
  Link2,
} from "lucide-react";

// ── 1. Expanded Color Palette Engine (24 Modern Vibrant Palettes) ───────────
export interface GanttPalette {
  name: string;
  bg: string;
  border: string;
  text: string;
  barBg: string;
  barBorder: string;
  progressBg: string;
  glow: string;
  hex: string;
}

export const GANTT_PALETTES: GanttPalette[] = [
  { name: "indigo", bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-300", barBg: "bg-indigo-600/30", barBorder: "border-indigo-400/60", progressBg: "bg-indigo-500/70", glow: "shadow-indigo-500/20", hex: "#6366f1" },
  { name: "emerald", bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-300", barBg: "bg-emerald-600/30", barBorder: "border-emerald-400/60", progressBg: "bg-emerald-500/70", glow: "shadow-emerald-500/20", hex: "#10b981" },
  { name: "amber", bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-300", barBg: "bg-amber-600/30", barBorder: "border-amber-400/60", progressBg: "bg-amber-500/70", glow: "shadow-amber-500/20", hex: "#f59e0b" },
  { name: "cyan", bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-300", barBg: "bg-cyan-600/30", barBorder: "border-cyan-400/60", progressBg: "bg-cyan-500/70", glow: "shadow-cyan-500/20", hex: "#06b6d4" },
  { name: "rose", bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-300", barBg: "bg-rose-600/30", barBorder: "border-rose-400/60", progressBg: "bg-rose-500/70", glow: "shadow-rose-500/20", hex: "#f43f5e" },
  { name: "purple", bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-300", barBg: "bg-purple-600/30", barBorder: "border-purple-400/60", progressBg: "bg-purple-500/70", glow: "shadow-purple-500/20", hex: "#a855f7" },
  { name: "lime", bg: "bg-lime-500/15", border: "border-lime-500/40", text: "text-lime-300", barBg: "bg-lime-600/30", barBorder: "border-lime-400/60", progressBg: "bg-lime-500/70", glow: "shadow-lime-500/20", hex: "#84cc16" },
  { name: "orange", bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-300", barBg: "bg-orange-600/30", barBorder: "border-orange-400/60", progressBg: "bg-orange-500/70", glow: "shadow-orange-500/20", hex: "#f97316" },
  { name: "sky", bg: "bg-sky-500/15", border: "border-sky-500/40", text: "text-sky-300", barBg: "bg-sky-600/30", barBorder: "border-sky-400/60", progressBg: "bg-sky-500/70", glow: "shadow-sky-500/20", hex: "#0ea5e9" },
  { name: "fuchsia", bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", text: "text-fuchsia-300", barBg: "bg-fuchsia-600/30", barBorder: "border-fuchsia-400/60", progressBg: "bg-fuchsia-500/70", glow: "shadow-fuchsia-500/20", hex: "#d946ef" },
  { name: "teal", bg: "bg-teal-500/15", border: "border-teal-500/40", text: "text-teal-300", barBg: "bg-teal-600/30", barBorder: "border-teal-400/60", progressBg: "bg-teal-500/70", glow: "shadow-teal-500/20", hex: "#14b8a6" },
  { name: "ruby", bg: "bg-pink-600/15", border: "border-pink-600/40", text: "text-pink-300", barBg: "bg-pink-700/30", barBorder: "border-pink-500/60", progressBg: "bg-pink-600/70", glow: "shadow-pink-600/20", hex: "#db2777" },
  { name: "violet", bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-300", barBg: "bg-violet-600/30", barBorder: "border-violet-400/60", progressBg: "bg-violet-500/70", glow: "shadow-violet-500/20", hex: "#8b5cf6" },
  { name: "mint", bg: "bg-emerald-400/15", border: "border-emerald-400/40", text: "text-emerald-200", barBg: "bg-emerald-500/30", barBorder: "border-emerald-300/60", progressBg: "bg-emerald-400/70", glow: "shadow-emerald-400/20", hex: "#34d399" },
  { name: "yellow", bg: "bg-yellow-500/15", border: "border-yellow-500/40", text: "text-yellow-300", barBg: "bg-yellow-600/30", barBorder: "border-yellow-400/60", progressBg: "bg-yellow-500/70", glow: "shadow-yellow-500/20", hex: "#eab308" },
  { name: "electric", bg: "bg-cyan-400/15", border: "border-cyan-400/40", text: "text-cyan-200", barBg: "bg-cyan-500/30", barBorder: "border-cyan-300/60", progressBg: "bg-cyan-400/70", glow: "shadow-cyan-400/20", hex: "#22d3ee" },
  { name: "crimson", bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-300", barBg: "bg-red-600/30", barBorder: "border-red-400/60", progressBg: "bg-red-500/70", glow: "shadow-red-500/20", hex: "#ef4444" },
  { name: "lavender", bg: "bg-indigo-400/15", border: "border-indigo-400/40", text: "text-indigo-200", barBg: "bg-indigo-500/30", barBorder: "border-indigo-300/60", progressBg: "bg-indigo-400/70", glow: "shadow-indigo-400/20", hex: "#818cf8" },
  { name: "green", bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-300", barBg: "bg-green-600/30", barBorder: "border-green-400/60", progressBg: "bg-green-500/70", glow: "shadow-green-500/20", hex: "#22c55e" },
  { name: "coral", bg: "bg-rose-400/15", border: "border-rose-400/40", text: "text-rose-200", barBg: "bg-rose-500/30", barBorder: "border-rose-300/60", progressBg: "bg-rose-400/70", glow: "shadow-rose-400/20", hex: "#fb7185" },
  { name: "blue", bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-300", barBg: "bg-blue-600/30", barBorder: "border-blue-400/60", progressBg: "bg-blue-500/70", glow: "shadow-blue-500/20", hex: "#3b82f6" },
  { name: "neon", bg: "bg-lime-400/15", border: "border-lime-400/40", text: "text-lime-200", barBg: "bg-lime-500/30", barBorder: "border-lime-300/60", progressBg: "bg-lime-400/70", glow: "shadow-lime-400/20", hex: "#a3e635" },
  { name: "ocean", bg: "bg-blue-600/15", border: "border-blue-600/40", text: "text-blue-300", barBg: "bg-blue-700/30", barBorder: "border-blue-500/60", progressBg: "bg-blue-600/70", glow: "shadow-blue-600/20", hex: "#2563eb" },
  { name: "pink", bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-300", barBg: "bg-pink-600/30", barBorder: "border-pink-400/60", progressBg: "bg-pink-500/70", glow: "shadow-pink-500/20", hex: "#ec4899" },
];

export function getPaletteForTitle(title: string, index?: number): GanttPalette {
  if (index !== undefined && index >= 0) {
    return GANTT_PALETTES[index % GANTT_PALETTES.length];
  }
  // High-dispersion 32-bit FNV-1a hash algorithm
  let hash = 2166136261;
  const cleanTitle = (title || "").trim().toLowerCase();
  for (let i = 0; i < cleanTitle.length; i++) {
    hash ^= cleanTitle.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const idx = (hash >>> 0) % GANTT_PALETTES.length;
  return GANTT_PALETTES[idx];
}

// ── Date Helpers ─────────────────────────────────────────────────────────────
function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const clean = String(d).split("T")[0];
  const parts = clean.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDate(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function daysDiff(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

function formatPrettyDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseDate(d) : d;
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(d1: Date | string | null | undefined, d2: Date | string | null | undefined): string {
  const s = typeof d1 === "string" ? parseDate(d1) : d1;
  const e = typeof d2 === "string" ? parseDate(d2) : d2;
  if (!s && !e) return "—";
  if (s && !e) return formatPrettyDate(s);
  if (!s && e) return formatPrettyDate(e);
  if (s && e) {
    const sYear = s.getFullYear();
    const eYear = e.getFullYear();
    const sMonth = MONTH_NAMES[s.getMonth()].slice(0, 3);
    const eMonth = MONTH_NAMES[e.getMonth()].slice(0, 3);
    const sDay = s.getDate();
    const eDay = e.getDate();
    if (sYear === eYear) {
      if (s.getMonth() === e.getMonth()) {
        if (sDay === eDay) return `${sMonth} ${sDay}, ${sYear}`;
        return `${sMonth} ${sDay}–${eDay}, ${sYear}`;
      }
      return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear}`;
    }
    return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`;
  }
  return "—";
}

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ── Component Props ──────────────────────────────────────────────────────────
export interface ProjectGanttProps {
  project: Project;
  phases: ProjectPhase[];
  onPhaseUpdate: (
    id: number,
    data: { startDate?: string; endDate?: string; progress?: number; dependsOnPhaseId?: number | null }
  ) => void;
  onPhaseSelect?: (phaseId: number) => void;
}

type ViewMode = "day" | "week" | "month";

const BASE_VIEW_MODE_CONFIG: Record<ViewMode, { label: string; colWidth: number }> = {
  day: { label: "Day", colWidth: 42 },
  week: { label: "Week", colWidth: 24 },
  month: { label: "Month", colWidth: 10 },
};

export function ProjectGantt({ project, phases, onPhaseUpdate, onPhaseSelect }: ProjectGanttProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  const rowHeight = 56;
  const headerHeight = 64;
  const sidebarWidth = 260;

  // Track container width to dynamically stretch Month / Week views and remove blank spaces
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── 1. Full Month Alignment (Always start on 1st of month, end on last day of month) ──
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validDates: Date[] = [today];

    const projStart = parseDate(project.startDate ? String(project.startDate) : null);
    if (projStart) validDates.push(projStart);

    const projEnd = parseDate(project.targetDate ? String(project.targetDate) : null);
    if (projEnd) validDates.push(projEnd);

    phases.forEach((p) => {
      const s = parseDate(String(p.startDate));
      const e = parseDate(String(p.endDate));
      if (s) validDates.push(s);
      if (e) validDates.push(e);
    });

    const minTime = Math.min(...validDates.map((d) => d.getTime()));
    const maxTime = Math.max(...validDates.map((d) => d.getTime()));

    const rawStart = new Date(minTime);
    const rawEnd = new Date(maxTime);

    // Snap to the 1st day of the earliest month
    const start = new Date(rawStart.getFullYear(), rawStart.getMonth(), 1);

    // Snap to the last day of the latest month
    const end = new Date(rawEnd.getFullYear(), rawEnd.getMonth() + 1, 0);

    const days = Math.max(1, daysDiff(start, end) + 1);

    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
    };
  }, [project.startDate, project.targetDate, phases]);

  // ── Dynamic ColWidth: Auto-expand to 100% container width to remove blank space on right ──
  const colWidth = useMemo(() => {
    const baseWidth = BASE_VIEW_MODE_CONFIG[viewMode].colWidth;
    const availableGridWidth = Math.max(300, containerWidth - sidebarWidth);
    const minCalculated = availableGridWidth / Math.max(1, totalDays);

    if (viewMode === "month" || viewMode === "week") {
      return Math.max(baseWidth, minCalculated);
    }
    return baseWidth;
  }, [viewMode, containerWidth, sidebarWidth, totalDays]);

  const totalGridWidth = Math.max(totalDays * colWidth, containerWidth - sidebarWidth);

  // ── Build Two-Tier Header Data (Months on Top, Days below) ────────────────
  const { monthHeaders, dayColumns } = useMemo(() => {
    const months: { monthName: string; year: number; startIndex: number; count: number }[] = [];
    const days: { date: Date; dayNum: number; weekdayInitial: string; isWeekend: boolean; dateStr: string }[] = [];

    let currentMonth = -1;
    let currentYear = -1;
    let monthStartIndex = 0;
    let monthCount = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = addDaysToDate(timelineStart, i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      days.push({
        date: d,
        dayNum: d.getDate(),
        weekdayInitial: WEEKDAY_NAMES[dayOfWeek],
        isWeekend,
        dateStr: formatDateStr(d),
      });

      if (m !== currentMonth || y !== currentYear) {
        if (currentMonth !== -1) {
          months.push({
            monthName: MONTH_NAMES[currentMonth],
            year: currentYear,
            startIndex: monthStartIndex,
            count: monthCount,
          });
        }
        currentMonth = m;
        currentYear = y;
        monthStartIndex = i;
        monthCount = 1;
      } else {
        monthCount++;
      }
    }

    if (currentMonth !== -1) {
      months.push({
        monthName: MONTH_NAMES[currentMonth],
        year: currentYear,
        startIndex: monthStartIndex,
        count: monthCount,
      });
    }

    return { monthHeaders: months, dayColumns: days };
  }, [timelineStart, totalDays]);

  // ── Today Offset Calculation ───────────────────────────────────────────────
  const todayOffsetDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return daysDiff(timelineStart, today);
  }, [timelineStart]);

  const isTodayVisible = todayOffsetDays >= 0 && todayOffsetDays < totalDays;

  // ── Scroll to Today Button Action ──────────────────────────────────────────
  const scrollToToday = useCallback(() => {
    if (!scrollContainerRef.current || !isTodayVisible) return;
    const targetX = todayOffsetDays * colWidth - scrollContainerRef.current.clientWidth / 2 + 120;
    scrollContainerRef.current.scrollTo({
      left: Math.max(0, targetX),
      behavior: "smooth",
    });
  }, [todayOffsetDays, colWidth, isTodayVisible]);

  useEffect(() => {
    if (scrollContainerRef.current && isTodayVisible) {
      const targetX = todayOffsetDays * colWidth - scrollContainerRef.current.clientWidth / 3;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetX);
    }
  }, [isTodayVisible, todayOffsetDays, colWidth]);

  // ── Hover Tooltip State ────────────────────────────────────────────────────
  const [hoveredPhase, setHoveredPhase] = useState<{
    phase: ProjectPhase;
    x: number;
    y: number;
    palette: GanttPalette;
    dependsOnName?: string;
    isConcurrent?: boolean;
  } | null>(null);

  // ── Interactive Drag / Resize / Progress State ─────────────────────────────
  type DragMode = "move" | "resize-left" | "resize-right" | "progress";

  const [dragState, setDragState] = useState<{
    phaseId: number;
    mode: DragMode;
    startX: number;
    origStartDate: Date;
    origEndDate: Date;
    origProgress: number;
    currentStartDate: Date;
    currentEndDate: Date;
    currentProgress: number;
    barWidthPx: number;
  } | null>(null);

  const handlePointerDown = (
    e: React.MouseEvent,
    phase: ProjectPhase,
    mode: DragMode,
    barWidthPx: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const start = parseDate(String(phase.startDate)) || new Date();
    const end = parseDate(String(phase.endDate)) || addDaysToDate(start, 7);
    const prog = (phase as any).progress ?? (phase.status === "DONE" ? 100 : phase.status === "IN_PROGRESS" ? 60 : 0);

    setDragState({
      phaseId: phase.id,
      mode,
      startX: e.clientX,
      origStartDate: start,
      origEndDate: end,
      origProgress: prog,
      currentStartDate: start,
      currentEndDate: end,
      currentProgress: prog,
      barWidthPx: Math.max(barWidthPx, 30),
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: MouseEvent) => {
      const deltaPixels = e.clientX - dragState.startX;

      if (dragState.mode === "progress") {
        const deltaPct = Math.round((deltaPixels / dragState.barWidthPx) * 100);
        const newProg = Math.max(0, Math.min(100, dragState.origProgress + deltaPct));
        setDragState((prev) => (prev ? { ...prev, currentProgress: newProg } : null));
        return;
      }

      const deltaDays = Math.round(deltaPixels / colWidth);

      let newStart = dragState.origStartDate;
      let newEnd = dragState.origEndDate;

      if (dragState.mode === "move") {
        const candidateStart = addDaysToDate(dragState.origStartDate, deltaDays);
        const duration = daysDiff(dragState.origStartDate, dragState.origEndDate);

        if (candidateStart.getTime() >= timelineStart.getTime() && addDaysToDate(candidateStart, duration).getTime() <= timelineEnd.getTime()) {
          newStart = candidateStart;
          newEnd = addDaysToDate(candidateStart, duration);
        } else if (candidateStart.getTime() < timelineStart.getTime()) {
          newStart = timelineStart;
          newEnd = addDaysToDate(timelineStart, duration);
        }
      } else if (dragState.mode === "resize-left") {
        const candidateStart = addDaysToDate(dragState.origStartDate, deltaDays);
        if (candidateStart.getTime() >= timelineStart.getTime() && candidateStart.getTime() <= dragState.origEndDate.getTime()) {
          newStart = candidateStart;
        }
      } else if (dragState.mode === "resize-right") {
        const candidateEnd = addDaysToDate(dragState.origEndDate, deltaDays);
        if (candidateEnd.getTime() <= timelineEnd.getTime() && candidateEnd.getTime() >= dragState.origStartDate.getTime()) {
          newEnd = candidateEnd;
        }
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentStartDate: newStart,
              currentEndDate: newEnd,
            }
          : null
      );
    };

    const onPointerUp = (e: MouseEvent) => {
      if (dragState) {
        const movedDistance = Math.abs(e.clientX - dragState.startX);
        if (movedDistance <= 5 && dragState.mode === "move") {
          // Pure click on the bar: navigate to phase details and auto-expand
          onPhaseSelect?.(dragState.phaseId);
        } else if (dragState.mode === "progress") {
          if (dragState.currentProgress !== dragState.origProgress) {
            onPhaseUpdate(dragState.phaseId, { progress: dragState.currentProgress });
          }
        } else {
          const startStr = formatDateStr(dragState.currentStartDate);
          const endStr = formatDateStr(dragState.currentEndDate);
          const origStartStr = formatDateStr(dragState.origStartDate);
          const origEndStr = formatDateStr(dragState.origEndDate);
          if (startStr !== origStartStr || endStr !== origEndStr) {
            onPhaseUpdate(dragState.phaseId, {
              startDate: startStr,
              endDate: endStr,
            });
          }
        }
      }
      setDragState(null);
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
    };
  }, [dragState, colWidth, timelineStart, timelineEnd, onPhaseUpdate, onPhaseSelect]);

  // ── Calculate Phase Positions & Orthogonal Stepped Dependency Arrows ───────
  const { phaseLayouts, dependencyArrows } = useMemo(() => {
    const phaseMap = new Map<number, ProjectPhase>();
    phases.forEach((p) => phaseMap.set(p.id, p));

    const layouts = phases.map((phase, idx) => {
      const isBeingDragged = dragState?.phaseId === phase.id;
      const start = isBeingDragged
        ? dragState.currentStartDate
        : parseDate(String(phase.startDate)) || timelineStart;
      const end = isBeingDragged
        ? dragState.currentEndDate
        : parseDate(String(phase.endDate)) || addDaysToDate(start, 7);

      const offsetDays = Math.max(0, daysDiff(timelineStart, start));
      const durationDays = Math.max(1, daysDiff(start, end) + 1);

      const left = offsetDays * colWidth;
      const width = Math.max(28, durationDays * colWidth - 6);
      const top = idx * rowHeight + 11;
      const height = 34;

      const palette = getPaletteForTitle(phase.title, idx);

      const progress = isBeingDragged && dragState.mode === "progress"
        ? dragState.currentProgress
        : (phase as any).progress ?? (phase.status === "DONE" ? 100 : phase.status === "IN_PROGRESS" ? 60 : 0);

      const dependsOn = (phase as any).dependsOnPhaseId ? phaseMap.get((phase as any).dependsOnPhaseId) : null;

      return {
        phase,
        idx,
        start,
        end,
        left,
        width,
        top,
        height,
        palette,
        progress,
        dependsOn,
        isBeingDragged,
      };
    });

    const layoutById = new Map<number, (typeof layouts)[0]>();
    layouts.forEach((l) => layoutById.set(l.phase.id, l));

    // Compute Rectilinear / Orthogonal Angled Dependency Paths
    const arrows: {
      id: string;
      sourcePhaseId: number;
      targetPhaseId: number;
      pathD: string;
      color: string;
    }[] = [];

    layouts.forEach((targetLayout) => {
      const depId = (targetLayout.phase as any).dependsOnPhaseId;
      if (!depId) return;

      const sourceLayout = layoutById.get(depId);
      if (!sourceLayout) return;

      const startX = sourceLayout.left + sourceLayout.width;
      const startY = sourceLayout.top + sourceLayout.height / 2;

      const endX = targetLayout.left;
      const endY = targetLayout.top + targetLayout.height / 2;

      let d = "";
      if (endX >= startX + 14) {
        const turnX = startX + 10;
        d = `M ${startX} ${startY} L ${turnX} ${startY} L ${turnX} ${endY} L ${endX} ${endY}`;
      } else {
        const exitX = startX + 10;
        const gutterY = sourceLayout.idx < targetLayout.idx
          ? sourceLayout.top + sourceLayout.height + (rowHeight - sourceLayout.height) / 2
          : sourceLayout.top - (rowHeight - sourceLayout.height) / 2;
        const entryX = endX - 12;

        d = `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${gutterY} L ${entryX} ${gutterY} L ${entryX} ${endY} L ${endX} ${endY}`;
      }

      arrows.push({
        id: `dep-${sourceLayout.phase.id}-${targetLayout.phase.id}`,
        sourcePhaseId: sourceLayout.phase.id,
        targetPhaseId: targetLayout.phase.id,
        pathD: d,
        color: sourceLayout.palette.hex,
      });
    });

    return { phaseLayouts: layouts, dependencyArrows: arrows };
  }, [phases, dragState, timelineStart, colWidth, rowHeight]);

  // Format today string for highlight badge
  const todayHighlightText = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  if (phases.length === 0) {
    return (
      <div className="text-center py-20 rounded-3xl border border-white/10 bg-white/[0.02]">
        <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-mono text-sm font-semibold">No Phases Added Yet</p>
        <p className="text-slate-500 font-mono text-xs mt-1">
          Click &quot;Add Phase&quot; above to start building your strategic roadmap
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar: Highlighted Current Date & Zoom Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-semibold text-white">Interactive Roadmap</span>
            <span className="text-slate-600">•</span>
            <span>{phases.length} Phases</span>
          </div>

          {/* Highlighted Full Current Date Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-xs text-indigo-300 font-mono shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-white">{todayHighlightText}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Scroll to Today Button */}
          {isTodayVisible && (
            <Button
              size="sm"
              variant="outline"
              onClick={scrollToToday}
              className="h-8 px-3 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Today</span>
            </Button>
          )}

          {/* View Mode Zoom Dropdown */}
          <div className="w-28">
            <Select value={viewMode} onValueChange={(val: any) => setViewMode(val as ViewMode)}>
              <SelectTrigger className="h-8 rounded-xl bg-white/5 border-white/15 text-xs text-white font-mono px-2.5">
                <div className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                  <span>{BASE_VIEW_MODE_CONFIG[viewMode].label}</span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-xl p-1 shadow-2xl z-[100] min-w-[120px] font-mono">
                <SelectItem value="day" className="text-xs font-mono rounded-lg cursor-pointer">
                  Day View
                </SelectItem>
                <SelectItem value="week" className="text-xs font-mono rounded-lg cursor-pointer">
                  Week View
                </SelectItem>
                <SelectItem value="month" className="text-xs font-mono rounded-lg cursor-pointer">
                  Month View
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Main Gantt Chart Grid Container (Natural Height, Horizontal Scroll for Dates) ── */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0d0d15] relative shadow-2xl custom-scrollbar"
      >
        <div style={{ width: Math.max(totalGridWidth + sidebarWidth, containerWidth) }} className="relative select-none">
          {/* ── Background SVG Layer for Normal / Inactive Dependency Connectors (Behind Bars, strictly on right canvas, z-10) ── */}
          <svg
            className="absolute top-0 pointer-events-none z-10 overflow-hidden"
            style={{
              left: sidebarWidth,
              width: totalGridWidth,
              height: headerHeight + phases.length * rowHeight,
            }}
          >
            <defs>
              <marker
                id="gantt-arrowhead-back"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 6 5 L 0 8 z" fill="#6366f1" opacity="0.6" />
              </marker>
            </defs>
            <g transform={`translate(0, ${headerHeight})`}>
              {dependencyArrows.map((arrow) => {
                const isHovered =
                  hoveredPhase &&
                  (hoveredPhase.phase.id === arrow.sourcePhaseId ||
                    hoveredPhase.phase.id === arrow.targetPhaseId);
                if (isHovered) return null; // Rendered in foreground layer on hover
                return (
                  <path
                    key={`back-${arrow.id}`}
                    d={arrow.pathD}
                    fill="none"
                    stroke={arrow.color}
                    strokeWidth="1.75"
                    strokeOpacity="0.55"
                    strokeDasharray="4 3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    markerEnd="url(#gantt-arrowhead-back)"
                    className="transition-opacity duration-150"
                  />
                );
              })}
            </g>
          </svg>

          {/* ── 2-TIER HEADER (With Frozen / Sticky Top-Left Corner) ── */}
          <div className="sticky top-0 z-40 flex bg-[#12121c] border-b border-white/10 backdrop-blur-xl">
            {/* Frozen Left Header Corner with Today Date Highlight (z-50) */}
            <div className="sticky left-0 z-50 w-[260px] shrink-0 px-4 py-3 border-r border-white/10 flex flex-col justify-center bg-[#12121c] shadow-xl">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Phase Timeline
                </span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 font-medium mt-0.5">
                {todayHighlightText}
              </span>
            </div>

            {/* Right Date Timeline Header */}
            <div className="relative flex-1" style={{ width: totalGridWidth, height: headerHeight }}>
              {/* TIER 1: Full Month Row */}
              <div className="absolute top-0 left-0 right-0 h-7 border-b border-white/5 flex">
                {monthHeaders.map((m, idx) => (
                  <div
                    key={`${m.monthName}-${m.year}-${idx}`}
                    className="absolute top-0 h-full flex items-center px-3 border-r border-white/10 bg-white/[0.02]"
                    style={{
                      left: m.startIndex * colWidth,
                      width: m.count * colWidth,
                    }}
                  >
                    <span className="text-xs font-mono font-semibold text-slate-200 whitespace-nowrap flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      {m.monthName} {m.year}
                    </span>
                  </div>
                ))}
              </div>

              {/* TIER 2: Day / Date Row with Jelas Highlighted Weekend */}
              <div className="absolute top-7 left-0 right-0 h-9 flex">
                {dayColumns.map((col, idx) => {
                  const isTodayCol = idx === todayOffsetDays;
                  return (
                    <div
                      key={col.dateStr}
                      className={`absolute top-0 h-full flex flex-col items-center justify-center border-r border-white/5 ${
                        col.isWeekend ? "bg-indigo-950/40 text-amber-300 font-semibold" : ""
                      } ${isTodayCol ? "bg-indigo-500/25" : ""}`}
                      style={{
                        left: idx * colWidth,
                        width: colWidth,
                      }}
                      title={`${col.weekdayInitial}, ${col.dateStr} ${col.isWeekend ? "(Weekend)" : ""}`}
                    >
                      {viewMode === "day" || colWidth >= 30 ? (
                        <>
                          <span
                            className={`text-[11px] font-mono font-bold leading-none ${
                              isTodayCol
                                ? "text-indigo-300 bg-indigo-500/40 px-1 py-0.5 rounded"
                                : col.isWeekend
                                ? "text-amber-300"
                                : "text-slate-300"
                            }`}
                          >
                            {String(col.dayNum).padStart(2, "0")}
                          </span>
                          <span
                            className={`text-[9px] font-mono mt-0.5 ${
                              col.isWeekend ? "text-amber-400/80 font-bold" : "text-slate-400"
                            }`}
                          >
                            {col.weekdayInitial}
                          </span>
                        </>
                      ) : (viewMode === "week" || colWidth >= 14) ? (
                        <span className={`text-[10px] font-mono ${col.isWeekend ? "text-amber-300" : "text-slate-400"}`}>
                          {col.dayNum % 7 === 1 ? col.dayNum : ""}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── GRID ROWS ── */}
          <div className="relative">
            {/* Background Column Grid & Clear Weekend Striping */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: sidebarWidth, width: totalGridWidth }}
            >
              {dayColumns.map((col, idx) => (
                <div
                  key={`bg-col-${col.dateStr}`}
                  className={`absolute top-0 bottom-0 border-r border-white/[0.04] ${
                    col.isWeekend ? "bg-indigo-950/25 border-r-indigo-900/30" : ""
                  }`}
                  style={{
                    left: idx * colWidth,
                    width: colWidth,
                  }}
                />
              ))}

              {/* Vertical TODAY Glowing Indicator Line - Mathematically centered with -translate-x-1/2 */}
              {isTodayVisible && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center -translate-x-1/2"
                  style={{
                    left: todayOffsetDays * colWidth + colWidth / 2,
                  }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,1)] ring-2 ring-indigo-300 ring-offset-1 ring-offset-[#0d0d15] -mt-1" />
                  <div className="w-[2px] flex-1 bg-gradient-to-b from-indigo-400 via-indigo-500/70 to-indigo-500/10 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                </div>
              )}
            </div>

            {/* Rows list with Frozen / Sticky Left Sidebar Columns */}
            {phaseLayouts.map((item) => {
              const { phase, palette, left, width, progress, dependsOn, isBeingDragged } = item;
              const isNarrow = width < 85;
              const durationDays = Math.max(1, daysDiff(item.start, item.end) + 1);

              return (
                <div
                  key={phase.id}
                  className="flex items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors relative"
                  style={{ height: rowHeight }}
                >
                  {/* Frozen Left Column: Phase Name & Status (Sticky left-0, z-40, solid background, click to scroll & expand) */}
                  <div
                    onClick={() => onPhaseSelect?.(phase.id)}
                    className="sticky left-0 z-40 w-[260px] shrink-0 px-3.5 py-2 border-r border-white/10 flex items-center justify-between gap-2 bg-[#0d0d15] shadow-xl select-none cursor-pointer hover:bg-white/[0.04] transition-colors group/row"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: palette.hex }}
                        />
                        <p className="text-xs text-white group-hover/row:text-indigo-300 font-mono font-medium truncate transition-colors">
                          {phase.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono whitespace-nowrap min-w-0 overflow-hidden">
                        <span className="truncate">{formatDateRange(phase.startDate, phase.endDate)}</span>
                        {dependsOn && (
                          <span
                            className="text-indigo-400/90 hover:text-indigo-300 shrink-0 flex items-center"
                            title={`Depends on: ${dependsOn.title}`}
                          >
                            <Link2 className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      className={`text-[9px] px-1.5 py-0.5 font-mono font-medium tracking-normal shrink-0 ${palette.bg} ${palette.border} ${palette.text}`}
                    >
                      {phase.status === "IN_PROGRESS"
                        ? "In Progress"
                        : phase.status === "PLANNED"
                        ? "Planned"
                        : phase.status === "DONE"
                        ? "Done"
                        : phase.status === "BLOCKED"
                        ? "Blocked"
                        : phase.status || "Planned"}
                    </Badge>
                  </div>

                  {/* Right Canvas: Gantt Bar with Drag / Resize / Progress Controls */}
                  <div className="relative flex-1" style={{ width: totalGridWidth, height: rowHeight }}>
                    {/* The Interactive Bar */}
                    <div
                      className={`group absolute rounded-2xl border transition-all duration-150 cursor-pointer active:cursor-grabbing select-none flex items-center overflow-hidden z-20 bg-[#0d0d15] ${
                        palette.barBg
                      } ${palette.barBorder} ${palette.glow} ${
                        isBeingDragged ? "shadow-2xl ring-2 ring-white/40 opacity-95 scale-[1.01]" : "hover:shadow-lg hover:brightness-110"
                      }`}
                      style={{
                        left,
                        width,
                        top: 11,
                        height: 34,
                      }}
                      onMouseDown={(e) => handlePointerDown(e, phase, "move", width)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        let isConcurrent = false;
                        if (dependsOn) {
                          const thisStart = parseDate(String(phase.startDate));
                          const depEnd = parseDate(String(dependsOn.endDate));
                          if (thisStart && depEnd && thisStart.getTime() < depEnd.getTime()) {
                            isConcurrent = true;
                          }
                        }
                        setHoveredPhase({
                          phase,
                          x: rect.right + 10,
                          y: rect.top,
                          palette,
                          dependsOnName: dependsOn?.title,
                          isConcurrent,
                        });
                      }}
                      onMouseLeave={() => setHoveredPhase(null)}
                    >
                      {/* Left Resize Handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handlePointerDown(e, phase, "resize-left", width)}
                        title="Drag to adjust Start Date"
                      >
                        <div className="w-1 h-3.5 rounded-full bg-white/70" />
                      </div>

                      {/* Progress Fill Background */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 transition-all duration-150 pointer-events-none ${palette.progressBg}`}
                        style={{ width: `${progress}%` }}
                      />

                      {/* Draggable Progress Handle Knob (Only for manual phases, not auto-calculated tasks) */}
                      {!((phase as any).isAutoCalculated) && (
                        <div
                          className="absolute top-0 bottom-0 w-3.5 -ml-1.5 cursor-ew-resize hover:scale-110 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          style={{ left: `${progress}%` }}
                          onMouseDown={(e) => handlePointerDown(e, phase, "progress", width)}
                          title="Drag to update completion %"
                        >
                          <div className="w-2.5 h-6 rounded-full bg-white shadow-md border border-slate-700/50" />
                        </div>
                      )}

                      {/* Right Resize Handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handlePointerDown(e, phase, "resize-right", width)}
                        title="Drag to adjust End Date"
                      >
                        <div className="w-1 h-3.5 rounded-full bg-white/70" />
                      </div>

                      {/* Phase Title Inside Bar (Hidden on very tiny width) */}
                      <span className="relative z-10 px-3 text-[11px] font-mono text-white font-medium truncate pointer-events-none drop-shadow-sm">
                        {phase.title}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Foreground SVG Layer for Active / Hovered Dependency Connectors (In Front of Bars, strictly on right canvas, z-30) ── */}
          {hoveredPhase && (
            <svg
              className="absolute top-0 pointer-events-none z-30 overflow-hidden"
              style={{
                left: sidebarWidth,
                width: totalGridWidth,
                height: headerHeight + phases.length * rowHeight,
              }}
            >
              <defs>
                <marker
                  id="gantt-arrowhead-front"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#c7d2fe" />
                </marker>
                <filter id="glow-arrow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#818cf8" floodOpacity="0.9" />
                </filter>
              </defs>
              <g transform={`translate(0, ${headerHeight})`}>
                {dependencyArrows
                  .filter(
                    (arrow) =>
                      hoveredPhase.phase.id === arrow.sourcePhaseId ||
                      hoveredPhase.phase.id === arrow.targetPhaseId
                  )
                  .map((arrow) => (
                    <path
                      key={`front-${arrow.id}`}
                      d={arrow.pathD}
                      fill="none"
                      stroke={arrow.color}
                      strokeWidth="2.5"
                      strokeOpacity="1"
                      strokeDasharray="5 3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      filter="url(#glow-arrow)"
                      markerEnd="url(#gantt-arrowhead-front)"
                      className="transition-all duration-150 animate-pulse"
                    />
                  ))}
              </g>
            </svg>
          )}
        </div>
      </div>

      {/* ── Floating Hover Tooltip (Safely clamped inside right canvas) ── */}
      {hoveredPhase && !dragState && (
        <div
          className="fixed z-50 pointer-events-none p-3.5 rounded-2xl bg-[#12111d]/95 border border-white/15 text-white font-mono shadow-2xl backdrop-blur-xl max-w-xs animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.max(sidebarWidth + 20, Math.min(hoveredPhase.x, window.innerWidth - 300)),
            top: Math.min(hoveredPhase.y, window.innerHeight - 150),
            borderColor: hoveredPhase.palette.hex,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: hoveredPhase.palette.hex }}
            />
            <h4 className="font-bold text-xs truncate text-white">{hoveredPhase.phase.title}</h4>
          </div>
          {(hoveredPhase.phase as any).description && (
            <p className="text-[10px] text-slate-300 line-clamp-2 mb-1.5 font-sans leading-relaxed">
              {(hoveredPhase.phase as any).description}
            </p>
          )}
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>
              {formatPrettyDate(hoveredPhase.phase.startDate)} &rarr; {formatPrettyDate(hoveredPhase.phase.endDate)}
            </span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10 mt-1 gap-3">
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400">Status:</span>
              <span className="font-semibold text-white">
                {hoveredPhase.phase.status === "IN_PROGRESS"
                  ? "In Progress"
                  : hoveredPhase.phase.status === "PLANNED"
                  ? "Planned"
                  : hoveredPhase.phase.status === "DONE"
                  ? "Done"
                  : hoveredPhase.phase.status === "BLOCKED"
                  ? "Blocked"
                  : hoveredPhase.phase.status || "Planned"}
              </span>
            </span>
            <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px]">
              {(hoveredPhase.phase as any).progress ?? 0}% done
            </span>
          </div>
          {hoveredPhase.dependsOnName && (
            <div className="pt-1.5 border-t border-white/5 mt-1 flex items-center justify-between gap-2 text-[10px]">
              <span className="text-indigo-300 flex items-center gap-1 truncate">
                <Link2 className="w-3 h-3 shrink-0 text-indigo-400" />
                <span className="truncate">Depends on: {hoveredPhase.dependsOnName}</span>
              </span>
              {hoveredPhase.isConcurrent ? (
                <span className="text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0">
                  ⚡ Concurrent
                </span>
              ) : (
                <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0">
                  ✓ Sequential
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Active Drag / Resize / Progress HUD ── */}
      {dragState && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#14141e]/95 border border-indigo-500/40 text-white font-mono shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in zoom-in-95">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Move className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-300">
              {dragState.mode === "move"
                ? "Shifting Phase Dates"
                : dragState.mode === "resize-left"
                ? "Adjusting Start Date"
                : dragState.mode === "resize-right"
                ? "Adjusting End Date"
                : "Adjusting Completion Progress"}
            </p>
            {dragState.mode === "progress" ? (
              <p className="text-[11px] text-slate-300 mt-0.5">
                Progress: <span className="text-emerald-400 font-bold">{dragState.currentProgress}%</span> completed
              </p>
            ) : (
              <p className="text-[11px] text-slate-300 mt-0.5">
                {formatPrettyDate(dragState.currentStartDate)} &rarr;{" "}
                {formatPrettyDate(dragState.currentEndDate)} (
                {Math.max(1, daysDiff(dragState.currentStartDate, dragState.currentEndDate) + 1)}{" "}
                days)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
