"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Sparkles,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Settings,
  Zap,
  CheckSquare,
  Trash2,
  Edit3,
  Sun,
  Moon,
  Coffee,
  Briefcase,
  Heart,
  Loader2,
  X,
  Compass,
  Activity,
  ArrowRight,
  CornerDownRight,
  Flame,
  LayoutGrid,
  Disc,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GlassTimePicker } from "@/components/ui/glass-time-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRoutineForDateAction,
  updateTimeblockAction,
  createTimeblockAction,
  deleteTimeblockAction,
  suppressMasterRoutineSlotAction,
  resetDayToMasterRoutineAction,
  getDailyHabitsForDateAction,
  toggleDailyHabitAction,
  addDailyHabitAction,
  updateDailyHabitAction,
  deleteDailyHabitAction,
  getActiveKanbanTasksAction,
  getActivitySuggestionsAction,
  getMasterRoutinesAction,
  saveMasterRoutineAction,
  deleteMasterRoutineAction,
  checkNextDayTimeConflictAction,
  checkMasterTemplateConflictAction,
  DayProfileType,
} from "@/app/routine/actions";

interface TimeblockItem {
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
  originalStartTime?: string;
  originalDate?: string;
  isCustom?: boolean;
  masterRoutineId?: number | null;
}

interface HabitItem {
  id: number;
  title: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isCompleted: boolean;
}

interface KanbanTaskItem {
  id: number;
  title: string;
  priority: string;
  status: string;
  projectId: number | null;
  projectName: string | null;
}

// Category visual palette configuration
const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    glow: string;
    color: string;
    icon: any;
  }
> = {
  DEEP_WORK: {
    label: "Deep Work",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    glow: "shadow-purple-500/20",
    color: "#a855f7",
    icon: Zap,
  },
  BUSINESS: {
    label: "Business",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    glow: "shadow-amber-500/20",
    color: "#f59e0b",
    icon: Briefcase,
  },
  HEALTH: {
    label: "Health / Meals",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    glow: "shadow-emerald-500/20",
    color: "#10b981",
    icon: Heart,
  },
  PRAYER: {
    label: "Prayer",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
    text: "text-yellow-300",
    glow: "shadow-yellow-500/20",
    color: "#eab308",
    icon: Sun,
  },
  MEETING: {
    label: "Meeting",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    glow: "shadow-blue-500/20",
    color: "#3b82f6",
    icon: Coffee,
  },
  ROUTINE: {
    label: "Routine",
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/10",
    text: "text-indigo-300",
    glow: "shadow-indigo-500/20",
    color: "#6366f1",
    icon: Clock,
  },
};

const QUICK_PRESETS = [
  { title: "Deep Work: Core Feature", category: "DEEP_WORK", icon: Zap },
  { title: "Architecture & System Design", category: "DEEP_WORK", icon: Zap },
  { title: "Project Sprint & Execution", category: "BUSINESS", icon: Briefcase },
  { title: "Client & Team Sync", category: "MEETING", icon: Briefcase },
  { title: "Skill Study & Practice", category: "DEEP_WORK", icon: Sparkles },
  { title: "Subuh & Morning Walk", category: "HEALTH", icon: Heart },
  { title: "Lunch & Midday Reset", category: "HEALTH", icon: Coffee },
  { title: "Workout & Physical Training", category: "HEALTH", icon: Activity },
  { title: "Evening Review & Plan", category: "ROUTINE", icon: RotateCcw },
  { title: "Sleep & Deep Recovery", category: "ROUTINE", icon: Moon },
];

// Helper: Get YYYY-MM-DD string for a Date (in local timezone)
function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: Convert "HH:mm" to total minutes
function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

// Helper: Calculate duration label e.g. "1.5h" or "45m"
function getDurationLabel(startStr: string, endStr: string): string {
  const start = timeToMinutes(startStr);
  let end = timeToMinutes(endStr);
  if (end <= start) end += 1440;
  const diff = Math.max(0, end - start);
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// Helper: Check for time conflicts/collisions between an interval and existing slots
interface CollisionResult {
  hasConflict: boolean;
  conflictingSlot: {
    id?: number | null;
    title: string;
    startTime: string;
    endTime: string;
  } | null;
  message?: string;
}

function checkTimeConflict(
  startTime: string,
  endTime: string,
  existingSlots: Array<{ id?: number | null; title: string; startTime: string; endTime: string; isCarryOverFromYesterday?: boolean }>,
  currentId?: number | null,
  isCarryOverAware: boolean = false
): CollisionResult {
  if (!startTime || !endTime) return { hasConflict: false, conflictingSlot: null };
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);

  if (s === e) {
    return {
      hasConflict: true,
      conflictingSlot: null,
      message: "Start time and End time cannot be identical (duration is 0 minutes).",
    };
  }

  // Decompose input into segments (handles cross-midnight intervals e.g. 23:00 - 05:00)
  const inputSegments =
    e > s
      ? [{ start: s, end: e }]
      : isCarryOverAware
      ? [{ start: s, end: 1440 }] // On origin date, overnight slot only occupies s -> 1440. [0, e] is checked on tomorrow!
      : [
          { start: s, end: 1440 },
          { start: 0, end: e },
        ];

  for (const slot of existingSlots) {
    if (currentId && slot.id === currentId) continue;
    const sOther = timeToMinutes(slot.startTime);
    const eOther = timeToMinutes(slot.endTime);
    if (sOther === eOther) continue;

    const otherSegments =
      eOther > sOther
        ? [{ start: sOther, end: eOther }]
        : isCarryOverAware
        ? [{ start: sOther, end: 1440 }] // Existing overnight slot on origin date only occupies sOther -> 1440
        : [
            { start: sOther, end: 1440 },
            { start: 0, end: eOther },
          ];

    for (const segA of inputSegments) {
      for (const segB of otherSegments) {
        if (Math.max(segA.start, segB.start) < Math.min(segA.end, segB.end)) {
          return {
            hasConflict: true,
            conflictingSlot: slot,
            message: `Time conflict: Overlaps with "${slot.title}" (${slot.startTime} - ${slot.endTime}).`,
          };
        }
      }
    }
  }

  return { hasConflict: false, conflictingSlot: null };
}

// Helper: Determine if a slot is related to Project Hub or Skill Matrix
function getSlotSourceType(
  slot?: { title?: string; taskId?: number | null; projectName?: string | null } | null
): "PROJECT" | "SKILL" | "STANDARD" {
  if (!slot || !slot.title) return "STANDARD";
  const t = slot.title.toLowerCase();
  if (slot.taskId || slot.projectName || t.startsWith("project:") || t.startsWith("[project]")) {
    return "PROJECT";
  }
  if (t.startsWith("skill:") || t.startsWith("[skill]")) {
    return "SKILL";
  }
  return "STANDARD";
}

// Polar to Cartesian for SVG
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// Describe annular wedge sector (donut slice)
function describeWedge(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startAngleDeg: number,
  endAngleDeg: number
) {
  let sweep = endAngleDeg - startAngleDeg;
  if (sweep < 0) sweep += 360;
  if (sweep >= 360) sweep = 359.99;
  if (sweep <= 0.1) return "";

  const a1 = ((startAngleDeg - 90) * Math.PI) / 180;
  const a2 = (((startAngleDeg - 90) + sweep) * Math.PI) / 180;

  const p1Out = { x: cx + rOut * Math.cos(a1), y: cy + rOut * Math.sin(a1) };
  const p2Out = { x: cx + rOut * Math.cos(a2), y: cy + rOut * Math.sin(a2) };
  const p2In = { x: cx + rIn * Math.cos(a2), y: cy + rIn * Math.sin(a2) };
  const p1In = { x: cx + rIn * Math.cos(a1), y: cy + rIn * Math.sin(a1) };

  const largeArc = sweep > 180 ? 1 : 0;

  return [
    "M", p1Out.x, p1Out.y,
    "A", rOut, rOut, 0, largeArc, 1, p2Out.x, p2Out.y,
    "L", p2In.x, p2In.y,
    "A", rIn, rIn, 0, largeArc, 0, p1In.x, p1In.y,
    "Z",
  ].join(" ");
}

// Calculate animated growth progress for a circular sector using authentic Damped Harmonic Spring physics
function getSectorProgress(globalProgress: number, startMin: number): number {
  if (globalProgress <= 0) return 0;
  if (globalProgress >= 1) return 1;

  // Stagger wave across 24 hours: wave front sweeps through first 38% of duration
  const norm = (startMin % 1440) / 1440;
  const startAt = norm * 0.38;
  const sectorDuration = 0.62; // each sector gets 62% of time to complete its full spring cycle

  if (globalProgress <= startAt) return 0;
  const localT = (globalProgress - startAt) / sectorDuration;

  if (localT >= 1) return 1;

  // Authentic Damped Harmonic Spring (mass-spring-damper step response with zero initial velocity):
  // x(t) = 1 - e^(-γ*t) * (cos(ω*t) + (γ/ω)*sin(ω*t))
  // With γ = 4.1, ω = 7.5:
  // - Starts at 0 with exact zero initial velocity (smooth liftoff, zero jerk)
  // - Surges upward and overshoots target by +18.0% at localT = 0.419
  // - Rebounds down to -3.2% gentle dip at localT = 0.838
  // - Lands softly on 1.000 at localT = 1.0 via cubic Hermite blend
  const gamma = 4.1;
  const omega = 7.5;
  const decay = Math.exp(-gamma * localT);
  const osc = Math.cos(omega * localT) + (gamma / omega) * Math.sin(omega * localT);
  let spring = 1 - decay * osc;

  if (localT > 0.84) {
    const u = (localT - 0.84) / 0.16;
    const blend = u * u * (3 - 2 * u);
    spring = spring * (1 - blend) + 1.0 * blend;
  }

  return Math.max(0, spring);
}

// Calculate dynamic stepped heights based on Category Importance (Option A) & Duration Momentum (Option B)
interface WedgeSegment {
  startMin: number;
  endMin: number;
  radius: number;
  opacity: number;
}

function getBlockSegments(
  startTimeStr: string,
  endTimeStr: string,
  category: string,
  isNow: boolean,
  isHovered: boolean,
  srcType: string
): WedgeSegment[] {
  const startMin = timeToMinutes(startTimeStr);
  const rawEnd = timeToMinutes(endTimeStr);
  // For today's wheel representation, an overnight task starting tonight only spans up to 1440 (midnight).
  // The continuation [0, rawEnd] is rendered on tomorrow's wheel via the carryover instance!
  const isOvernight = rawEnd <= startMin && rawEnd > 0;
  const endMin = isOvernight ? 1440 : (rawEnd <= startMin ? rawEnd + 1440 : rawEnd);
  const duration = Math.max(0, endMin - startMin);

  const isSpecial = srcType === "PROJECT" || srcType === "SKILL";

  // Tier 1 (Peak / Strategic Focus): DEEP_WORK, BUSINESS
  // Tier 2 (Focus / Sacred / Collab): PRAYER, MEETING
  // Tier 3 (Recharge / Maintenance): HEALTH, ROUTINE
  let baseRadius = 152;
  switch (category) {
    case "DEEP_WORK":
      baseRadius = 175;
      break;
    case "BUSINESS":
      baseRadius = 173;
      break;
    case "PRAYER":
      baseRadius = 168;
      break;
    case "MEETING":
      baseRadius = 164;
      break;
    case "HEALTH":
      baseRadius = 158;
      break;
    case "ROUTINE":
    default:
      baseRadius = 152;
      break;
  }
  if (isSpecial) baseRadius = Math.min(184, baseRadius + 4);

  // Active / hovered elevation
  const boost = isNow || isHovered ? 8 : 0;

  // Duration scaling & stair-step crescendo (Option B)
  if (duration <= 60) {
    // Single segment (1 hour or less)
    return [
      {
        startMin,
        endMin,
        radius: Math.min(189, baseRadius + boost),
        opacity: 0.9,
      },
    ];
  } else if (duration <= 120) {
    // 2 segments: Hour 1 (ramp-up) + Hour 2 (peak)
    return [
      {
        startMin,
        endMin: startMin + 60,
        radius: Math.min(189, baseRadius - 10 + boost),
        opacity: 0.72,
      },
      {
        startMin: startMin + 60,
        endMin,
        radius: Math.min(189, baseRadius + 3 + boost),
        opacity: 0.95,
      },
    ];
  } else {
    // 3 segments: Hour 1 (ramp-up) + Hour 2 (flow) + Hour 3+ (peak)
    return [
      {
        startMin,
        endMin: startMin + 60,
        radius: Math.min(189, baseRadius - 14 + boost),
        opacity: 0.68,
      },
      {
        startMin: startMin + 60,
        endMin: startMin + 120,
        radius: Math.min(189, baseRadius - 4 + boost),
        opacity: 0.82,
      },
      {
        startMin: startMin + 120,
        endMin,
        radius: Math.min(189, baseRadius + 6 + boost),
        opacity: 0.98,
      },
    ];
  }
}

/**
 * Ultra-smooth, hardware-accelerated floating tooltip portalled directly to document.body.
 * Tracks the cursor at 120+ FPS using an internal RAF loop with continuous velocity Lerp.
 * ZERO re-renders of the parent component on mousemove, zero layout reflow, and zero CSS transition lag.
 */
function FloatingPortalTooltip({
  initialX,
  initialY,
  minWidth = 190,
  maxWidth,
  clampPad = 130,
  children,
  className,
}: {
  initialX: number;
  initialY: number;
  minWidth?: number;
  maxWidth?: number;
  clampPad?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);

  const clampX = useCallback(
    (rawX: number) => {
      if (typeof window === "undefined") return rawX;
      return Math.min(window.innerWidth - clampPad, Math.max(clampPad, rawX));
    },
    [clampPad]
  );

  const clampY = useCallback((rawY: number) => {
    if (typeof window === "undefined") return rawY;
    return Math.max(90, Math.min(window.innerHeight - 45, rawY));
  }, []);

  const initX = clampX(initialX);
  const initY = clampY(initialY);

  const targetPos = useRef({ x: initX, y: initY });
  const currentPos = useRef({ x: initX, y: initY });
  const rafId = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const ix = clampX(initialX);
    const iy = clampY(initialY);
    currentPos.current = { x: ix, y: iy };
    targetPos.current = { x: ix, y: iy };
    el.style.transform = `translate3d(${ix}px, ${iy}px, 0) translate(-50%, -125%)`;

    let isRunning = false;

    const renderLoop = () => {
      const node = divRef.current;
      if (!node) {
        isRunning = false;
        return;
      }

      const tx = targetPos.current.x;
      const ty = targetPos.current.y;

      const dx = tx - currentPos.current.x;
      const dy = ty - currentPos.current.y;
      const dist = Math.hypot(dx, dy);

      // Adaptive liquid Lerp: factor 0.38 for buttery-smooth gliding, 0.62 for rapid cursor flicks
      const factor = dist > 140 ? 0.62 : 0.38;
      currentPos.current.x += dx * factor;
      currentPos.current.y += dy * factor;

      node.style.transform = `translate3d(${currentPos.current.x.toFixed(1)}px, ${currentPos.current.y.toFixed(1)}px, 0) translate(-50%, -125%)`;

      if (Math.abs(tx - currentPos.current.x) > 0.15 || Math.abs(ty - currentPos.current.y) > 0.15) {
        rafId.current = requestAnimationFrame(renderLoop);
      } else {
        currentPos.current.x = tx;
        currentPos.current.y = ty;
        node.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -125%)`;
        isRunning = false;
        rafId.current = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      targetPos.current.x = clampX(e.clientX);
      targetPos.current.y = clampY(e.clientY);
      if (!isRunning) {
        isRunning = true;
        rafId.current = requestAnimationFrame(renderLoop);
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      isRunning = false;
    };
  }, [clampPad, clampX, clampY, initialX, initialY]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={divRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        transform: `translate3d(${initX}px, ${initY}px, 0) translate(-50%, -125%)`,
        zIndex: 99999,
        pointerEvents: "none",
        willChange: "transform",
      }}
    >
      <div
        style={{
          minWidth: minWidth ? `${minWidth}px` : undefined,
          maxWidth: maxWidth ? `${maxWidth}px` : undefined,
        }}
        className={cn(
          "animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950/95 border border-white/20 shadow-2xl backdrop-blur-xl text-white font-mono select-none",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DailyRoutineTracker() {
  // Current calendar date string (reactive: auto-advances at midnight without page reload)
  const [todayStr, setTodayStr] = useState<string>(() => getTodayDateString());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [dayProfile, setDayProfile] = useState<DayProfileType>("WEEKDAY");
  const [timeblocks, setTimeblocks] = useState<TimeblockItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Entrance animation progress for 24H chart wedge heights (0 -> 1)
  const [heightProgress, setHeightProgress] = useState(0);

  // View Mode: 'WHEEL' (24H Circular Infographic Wheel) or 'TIMELINE_SPAN' (Connected 24H Timeline Grid)
  const [viewMode, setViewMode] = useState<"WHEEL" | "TIMELINE_SPAN">("WHEEL");

  // Live time ticker for real-time indicator
  const [nowTime, setNowTime] = useState<string>("00:00:00");
  const [nowMinutes, setNowMinutes] = useState<number>(0);

  // Hovered slot on the dial or stream
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);

  // Connector lines: measured from DOM, spans the 3-panel grid overlay SVG
  const wheelGridRef = useRef<HTMLDivElement>(null);
  const wheelCenterRef = useRef<HTMLDivElement>(null);
  const wheelSvgRef = useRef<SVGSVGElement>(null);
  const clockBadgeRef = useRef<HTMLSpanElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const leftCardEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const rightCardEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollAnimRef = useRef<number | null>(null);
  const measureRef = useRef<() => void>(() => {});
  const [clockBadgeRect, setClockBadgeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [connectorLines, setConnectorLines] = useState<
    Array<{
      id: number;
      x1: number; y1: number; // card edge point
      x2: number; y2: number; // rim point on wheel
      pathD: string;          // angled chamfered SVG path
      color: string;
      side: "left" | "right";
      isActive: boolean;
      animDelay: number;
    }>
  >([]);
  // Entrance animation trigger key (increments to replay animations even when clicking current date)
  const [animKey, setAnimKey] = useState(0);
  const [hasIntroFinished, setHasIntroFinished] = useState(false);
  const hoveredSlotIdRef = useRef<number | null>(null);

  useEffect(() => {
    hoveredSlotIdRef.current = hoveredSlotId;
  }, [hoveredSlotId]);

  useEffect(() => {
    setHasIntroFinished(false);
    const timer = setTimeout(() => {
      setHasIntroFinished(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, [selectedDate, animKey]);

  // Custom tooltips state (Wheel free/unscheduled slot & Top ribbon bar)
  const [wheelFreeTooltip, setWheelFreeTooltip] = useState<{
    x: number;
    y: number;
    startStr: string;
    endStr: string;
    durationLabel: string;
    isNowFree: boolean;
  } | null>(null);

  const [ribbonTooltip, setRibbonTooltip] = useState<{
    x: number;
    y: number;
    block?: TimeblockItem;
    freeInfo?: {
      startStr: string;
      endStr: string;
      durationLabel: string;
      isNowFree: boolean;
    };
  } | null>(null);


  // Modals state
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Partial<TimeblockItem> | null>(
    null
  );
  const [slotToDelete, setSlotToDelete] = useState<TimeblockItem | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const [isKanbanDrawerOpen, setIsKanbanDrawerOpen] = useState(false);
  const [targetSlotForTask, setTargetSlotForTask] =
    useState<TimeblockItem | null>(null);

  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [masterProfileTab, setMasterProfileTab] =
    useState<DayProfileType>("WEEKDAY");
  const [masterRoutines, setMasterRoutines] = useState<any[]>([]);

  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [editingHabitTitle, setEditingHabitTitle] = useState("");
  const [habitToDelete, setHabitToDelete] = useState<HabitItem | null>(null);

  // Action Submission & Pending Guards (Prevents rapid double-clicks & double submissions)
  const isSubmittingRef = useRef(false);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [isDeletingSlot, setIsDeletingSlot] = useState(false);
  const [isResettingDay, setIsResettingDay] = useState(false);
  const [isSavingMasterSlot, setIsSavingMasterSlot] = useState(false);
  const [isDeletingMasterSlot, setIsDeletingMasterSlot] = useState(false);
  const [isSavingHabit, setIsSavingHabit] = useState(false);
  const [isUpdatingHabit, setIsUpdatingHabit] = useState(false);
  const [isDeletingHabit, setIsDeletingHabit] = useState(false);

  // Activity title suggestions (Projects from ProjectHub & Skills from Skill Matrix)
  const [projectSuggestions, setProjectSuggestions] = useState<
    Array<{ id: number; name: string; status: string }>
  >([]);
  const [skillSuggestions, setSkillSuggestions] = useState<
    Array<{ id: number; title: string; category: string; proficiency: string }>
  >([]);
  const [activeSuggestionTab, setActiveSuggestionTab] = useState<
    "ALL" | "PROJECTS" | "SKILLS" | "PRESETS"
  >("ALL");

  // Master Routine direct editing state
  const [editingMasterSlot, setEditingMasterSlot] = useState<{
    id: number | null;
    dayProfile: DayProfileType;
    startTime: string;
    endTime: string;
    title: string;
    category: string;
  } | null>(null);
  const [isMasterSlotDialogOpen, setIsMasterSlotDialogOpen] = useState(false);
  const [masterSlotToDelete, setMasterSlotToDelete] = useState<{
    id: number;
    title: string;
  } | null>(null);

  // Cross-Day next-day schedule collision detection state
  const [nextDayConflict, setNextDayConflict] = useState<{
    hasConflict: boolean;
    message?: string;
    conflictingSlot?: any;
  }>({ hasConflict: false });

  const [masterNextDayConflict, setMasterNextDayConflict] = useState<{
    hasConflict: boolean;
    message?: string;
    conflictingSlot?: any;
  }>({ hasConflict: false });

  // Load project & skill suggestions on mount
  useEffect(() => {
    async function fetchSuggestions() {
      const res = await getActivitySuggestionsAction();
      if (res.success) {
        if (res.projects) setProjectSuggestions(res.projects);
        if (res.skills) setSkillSuggestions(res.skills);
      }
    }
    fetchSuggestions();
  }, []);

  // Update live time every second and automatically detect midnight rollover to advance day
  useEffect(() => {
    const updateTimeAndCheckMidnight = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setNowTime(`${h}:${m}:${s}`);
      setNowMinutes(now.getHours() * 60 + now.getMinutes());

      // Check if calendar date rolled over past midnight
      const currentCalDate = getTodayDateString(now);
      setTodayStr((prevToday) => {
        if (prevToday !== currentCalDate) {
          // Midnight has passed! Advance selectedDate if user was watching "today"
          setSelectedDate((prevSelected) => {
            if (prevSelected === prevToday) {
              return currentCalDate;
            }
            return prevSelected;
          });
          return currentCalDate;
        }
        return prevToday;
      });
    };

    updateTimeAndCheckMidnight();
    const interval = setInterval(updateTimeAndCheckMidnight, 1000);

    // Also trigger check when device/tab wakes up or becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateTimeAndCheckMidnight();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const isSelectedToday = selectedDate === todayStr;

  // Load Routine & Habits for Selected Date
  const loadData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const [routineRes, habitsRes, kanbanRes] = await Promise.all([
        getRoutineForDateAction(date),
        getDailyHabitsForDateAction(date),
        getActiveKanbanTasksAction(),
      ]);

      if (routineRes.success) {
        setTimeblocks(routineRes.timeblocks as TimeblockItem[]);
        setDayProfile(routineRes.dayProfile as DayProfileType);
        if (routineRes.masterRoutines) {
          setMasterRoutines(routineRes.masterRoutines);
        }
      }
      if (habitsRes.success) {
        setHabits(habitsRes.habits as HabitItem[]);
      }
      if (kanbanRes.success) {
        setKanbanTasks(kanbanRes.tasks as KanbanTaskItem[]);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("routine-updated"));
      }
    } catch (err) {
      console.error("[loadData Error]:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  // Radial Chart Wedges Height Entrance Animation (0 -> 1 with elastic wave)
  useEffect(() => {
    if (viewMode !== "WHEEL" || isLoading) return;

    setHeightProgress(0);
    let start: number | null = null;
    const duration = 820;
    let rafId: number;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      setHeightProgress(progress);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    const timer = setTimeout(() => {
      rafId = requestAnimationFrame(step);
    }, 40);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
    };
  }, [selectedDate, viewMode, isLoading, animKey]);

  // Date navigation helpers
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const formattedDateHeader = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDate]);

  // Only slots that are custom-added or modified from Master Protocol template
  const customSlotsToClear = useMemo(() => {
    return timeblocks.filter((slot) => {
      if (slot.isCarryOverFromYesterday) return false;
      if (typeof slot.isCustom === "boolean") return slot.isCustom;
      const isMaster = masterRoutines.some(
        (m) =>
          m.startTime === slot.startTime &&
          m.endTime === slot.endTime &&
          m.title.trim().toLowerCase() === slot.title.trim().toLowerCase() &&
          m.category === slot.category &&
          !slot.taskId &&
          (!slot.notes || slot.notes.trim() === "")
      );
      return !isMaster;
    });
  }, [timeblocks, masterRoutines]);

  // Check slot states relative to clock
  const getSlotTimingState = useCallback(
    (startTime: string, endTime: string) => {
      const s = timeToMinutes(startTime);
      const e = timeToMinutes(endTime);

      if (isSelectedToday) {
        if (s < e) {
          if (nowMinutes >= s && nowMinutes < e) return "ACTIVE";
          if (nowMinutes >= e) return "PAST";
          return "UPCOMING";
        } else {
          // Crosses midnight (e.g. 23:00 - 00:30)
          if (nowMinutes >= s || nowMinutes < e) return "ACTIVE";
          if (nowMinutes >= e && nowMinutes < s) return "UPCOMING";
          return "PAST";
        }
      }
      if (selectedDate < todayStr) return "PAST";
      return "UPCOMING";
    },
    [isSelectedToday, nowMinutes, selectedDate, todayStr]
  );

  // Active slot (if any right now)
  const currentActiveSlot = useMemo(() => {
    if (!isSelectedToday) return null;
    return timeblocks.find((b) => {
      const s = timeToMinutes(b.startTime);
      const e = timeToMinutes(b.endTime);
      if (s < e) {
        return nowMinutes >= s && nowMinutes < e;
      } else {
        // Crosses midnight (e.g. 23:00 - 00:30)
        return nowMinutes >= s || nowMinutes < e;
      }
    });
  }, [isSelectedToday, nowMinutes, timeblocks]);

  // Next upcoming slot (if currently free)
  const nextUpcomingSlot = useMemo(() => {
    if (!isSelectedToday) return null;
    return timeblocks.find((b) => {
      const s = timeToMinutes(b.startTime);
      return s > nowMinutes;
    });
  }, [isSelectedToday, nowMinutes, timeblocks]);

  // Stats calculation
  const stats = useMemo(() => {
    let totalScheduledMin = 0;
    const catMinutes: Record<string, number> = {
      DEEP_WORK: 0,
      BUSINESS: 0,
      HEALTH: 0,
      PRAYER: 0,
      MEETING: 0,
      ROUTINE: 0,
    };

    let activeCount = 0;
    let pastCount = 0;
    let upcomingCount = 0;

    for (const b of timeblocks) {
      const s = timeToMinutes(b.startTime);
      let e = timeToMinutes(b.endTime);
      if (e <= s) e += 1440;
      const dur = Math.max(0, e - s);
      totalScheduledMin += dur;

      if (catMinutes[b.category] !== undefined) {
        catMinutes[b.category] += dur;
      } else {
        catMinutes.ROUTINE += dur;
      }

      const st = getSlotTimingState(b.startTime, b.endTime);
      if (st === "ACTIVE") activeCount++;
      else if (st === "PAST") pastCount++;
      else upcomingCount++;
    }

    return {
      totalScheduledHours: (totalScheduledMin / 60).toFixed(1),
      catMinutes,
      activeCount,
      pastCount,
      upcomingCount,
    };
  }, [timeblocks, getSlotTimingState]);

  // Connected 4-Column Time Windows (6 Hours each = 360 Minutes per column)
  const timelineColumns = useMemo(() => {
    return [
      {
        id: "col-1",
        title: "Night & Early Morning",
        range: "00:00 - 06:00",
        startMin: 0,
        endMin: 360,
        icon: Moon,
        color: "#818cf8",
        badgeBg: "bg-indigo-500/10 text-indigo-300",
        hours: [0, 1, 2, 3, 4, 5],
      },
      {
        id: "col-2",
        title: "Morning & Focus",
        range: "06:00 - 12:00",
        startMin: 360,
        endMin: 720,
        icon: Sun,
        color: "#f59e0b",
        badgeBg: "bg-amber-500/10 text-amber-300",
        hours: [6, 7, 8, 9, 10, 11],
      },
      {
        id: "col-3",
        title: "Afternoon & Execution",
        range: "12:00 - 18:00",
        startMin: 720,
        endMin: 1080,
        icon: Zap,
        color: "#38bdf8",
        badgeBg: "bg-sky-500/10 text-sky-300",
        hours: [12, 13, 14, 15, 16, 17],
      },
      {
        id: "col-4",
        title: "Evening & Reset",
        range: "18:00 - 24:00",
        startMin: 1080,
        endMin: 1440,
        icon: Coffee,
        color: "#a855f7",
        badgeBg: "bg-purple-500/10 text-purple-300",
        hours: [18, 19, 20, 21, 22, 23],
      },
    ];
  }, []);

  // 24-Hour Circular Wheel Data (24 hours sectors matching reference image)
  const wheelHours = useMemo(() => {
    const list: Array<{
      hour: number;
      label: string;
      matchingBlock: TimeblockItem | null;
      isNow: boolean;
    }> = [];

    for (let h = 0; h < 24; h++) {
      const hStart = h * 60;
      const hEnd = (h + 1) * 60;

      // Find primary block that overlaps with this hour
      const matching =
        timeblocks.find((b) => {
          const s = timeToMinutes(b.startTime);
          const e = timeToMinutes(b.endTime);
          if (s < e) {
            return s < hEnd && e > hStart;
          } else if (s > e) {
            // On origin day, an overnight task spans s -> 1440
            return s < hEnd && 1440 > hStart;
          }
          return false;
        }) || null;

      list.push({
        hour: h,
        label: `${h}:00`,
        matchingBlock: matching,
        isNow: isSelectedToday && Math.floor(nowMinutes / 60) === h,
      });
    }

    return list;
  }, [timeblocks, isSelectedToday, nowMinutes]);

  // Calculate all unoccupied / free time intervals in the 24-hour day [0, 1440]
  const freeIntervals = useMemo(() => {
    const occupied: Array<{ start: number; end: number }> = [];

    timeblocks.forEach((b) => {
      const s = timeToMinutes(b.startTime);
      const e = timeToMinutes(b.endTime);

      if (s < e) {
        occupied.push({ start: s, end: e });
      } else if (s > e) {
        // Only occupies [s, 1440] on origin day. [0, e] belongs to tomorrow!
        occupied.push({ start: s, end: 1440 });
      }
    });

    if (occupied.length === 0) {
      return [{ startMin: 0, endMin: 1440 }];
    }

    occupied.sort((a, b) => a.start - b.start);

    const merged: Array<{ start: number; end: number }> = [];
    let current = { ...occupied[0] };

    for (let i = 1; i < occupied.length; i++) {
      const next = occupied[i];
      if (next.start <= current.end) {
        current.end = Math.max(current.end, next.end);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    const free: Array<{ startMin: number; endMin: number }> = [];
    let cursor = 0;

    merged.forEach((occ) => {
      if (occ.start > cursor) {
        free.push({ startMin: cursor, endMin: occ.start });
      }
      cursor = Math.max(cursor, occ.end);
    });

    if (cursor < 1440) {
      free.push({ startMin: cursor, endMin: 1440 });
    }

    return free;
  }, [timeblocks]);

  // ─── 12-HOUR Symmetrical Split (Right: 00:00 - 12:00 | Left: 12:00 - 24:00) ───
  // Option A (Anchor + Continuation Bridge):
  // Seamless Cross-Day Carryover: Overnight tasks from tonight (23:00 - 00:30)
  // have anchor on Left Panel pointing to Tomorrow, and land on Tomorrow's Morning Panel!
  const { morningPanelSlots, nightPanelSlots } = useMemo(() => {
    interface PanelSlotItem {
      key: string;
      id: number;
      slot: TimeblockItem;
      isContinuation: boolean;
      crossLabel?: string;
      displayTime: string;
      displayDuration: string;
      hasConflictWithToday?: boolean;
    }

    const morning: PanelSlotItem[] = [];
    const night: PanelSlotItem[] = [];

    timeblocks.forEach((b) => {
      const s = timeToMinutes(b.startTime);
      let e = timeToMinutes(b.endTime);
      const isCrossMidnight = e <= s && e > 0;
      if (e <= s) e += 1440; // overnight span

      // Case 1: Carryover item from yesterday
      if (b.isCarryOverFromYesterday) {
        const durLabel = getDurationLabel("00:00", b.endTime);
        const eMin = timeToMinutes(b.endTime);

        // Check collision against today's slots
        const collides = timeblocks.some((other) => {
          if (other.id === b.id || other.isCarryOverFromYesterday) return false;
          const os = timeToMinutes(other.startTime);
          const oe = timeToMinutes(other.endTime);
          const otherEnd = oe <= os ? 1440 : oe;
          return Math.max(0, os) < Math.min(eMin, otherEnd);
        });

        morning.push({
          key: `carryover-${b.id}`,
          id: b.id,
          slot: b,
          isContinuation: true,
          crossLabel: collides
            ? `⚠️ Conflict: Cont. from yesterday (${b.originalStartTime || "yesterday"})`
            : `⮑ Cont. from yesterday (${b.originalStartTime || "yesterday"})`,
          displayTime: `00:00 - ${b.endTime}`,
          displayDuration: durLabel,
          hasConflictWithToday: collides,
        });
        return;
      }

      if (s < 720) {
        // Starts in Morning (00:00 - 12:00)
        const crossesNoon = e > 720;
        morning.push({
          key: `m-${b.id}`,
          id: b.id,
          slot: b,
          isContinuation: false,
          crossLabel: crossesNoon ? `☀️ ➔ 🌙 Cross-noon (until ${b.endTime})` : undefined,
          displayTime: `${b.startTime} - ${b.endTime}`,
          displayDuration: getDurationLabel(b.startTime, b.endTime),
        });

        // If crosses noon (12:00), generate Continuation Bridge in Afternoon/Night (Left panel)
        if (crossesNoon) {
          const contDurationMin = e - 720;
          const contDurHours = Math.floor(contDurationMin / 60);
          const contDurMins = contDurationMin % 60;
          const durLabel =
            contDurHours > 0
              ? `${contDurHours}h ${contDurMins > 0 ? `${contDurMins}m` : ""}`
              : `${contDurMins}m`;

          night.push({
            key: `cont-night-${b.id}`,
            id: b.id,
            slot: b,
            isContinuation: true,
            crossLabel: `Cont. from ${b.startTime}`,
            displayTime: `12:00 - ${b.endTime}`,
            displayDuration: durLabel,
          });
        }
      } else {
        // Starts in Afternoon / Night (12:00 - 24:00)
        night.push({
          key: `n-${b.id}`,
          id: b.id,
          slot: b,
          isContinuation: false,
          crossLabel: isCrossMidnight
            ? `🌙 ➔ Tomorrow (until ${b.endTime})`
            : undefined,
          displayTime: `${b.startTime} - ${b.endTime}`,
          displayDuration: getDurationLabel(b.startTime, b.endTime),
        });
        // In Option 1, overnight continuation bridge lands on TOMORROW (via getRoutineForDateAction)
        // and does NOT loop backward to today's morning panel!
      }
    });

    // Sort morning panel items (00:00 down to 12:00)
    morning.sort((a, b) => {
      const sA = a.isContinuation ? 0 : timeToMinutes(a.slot.startTime);
      const sB = b.isContinuation ? 0 : timeToMinutes(b.slot.startTime);
      if (sA !== sB) return sA - sB;
      return a.slot.isCarryOverFromYesterday ? -1 : 1;
    });

    // Sort night panel items (24:00 down to 12:00)
    // so top of Left panel = 24:00 (Night), bottom of Left panel = 12:00 (Midday)
    night.sort((a, b) => {
      const sA = a.isContinuation ? 720 : timeToMinutes(a.slot.startTime);
      const sB = b.isContinuation ? 720 : timeToMinutes(b.slot.startTime);
      return sB - sA;
    });

    return { morningPanelSlots: morning, nightPanelSlots: night };
  }, [timeblocks]);

  // Backward compatibility convenience mappings
  const leftSlots = useMemo(() => morningPanelSlots.map((it) => it.slot), [morningPanelSlots]);
  const rightSlots = useMemo(() => nightPanelSlots.map((it) => it.slot), [nightPanelSlots]);
  const displayLeftSlots = useMemo(() => nightPanelSlots.map((it) => it.slot), [nightPanelSlots]);

  // Measure card DOM positions and compute angled connector lines to actual wheel rim points
  const measure = useCallback(() => {
    const grid = wheelGridRef.current;
    const svgEl = wheelSvgRef.current;
    if (!grid || !svgEl) return;

    const gridRect = grid.getBoundingClientRect();
    const svgRect = svgEl.getBoundingClientRect();

    const currentHoverId = hoveredSlotIdRef.current;

    // Measure clock badge position relative to grid (skip state updates if unchanged)
    if (clockBadgeRef.current) {
      const cRect = clockBadgeRef.current.getBoundingClientRect();
      const nextX = cRect.left - gridRect.left;
      const nextY = cRect.top - gridRect.top;
      const nextW = cRect.width;
      const nextH = cRect.height;
      setClockBadgeRect((prev) => {
        if (
          prev &&
          Math.abs(prev.x - nextX) < 1 &&
          Math.abs(prev.y - nextY) < 1 &&
          Math.abs(prev.width - nextW) < 1 &&
          Math.abs(prev.height - nextH) < 1
        ) {
          return prev;
        }
        return { x: nextX, y: nextY, width: nextW, height: nextH };
      });
    }

    const leftContainerRect = leftScrollRef.current?.getBoundingClientRect();
    const rightContainerRect = rightScrollRef.current?.getBoundingClientRect();

    // Helper: convert SVG viewBox coordinate (0-440) to screen coordinate relative to grid
    function svgToGrid(svgX: number, svgY: number) {
      const scaleX = svgRect.width / 440;
      const scaleY = svgRect.height / 440;
      return {
        x: svgRect.left - gridRect.left + svgX * scaleX,
        y: svgRect.top - gridRect.top + svgY * scaleY,
      };
    }

    // Helper: compute wheel rim point for a given time (in minutes from midnight)
    // Radius of visible raised rim ≈ 184
    function rimPoint(minutes: number, r = 184) {
      const angleDeg = (minutes / 1440) * 360;
      const angleRad = ((angleDeg - 90) * Math.PI) / 180;
      const svgX = 220 + r * Math.cos(angleRad);
      const svgY = 220 + r * Math.sin(angleRad);
      return svgToGrid(svgX, svgY);
    }

    // Helper to generate clean angled path with 45° chamfered corners
    function createAngledPath(
      x1: number,
      y1: number,
      laneX: number,
      x2: number,
      y2: number,
      side: "left" | "right"
    ): string {
      const dy = y2 - y1;
      const absDy = Math.abs(dy);

      // If vertical distance is negligible, draw clean direct horizontal line
      if (absDy < 5) {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      }

      const r = Math.min(8, absDy / 2);
      const dirY = dy > 0 ? 1 : -1;

      if (side === "left") {
        let effLaneX = laneX;
        if (effLaneX + r > x2) effLaneX = x2 - r - 2;
        if (effLaneX - r < x1) effLaneX = x1 + r + 2;

        return `M ${x1} ${y1} L ${effLaneX - r} ${y1} L ${effLaneX} ${y1 + r * dirY} L ${effLaneX} ${y2 - r * dirY} L ${effLaneX + r} ${y2} L ${x2} ${y2}`;
      } else {
        let effLaneX = laneX;
        if (effLaneX - r < x2) effLaneX = x2 + r + 2;
        if (effLaneX + r > x1) effLaneX = x1 - r - 2;

        return `M ${x1} ${y1} L ${effLaneX + r} ${y1} L ${effLaneX} ${y1 + r * dirY} L ${effLaneX} ${y2 - r * dirY} L ${effLaneX - r} ${y2} L ${x2} ${y2}`;
      }
    }

    const lines: typeof connectorLines = [];

    // ─── LEFT PANEL (Afternoon & Night: 12:00 - 24:00) ───
    const rawLeftItems: Array<{
      id: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      isActive: boolean;
    }> = [];

    leftCardEls.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;

      // Visibility filter: if card is scrolled out of the scrollable container, skip it
      // (Exempt the currently hovered card, which is being auto-scrolled into view and must stay connected)
      if (leftContainerRect && id !== currentHoverId) {
        if (rect.bottom < leftContainerRect.top + 8 || rect.top > leftContainerRect.bottom - 8) {
          return;
        }
      }

      const yCard = rect.top - gridRect.top + rect.height / 2;
      const item = nightPanelSlots.find((it) => it.id === id);
      if (!item) return;
      const slot = item.slot;
      const cfg = CATEGORY_CONFIG[slot.category] || CATEGORY_CONFIG.ROUTINE;
      const isActive = getSlotTimingState(slot.startTime, slot.endTime) === "ACTIVE";

      let midMin: number;
      if (item.isContinuation) {
        let eMin = timeToMinutes(slot.endTime);
        if (eMin <= 720) eMin += 1440;
        midMin = (720 + eMin) / 2;
      } else {
        const startMin = timeToMinutes(slot.startTime);
        let endMin = timeToMinutes(slot.endTime);
        if (endMin <= startMin) endMin += 1440;
        midMin = (startMin + endMin) / 2;
      }

      // Left hemisphere: 12:00 to 24:00 (725 to 1435 min)
      const clampedMin = Math.max(725, Math.min(1435, midMin % 1440));
      const rim = rimPoint(clampedMin, 186);

      rawLeftItems.push({
        id,
        x1: rect.right - gridRect.left,
        y1: yCard,
        x2: rim.x,
        y2: rim.y,
        color: cfg.color,
        isActive,
      });
    });

    // ─── RIGHT PANEL (Morning & Midday: 00:00 - 12:00) ───
    const rawRightItems: Array<{
      id: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      isActive: boolean;
    }> = [];

    rightCardEls.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;

      // Visibility filter: if card is scrolled out of the scrollable container, skip it
      // (Exempt the currently hovered card, which is being auto-scrolled into view and must stay connected)
      if (rightContainerRect && id !== currentHoverId) {
        if (rect.bottom < rightContainerRect.top + 8 || rect.top > rightContainerRect.bottom - 8) {
          return;
        }
      }

      const yCard = rect.top - gridRect.top + rect.height / 2;
      const item = morningPanelSlots.find((it) => it.id === id);
      if (!item) return;
      const slot = item.slot;
      const cfg = CATEGORY_CONFIG[slot.category] || CATEGORY_CONFIG.ROUTINE;
      const isActive = getSlotTimingState(slot.startTime, slot.endTime) === "ACTIVE";

      let midMin: number;
      if (item.isContinuation) {
        const eMin = timeToMinutes(slot.endTime);
        midMin = eMin / 2;
      } else {
        const startMin = timeToMinutes(slot.startTime);
        let endMin = timeToMinutes(slot.endTime);
        if (endMin <= startMin) endMin += 1440;
        midMin = (startMin + Math.min(endMin, 720)) / 2;
      }

      // Right hemisphere: 00:00 to 12:00 (5 to 715 min)
      const clampedMin = Math.max(5, Math.min(715, midMin % 1440));
      const rim = rimPoint(clampedMin, 186);

      rawRightItems.push({
        id,
        x1: rect.left - gridRect.left,
        y1: yCard,
        x2: rim.x,
        y2: rim.y,
        color: cfg.color,
        isActive,
      });
    });

    // ─── Calculate Clockwise Domino Cascade Delays ───
    // Phase 1: Right panel from Top to Bottom (00:00 -> 12:00)
    // Phase 2: Left panel from Bottom to Top (12:00 -> 24:00)
    // Snappy handoff right after the bouncy wave passes and sectors settle (~680ms):
    const baseDelay = 680;
    const stepDelay = 48;

    const sortedRight = [...rawRightItems].sort((a, b) => a.y1 - b.y1);
    const rightDelayMap = new Map<number, number>();
    sortedRight.forEach((item, idx) => {
      rightDelayMap.set(item.id, baseDelay + idx * stepDelay);
    });

    const sortedLeft = [...rawLeftItems].sort((a, b) => b.y1 - a.y1);
    const leftDelayMap = new Map<number, number>();
    sortedLeft.forEach((item, idx) => {
      leftDelayMap.set(item.id, baseDelay + (sortedRight.length + idx) * stepDelay);
    });

    // ─── Build Left Corridor & Lines ───
    if (rawLeftItems.length > 0) {
      const avgCardRight = rawLeftItems.reduce((acc, it) => acc + it.x1, 0) / rawLeftItems.length;
      const svgLeft = svgRect.left - gridRect.left;
      // Dial outer edge at r=210
      const dialLeft = svgLeft + (10 / 440) * svgRect.width;

      const corridorStart = avgCardRight + 12;
      const corridorEnd = Math.max(corridorStart + 24, dialLeft - 10);
      const corridorWidth = Math.max(20, corridorEnd - corridorStart);

      // Sort items by target y2 ascending (highest target on screen to lowest)
      // Highest target gets lane closest to wheel (corridorEnd)
      // Lowest target gets lane closest to cards (corridorStart)
      const sorted = [...rawLeftItems].sort((a, b) => a.y2 - b.y2);
      const laneMap = new Map<number, number>();
      sorted.forEach((item, rank) => {
        const frac = (rank + 0.5) / sorted.length;
        const laneX = corridorEnd - frac * corridorWidth;
        laneMap.set(item.id, laneX);
      });

      rawLeftItems.forEach((item) => {
        const laneX = laneMap.get(item.id) || (corridorStart + corridorEnd) / 2;
        const pathD = createAngledPath(item.x1, item.y1, laneX, item.x2, item.y2, "left");
        lines.push({
          ...item,
          pathD,
          side: "left",
          animDelay: leftDelayMap.get(item.id) || baseDelay,
        });
      });
    }

    // ─── Build Right Corridor & Lines ───
    if (rawRightItems.length > 0) {
      const avgCardLeft = rawRightItems.reduce((acc, it) => acc + it.x1, 0) / rawRightItems.length;
      const svgLeft = svgRect.left - gridRect.left;
      // Dial outer edge at r=210
      const dialRight = svgLeft + (430 / 440) * svgRect.width;

      const corridorStart = dialRight + 10;
      const corridorEnd = Math.max(corridorStart + 24, avgCardLeft - 12);
      const corridorWidth = Math.max(20, corridorEnd - corridorStart);

      // Sort items by target y2 ascending (top to bottom)
      const sorted = [...rawRightItems].sort((a, b) => a.y2 - b.y2);
      const laneMap = new Map<number, number>();
      sorted.forEach((item, rank) => {
        const frac = (rank + 0.5) / sorted.length;
        const laneX = corridorStart + frac * corridorWidth;
        laneMap.set(item.id, laneX);
      });

      rawRightItems.forEach((item) => {
        const laneX = laneMap.get(item.id) || (corridorStart + corridorEnd) / 2;
        const pathD = createAngledPath(item.x1, item.y1, laneX, item.x2, item.y2, "right");
        lines.push({
          ...item,
          pathD,
          side: "right",
          animDelay: rightDelayMap.get(item.id) || baseDelay,
        });
      });
    }

    setConnectorLines(lines);
  }, [morningPanelSlots, nightPanelSlots, getSlotTimingState]);

  measureRef.current = measure;

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (wheelGridRef.current) observer.observe(wheelGridRef.current);

    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 350);
    const t3 = setTimeout(measure, 660);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [measure, selectedDate, animKey]);

  // Auto-scroll the hidden side card into view when a wedge on the 24H wheel is hovered
  const handleWheelWedgeHover = useCallback(
    (slotId: number) => {
      const prevHovered = hoveredSlotIdRef.current;
      hoveredSlotIdRef.current = slotId;
      setHoveredSlotId(slotId);
      if (prevHovered === slotId) {
        return;
      }

      // Check target cards in left and/or right panel (cross-boundary tasks can have both)
      const targets = [
        { container: leftScrollRef.current, el: leftCardEls.current.get(slotId) },
        { container: rightScrollRef.current, el: rightCardEls.current.get(slotId) },
      ];

      let anyScrolled = false;
      targets.forEach(({ container, el }) => {
        if (!container || !el) return;
        const containerRect = container.getBoundingClientRect();
        const cardRect = el.getBoundingClientRect();
        let delta = 0;

        if (cardRect.top < containerRect.top + 8) {
          delta = cardRect.top - containerRect.top - 16;
        } else if (cardRect.bottom > containerRect.bottom - 8) {
          delta = cardRect.bottom - containerRect.bottom + 16;
        }

        if (delta !== 0) {
          container.scrollBy({ top: delta, behavior: "smooth" });
          anyScrolled = true;
        }
      });

      if (anyScrolled) {
        // Continuously re-measure during the smooth scroll animation (450ms)
        if (scrollAnimRef.current) {
          cancelAnimationFrame(scrollAnimRef.current);
        }

        const startTime = performance.now();
        const tick = () => {
          measureRef.current();
          if (performance.now() - startTime < 450) {
            scrollAnimRef.current = requestAnimationFrame(tick);
          } else {
            scrollAnimRef.current = null;
          }
        };
        scrollAnimRef.current = requestAnimationFrame(tick);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  // Real-time time conflict / collision detection for editingSlot
  const slotConflict = useMemo(() => {
    if (!editingSlot?.startTime || !editingSlot?.endTime) {
      return { hasConflict: false, conflictingSlot: null };
    }
    return checkTimeConflict(
      editingSlot.startTime,
      editingSlot.endTime,
      timeblocks,
      editingSlot.id,
      true // isCarryOverAware: overnight task occupies s -> 1440 on today
    );
  }, [editingSlot?.startTime, editingSlot?.endTime, editingSlot?.id, timeblocks]);

  // Real-time asynchronous next-day collision detection for editingSlot
  useEffect(() => {
    if (!editingSlot?.startTime || !editingSlot?.endTime) {
      setNextDayConflict({ hasConflict: false });
      return;
    }
    const s = timeToMinutes(editingSlot.startTime);
    const e = timeToMinutes(editingSlot.endTime);
    // Only check next-day if the task crosses midnight (e <= s and e > 0)
    if (e > s || e === 0) {
      setNextDayConflict({ hasConflict: false });
      return;
    }

    let active = true;
    checkNextDayTimeConflictAction(
      editingSlot.date || selectedDate,
      editingSlot.startTime,
      editingSlot.endTime,
      editingSlot.id
    ).then((res) => {
      if (!active) return;
      if (res && res.hasConflict) {
        setNextDayConflict({
          hasConflict: true,
          message: res.message,
          conflictingSlot: res.conflictingSlot,
        });
      } else {
        setNextDayConflict({ hasConflict: false });
      }
    });

    return () => {
      active = false;
    };
  }, [editingSlot?.startTime, editingSlot?.endTime, editingSlot?.id, editingSlot?.date, selectedDate]);

  // Real-time time conflict / collision detection for editingMasterSlot
  const masterSlotConflict = useMemo(() => {
    if (!editingMasterSlot?.startTime || !editingMasterSlot?.endTime) {
      return { hasConflict: false, conflictingSlot: null };
    }
    return checkTimeConflict(
      editingMasterSlot.startTime,
      editingMasterSlot.endTime,
      masterRoutines,
      editingMasterSlot.id,
      true // isCarryOverAware for master profile as well
    );
  }, [editingMasterSlot?.startTime, editingMasterSlot?.endTime, editingMasterSlot?.id, masterRoutines]);

  // Real-time asynchronous conflict check for master routine next-day profiles
  useEffect(() => {
    if (
      !editingMasterSlot?.startTime ||
      !editingMasterSlot?.endTime ||
      !editingMasterSlot?.dayProfile
    ) {
      setMasterNextDayConflict({ hasConflict: false });
      return;
    }
    const s = timeToMinutes(editingMasterSlot.startTime);
    const e = timeToMinutes(editingMasterSlot.endTime);
    if (e > s || e === 0) {
      setMasterNextDayConflict({ hasConflict: false });
      return;
    }

    let active = true;
    checkMasterTemplateConflictAction(
      editingMasterSlot.dayProfile,
      editingMasterSlot.startTime,
      editingMasterSlot.endTime,
      editingMasterSlot.id
    ).then((res) => {
      if (!active) return;
      if (res && res.hasConflict) {
        setMasterNextDayConflict({
          hasConflict: true,
          message: res.message,
          conflictingSlot: res.conflictingSlot,
        });
      } else {
        setMasterNextDayConflict({ hasConflict: false });
      }
    });

    return () => {
      active = false;
    };
  }, [
    editingMasterSlot?.startTime,
    editingMasterSlot?.endTime,
    editingMasterSlot?.dayProfile,
    editingMasterSlot?.id,
  ]);

  // Habit toggling
  const handleToggleHabit = async (habit: HabitItem) => {
    const nextCompleted = !habit.isCompleted;
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id ? { ...h, isCompleted: nextCompleted } : h
      )
    );
    await toggleDailyHabitAction(habit.id, selectedDate, nextCompleted);
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim() || isSavingHabit || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSavingHabit(true);
    try {
      const res = await addDailyHabitAction(newHabitTitle);
      if (res.success) {
        setNewHabitTitle("");
        setIsAddingHabit(false);
        const habitsRes = await getDailyHabitsForDateAction(selectedDate);
        if (habitsRes.success) setHabits(habitsRes.habits as HabitItem[]);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSavingHabit(false);
    }
  };

  const handleStartEditHabit = (habit: HabitItem) => {
    setEditingHabitId(habit.id);
    setEditingHabitTitle(habit.title);
  };

  const handleSaveHabitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabitId || !editingHabitTitle.trim() || isUpdatingHabit || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsUpdatingHabit(true);
    try {
      const res = await updateDailyHabitAction(editingHabitId, {
        title: editingHabitTitle.trim(),
      });
      if (res.success) {
        setEditingHabitId(null);
        setEditingHabitTitle("");
        const habitsRes = await getDailyHabitsForDateAction(selectedDate);
        if (habitsRes.success) setHabits(habitsRes.habits as HabitItem[]);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsUpdatingHabit(false);
    }
  };

  const handleConfirmDeleteHabit = async () => {
    if (!habitToDelete || isDeletingHabit || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsDeletingHabit(true);
    try {
      const res = await deleteDailyHabitAction(habitToDelete.id);
      if (res.success) {
        setHabitToDelete(null);
        const habitsRes = await getDailyHabitsForDateAction(selectedDate);
        if (habitsRes.success) setHabits(habitsRes.habits as HabitItem[]);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsDeletingHabit(false);
    }
  };

  // Slot CRUD
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingSlot?.title ||
      !editingSlot?.startTime ||
      !editingSlot?.endTime ||
      isSavingSlot ||
      isSubmittingRef.current
    ) {
      return;
    }
    if (slotConflict.hasConflict || nextDayConflict.hasConflict || editingSlot.isCarryOverFromYesterday) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSavingSlot(true);
    try {
      if (editingSlot.id && editingSlot.id > 0) {
        // Existing row in DB: update it
        await updateTimeblockAction(editingSlot.id, {
          startTime: editingSlot.startTime,
          endTime: editingSlot.endTime,
          title: editingSlot.title,
          category: editingSlot.category || "ROUTINE",
          notes: editingSlot.notes || null,
        });
      } else if (editingSlot.id && editingSlot.id < 0) {
        // Virtual master slot: create override row with masterRoutineId
        await createTimeblockAction({
          date: selectedDate,
          startTime: editingSlot.startTime,
          endTime: editingSlot.endTime,
          title: editingSlot.title,
          category: editingSlot.category || "ROUTINE",
          notes: editingSlot.notes || null,
          orderIndex: editingSlot.orderIndex ?? timeblocks.length,
          masterRoutineId: Math.abs(editingSlot.id),
          status: "PLANNED",
        });
      } else {
        // Completely new custom slot
        await createTimeblockAction({
          date: selectedDate,
          startTime: editingSlot.startTime,
          endTime: editingSlot.endTime,
          title: editingSlot.title,
          category: editingSlot.category || "ROUTINE",
          notes: editingSlot.notes || null,
          orderIndex: timeblocks.length,
          status: "PLANNED",
        });
      }

      setIsSlotModalOpen(false);
      setEditingSlot(null);
      await loadData(selectedDate);
    } finally {
      isSubmittingRef.current = false;
      setIsSavingSlot(false);
    }
  };

  const handleConfirmDeleteSlot = async () => {
    if (!slotToDelete?.id || isDeletingSlot || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsDeletingSlot(true);
    try {
      if (slotToDelete.id < 0) {
        // Virtual master routine slot - suppress it for today
        await suppressMasterRoutineSlotAction(selectedDate, Math.abs(slotToDelete.id));
      } else {
        // Custom instance - delete it (if it had masterRoutineId, master slot will naturally reappear!)
        await deleteTimeblockAction(slotToDelete.id);
      }
      setSlotToDelete(null);
      setIsSlotModalOpen(false);
      setEditingSlot(null);
      await loadData(selectedDate);
    } finally {
      isSubmittingRef.current = false;
      setIsDeletingSlot(false);
    }
  };

  const handleConfirmResetToMaster = async () => {
    if (isResettingDay || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsResettingDay(true);
    try {
      await resetDayToMasterRoutineAction(selectedDate);
      setIsResetConfirmOpen(false);
      await loadData(selectedDate);
    } finally {
      isSubmittingRef.current = false;
      setIsResettingDay(false);
    }
  };

  // Attach Kanban Task
  const handleAttachTask = async (task: KanbanTaskItem) => {
    if (!targetSlotForTask || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      if (targetSlotForTask.id < 0) {
        // Virtual master slot: create override row with taskId
        await createTimeblockAction({
          date: selectedDate,
          startTime: targetSlotForTask.startTime,
          endTime: targetSlotForTask.endTime,
          title: targetSlotForTask.title,
          category: targetSlotForTask.category || "ROUTINE",
          notes: targetSlotForTask.notes || null,
          taskId: task.id,
          orderIndex: targetSlotForTask.orderIndex >= 0 ? targetSlotForTask.orderIndex : 0,
          masterRoutineId: Math.abs(targetSlotForTask.id),
          status: "PLANNED",
        });
      } else {
        await updateTimeblockAction(targetSlotForTask.id, { taskId: task.id });
      }
      setIsKanbanDrawerOpen(false);
      setTargetSlotForTask(null);
      await loadData(selectedDate);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleDetachTask = async (slotId: number) => {
    if (slotId > 0 && !isSubmittingRef.current) {
      isSubmittingRef.current = true;
      try {
        await updateTimeblockAction(slotId, { taskId: null });
        await loadData(selectedDate);
      } finally {
        isSubmittingRef.current = false;
      }
    }
  };

  // Master Routines Modal
  const loadMasterRoutines = async (profile: DayProfileType) => {
    setMasterProfileTab(profile);
    const res = await getMasterRoutinesAction(profile);
    if (res.success) setMasterRoutines(res.routines);
  };

  const handleOpenMasterModal = () => {
    setIsMasterModalOpen(true);
    loadMasterRoutines(dayProfile);
  };

  const handleSaveMasterSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingMasterSlot?.title ||
      !editingMasterSlot?.startTime ||
      !editingMasterSlot?.endTime ||
      isSavingMasterSlot ||
      isSubmittingRef.current
    ) {
      return;
    }
    if (masterSlotConflict.hasConflict || masterNextDayConflict.hasConflict) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSavingMasterSlot(true);
    try {
      await saveMasterRoutineAction(editingMasterSlot.id, {
        dayProfile: editingMasterSlot.dayProfile,
        startTime: editingMasterSlot.startTime,
        endTime: editingMasterSlot.endTime,
        title: editingMasterSlot.title,
        category: editingMasterSlot.category || "ROUTINE",
        orderIndex: 0,
      });
      await loadMasterRoutines(editingMasterSlot.dayProfile);
      setIsMasterSlotDialogOpen(false);
      setEditingMasterSlot(null);
    } finally {
      isSubmittingRef.current = false;
      setIsSavingMasterSlot(false);
    }
  };

  const handleConfirmDeleteMasterSlot = async () => {
    if (!masterSlotToDelete?.id || isDeletingMasterSlot || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsDeletingMasterSlot(true);
    try {
      await deleteMasterRoutineAction(masterSlotToDelete.id);
      await loadMasterRoutines(masterProfileTab);
      setMasterSlotToDelete(null);
    } finally {
      isSubmittingRef.current = false;
      setIsDeletingMasterSlot(false);
    }
  };

  // Habit completion stats
  const completedHabitsCount = habits.filter((h) => h.isCompleted).length;
  const habitPercent =
    habits.length > 0
      ? Math.round((completedHabitsCount / habits.length) * 100)
      : 0;

  // Day timeline progress percentage (0 - 100%)
  const dayElapsedPercent = Math.min(
    100,
    Math.max(0, Math.round((nowMinutes / 1440) * 100))
  );

  // Active slot elapsed progress (0 - 100%)
  const activeSlotProgress = useMemo(() => {
    if (!currentActiveSlot) return 0;
    const s = timeToMinutes(currentActiveSlot.startTime);
    let e = timeToMinutes(currentActiveSlot.endTime);
    if (e <= s) e += 1440;
    const dur = Math.max(1, e - s);
    let current = nowMinutes;
    if (current < s) current += 1440;
    const elapsed = Math.min(dur, Math.max(0, current - s));
    return Math.round((elapsed / dur) * 100);
  }, [currentActiveSlot, nowMinutes]);

  const activeSlotRemainingMinutes = useMemo(() => {
    if (!currentActiveSlot) return 0;
    const s = timeToMinutes(currentActiveSlot.startTime);
    let e = timeToMinutes(currentActiveSlot.endTime);
    if (e <= s) e += 1440;
    let current = nowMinutes;
    if (current < s) current += 1440;
    return Math.max(0, e - current);
  }, [currentActiveSlot, nowMinutes]);

  return (
    <div className="h-full flex flex-col justify-between space-y-2 select-none overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & NAVIGATION CONTROL                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-3 p-2.5 px-4 rounded-2xl bg-white/[0.02] border border-white/10 shadow-md backdrop-blur-xl">
        {/* Left: Date Switcher, Protocol Badge & Live Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedDate !== todayStr) {
                  setSelectedDate(todayStr);
                } else {
                  setAnimKey((k) => k + 1);
                }
              }}
              className={cn(
                "px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer",
                isSelectedToday
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-300 hover:bg-white/10"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="truncate">
            <h2 className="text-xs md:text-sm font-bold text-white font-mono flex items-center gap-2 truncate">
              <CalendarIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">{formattedDateHeader}</span>
            </h2>
          </div>

          {/* Live Focus Pill */}
          {currentActiveSlot && (
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-bold">ACTIVE:</span>
              <span className="max-w-[180px] truncate">{currentActiveSlot.title}</span>
              <span className="text-purple-400 font-bold">({activeSlotRemainingMinutes}m left)</span>
            </div>
          )}
        </div>

        {/* Right: Dual Mode Switcher & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => {
                if (viewMode !== "WHEEL") {
                  setViewMode("WHEEL");
                } else {
                  setAnimKey((k) => k + 1);
                }
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === "WHEEL"
                  ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              )}
              title="24-Hour Circular Infographic Wheel"
            >
              <Disc className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">24H Wheel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TIMELINE_SPAN")}
              className={cn(
                "px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer",
                viewMode === "TIMELINE_SPAN"
                  ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              )}
              title="Connected 24-Hour Spanning Timeline"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connected Timeline</span>
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setEditingSlot({
                date: selectedDate,
                startTime: nowTime.slice(0, 5),
                endTime: "21:00",
                title: "",
                category: "DEEP_WORK",
                notes: "",
              });
              setIsSlotModalOpen(true);
            }}
            className="h-7 px-2.5 text-[11px] font-mono rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer border-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Slot</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsResetConfirmOpen(true)}
            className="h-7 px-2 text-[11px] font-mono rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 gap-1 cursor-pointer"
            title="Reset day routine to default master profile"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenMasterModal}
            className="h-7 px-2 text-[11px] font-mono rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 gap-1 cursor-pointer"
            title="Master Routine Protocol Settings (Weekday, Friday, Weekend)"
          >
            <Settings className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. DEDICATED HABITS CHECKLIST BAR                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-2 p-1.5 px-3.5 rounded-2xl bg-white/[0.015] border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 shrink-0 flex items-center gap-1.5">
            <CheckSquare className="w-3 h-3" />
            <span>
              Habits ({completedHabitsCount}/{habits.length}):
            </span>
          </span>

          {habits.map((h) =>
            editingHabitId === h.id ? (
              <form
                key={h.id}
                onSubmit={handleSaveHabitEdit}
                className="flex items-center gap-1 shrink-0 bg-white/10 px-2 py-0.5 rounded-lg border border-purple-500/40 shadow-inner"
              >
                <Input
                  autoFocus
                  value={editingHabitTitle}
                  onChange={(e) => setEditingHabitTitle(e.target.value)}
                  className="h-5 w-28 px-1.5 text-[11px] bg-black/40 border-white/20 text-white rounded font-mono"
                />
                <button
                  type="submit"
                  disabled={isUpdatingHabit}
                  className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-mono cursor-pointer flex items-center gap-1"
                >
                  {isUpdatingHabit ? (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-200" />
                  ) : (
                    "Save"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingHabitId(null)}
                  className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <div
                key={h.id}
                className={cn(
                  "group relative px-2.5 py-0.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all shrink-0 border",
                  h.isCompleted
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300 font-semibold shadow-sm"
                    : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07]"
                )}
              >
                <button
                  type="button"
                  onClick={() => handleToggleHabit(h)}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  {h.isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 text-slate-500 shrink-0" />
                  )}
                  <span className={cn(h.isCompleted && "line-through opacity-80")}>
                    {h.title}
                  </span>
                </button>

                {/* Inline Edit & Delete on hover */}
                <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-1 border-l border-white/15">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditHabit(h);
                    }}
                    className="p-0.5 text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                    title="Edit Habit"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHabitToDelete(h);
                    }}
                    className="p-0.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Habit"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            )
          )}

          {/* Quick Add Habit Button */}
          {isAddingHabit ? (
            <form onSubmit={handleAddHabit} className="flex items-center gap-1 shrink-0">
              <Input
                autoFocus
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                placeholder="Nama habit..."
                className="h-6 w-32 px-2 text-[11px] bg-white/10 border-white/20 text-white rounded-lg font-mono"
              />
              <button
                type="submit"
                disabled={isSavingHabit}
                className="p-1 px-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-mono cursor-pointer flex items-center gap-1"
              >
                {isSavingHabit ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-200" />
                ) : (
                  "Save"
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingHabit(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingHabit(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Add Daily Habit"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="shrink-0 hidden md:flex items-center gap-1.5 pl-2 border-l border-white/10 text-[10px] font-mono">
          <span className="text-slate-400">Score:</span>
          <span className="text-emerald-400 font-bold">{habitPercent}%</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. PANORAMIC 24-HOUR CONTINUOUS TIMELINE RIBBON                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-2 px-3 rounded-2xl bg-white/[0.02] border border-white/10 shadow-md backdrop-blur-md flex flex-col gap-1.5 animate-ribbon-reveal">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-white font-semibold">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span>24-HOUR CONTINUOUS TIMELINE</span>
            </span>
            <span className="text-purple-300 font-bold bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
              {nowTime} WIB
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Scheduled: <strong className="text-white">{stats.totalScheduledHours}h</strong>
            </span>
            <span>
              Day Elapsed: <strong className="text-purple-300">{dayElapsedPercent}%</strong>
            </span>
          </div>
        </div>

        {/* Proportional 24-Hour Bar with Live Needle */}
        <div
          className="relative w-full h-3.5 rounded-full bg-black/60 border border-white/10 overflow-hidden shadow-inner flex cursor-pointer"
          onMouseLeave={() => {
            setHoveredSlotId(null);
            setRibbonTooltip(null);
          }}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const min = Math.max(0, Math.min(1439, Math.floor(((e.clientX - rect.left) / rect.width) * 1440)));
            const h = Math.floor(min / 60);
            const startStr = `${String(h).padStart(2, "0")}:00`;
            const endStr = `${String(Math.min(23, h + 1)).padStart(2, "0")}:00`;
            setEditingSlot({
              date: selectedDate,
              startTime: startStr,
              endTime: endStr,
              title: "",
              category: "ROUTINE",
              notes: "",
            });
            setIsSlotModalOpen(true);
          }}
          onMouseMove={(e) => {
            if (e.target === e.currentTarget) {
              const rect = e.currentTarget.getBoundingClientRect();
              const min = Math.max(0, Math.min(1439, Math.floor(((e.clientX - rect.left) / rect.width) * 1440)));
              const matchingFree = freeIntervals.find((f) => min >= f.startMin && min < f.endMin);
              if (matchingFree) {
                const startStr = `${String(Math.floor(matchingFree.startMin / 60)).padStart(2, "0")}:${String(matchingFree.startMin % 60).padStart(2, "0")}`;
                // Only trigger state update when switching to a different free interval or if tooltip not open!
                if (!ribbonTooltip || !ribbonTooltip.freeInfo || ribbonTooltip.freeInfo.startStr !== startStr) {
                  const endHour = Math.floor(matchingFree.endMin / 60);
                  const endStr = matchingFree.endMin === 1440 ? "24:00" : `${String(endHour).padStart(2, "0")}:${String(matchingFree.endMin % 60).padStart(2, "0")}`;
                  const freeDurMin = matchingFree.endMin - matchingFree.startMin;
                  const freeDurLabel = freeDurMin >= 60 ? `${Math.floor(freeDurMin / 60)}h ${freeDurMin % 60 > 0 ? `${freeDurMin % 60}m` : ""}`.trim() : `${freeDurMin}m`;
                  const isNowFree = isSelectedToday && nowMinutes >= matchingFree.startMin && nowMinutes < matchingFree.endMin;
                  setRibbonTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    freeInfo: {
                      startStr,
                      endStr,
                      durationLabel: freeDurLabel,
                      isNowFree: !!isNowFree,
                    },
                  });
                }
              } else {
                if (ribbonTooltip) setRibbonTooltip(null);
              }
            }
          }}
        >
          {timeblocks.flatMap((b) => {
            const s = timeToMinutes(b.startTime);
            const e = timeToMinutes(b.endTime);
            const segments =
              s < e
                ? [{ start: s, end: e, suffix: "" }]
                : [
                    { start: s, end: 1440, suffix: "-evening" },
                  ];

            const timingState = getSlotTimingState(b.startTime, b.endTime);
            const isActive = timingState === "ACTIVE";
            const cfg = CATEGORY_CONFIG[b.category] || CATEGORY_CONFIG.ROUTINE;
            const isHovered = hoveredSlotId === b.id;

            return segments.map((seg) => {
              const startPct = (seg.start / 1440) * 100;
              const widthPct = Math.max(0.8, ((seg.end - seg.start) / 1440) * 100);

              return (
                <div
                  key={`${b.id}${seg.suffix}`}
                  onMouseEnter={(e) => {
                    setHoveredSlotId(b.id);
                    setRibbonTooltip({ x: e.clientX, y: e.clientY, block: b });
                  }}
                  onMouseLeave={() => {
                    setHoveredSlotId(null);
                    setRibbonTooltip(null);
                  }}
                  onClick={() => {
                    setEditingSlot(b);
                    setIsSlotModalOpen(true);
                  }}
                  style={{
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: cfg.color,
                  }}
                  className={cn(
                    "absolute top-0 bottom-0 transition-all cursor-pointer",
                    isActive
                      ? "opacity-100 shadow-[0_0_14px_rgba(168,85,247,0.95)] z-10 animate-pulse"
                      : isHovered
                      ? "opacity-100 ring-1 ring-white"
                      : "opacity-80 hover:opacity-100"
                  )}
                />
              );
            });
          })}

          {/* Current Live Needle */}
          {isSelectedToday && (
            <div
              style={{ left: `${(nowMinutes / 1440) * 100}%` }}
              className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_#ffffff] z-20 pointer-events-none"
            />
          )}
        </div>

        {/* Hour Markers */}
        <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-500 px-0.5">
          <span>00:00</span>
          <span>02:00</span>
          <span>04:00</span>
          <span>06:00</span>
          <span>08:00</span>
          <span>10:00</span>
          <span>12:00</span>
          <span>14:00</span>
          <span>16:00</span>
          <span>18:00</span>
          <span>20:00</span>
          <span>22:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. MAIN BODY (MODE 1: CONNECTED TIMELINE | MODE 2: CIRCULAR WHEEL)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="h-full rounded-2xl bg-white/[0.015] border border-white/10 flex flex-col items-center justify-center space-y-2 text-slate-400 font-mono text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            <span>Loading 24-Hour Routine...</span>
          </div>
        ) : timeblocks.length === 0 ? (
          <div className="h-full rounded-2xl bg-white/[0.015] border border-white/10 flex flex-col items-center justify-center space-y-3.5 text-slate-400 font-mono text-xs text-center p-6">
            {masterRoutines.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shadow-inner">
                  <Settings className="w-6 h-6 text-purple-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">No Master Protocol Configured</p>
                  <p className="text-slate-400 max-w-sm text-[11.5px] leading-relaxed">
                    There are no recurring routine templates set for the <strong className="text-purple-300 font-bold">{dayProfile}</strong> profile yet.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleOpenMasterModal}
                  className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-mono text-xs cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-600/30 px-4 py-2 mt-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configure Master Protocol</span>
                </Button>
              </>
            ) : (
              <>
                <Clock className="w-8 h-8 text-slate-600" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">No Routine Slots for This Date</p>
                  <p className="text-slate-400 max-w-sm text-[11.5px] leading-relaxed">
                    Schedule is currently clear. You can apply the default <strong className="text-purple-300 font-bold">{dayProfile}</strong> protocol or customize manually.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                  <Button
                    size="sm"
                    onClick={handleConfirmResetToMaster}
                    className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-mono text-xs cursor-pointer flex items-center gap-1.5 shadow-lg shadow-purple-600/30 px-4 py-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Apply Default Protocol ({masterRoutines.length} Slots)</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenMasterModal}
                    className="border-white/10 hover:bg-white/5 text-slate-300 rounded-xl font-mono text-xs cursor-pointer flex items-center gap-1.5 px-3 py-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Template</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : viewMode === "TIMELINE_SPAN" ? (
          /* ─────────────────────────────────────────────────────────────── */
          /* MODE 1: CONNECTED 24-HOUR TIMELINE WITH SPANNING CARDS          */
          /* & LIVE DYNAMIC MOVING TIME LINE                                 */
          /* ─────────────────────────────────────────────────────────────── */
          <div
            key={`timeline-${selectedDate}`}
            className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 overflow-hidden"
          >
            {timelineColumns.map((col, colIdx) => {
              const ColIcon = col.icon;
              const isColCurrent =
                isSelectedToday && nowMinutes >= col.startMin && nowMinutes < col.endMin;
              const liveLineTopPct = isColCurrent
                ? ((nowMinutes - col.startMin) / 360) * 100
                : null;

              // Find blocks that overlap with this 6-hour column
              const colBlocks: Array<{
                block: TimeblockItem;
                segStart: number;
                segEnd: number;
                isCrossStart: boolean;
                isCrossEnd: boolean;
                isCarryOver: boolean;
                isCarryOverConflict: boolean;
                isTomorrowContinuation: boolean;
              }> = [];

              timeblocks.forEach((b) => {
                const s = timeToMinutes(b.startTime);
                const e = timeToMinutes(b.endTime);

                if (s < e) {
                  // Normal slot within the same day OR carryover from yesterday (s = 0)
                  if (s < col.endMin && e > col.startMin) {
                    const isCarryOver = !!b.isCarryOverFromYesterday;
                    const isCarryOverConflict = isCarryOver && timeblocks.some((other) => {
                      if (other.id === b.id || other.isCarryOverFromYesterday) return false;
                      const os = timeToMinutes(other.startTime);
                      const oe = timeToMinutes(other.endTime);
                      const otherEnd = oe <= os ? 1440 : oe;
                      return Math.max(0, os) < Math.min(e, otherEnd);
                    });

                    colBlocks.push({
                      block: b,
                      segStart: s,
                      segEnd: e,
                      isCrossStart: s < col.startMin,
                      isCrossEnd: e > col.endMin,
                      isCarryOver,
                      isCarryOverConflict,
                      isTomorrowContinuation: false,
                    });
                  }
                } else {
                  // Overnight slot crossing midnight (e.g. 23:00 - 00:30)
                  // On origin day, it ONLY occupies Segment 1 (Evening portion: s -> 1440)
                  // The continuation (0 -> e) lands on tomorrow's column 1 via the carryover instance!
                  if (s < col.endMin && 1440 > col.startMin) {
                    colBlocks.push({
                      block: b,
                      segStart: s,
                      segEnd: 1440,
                      isCrossStart: s < col.startMin,
                      isCrossEnd: true,
                      isCarryOver: false,
                      isCarryOverConflict: false,
                      isTomorrowContinuation: true,
                    });
                  }
                }
              });

              return (
                <div
                  key={col.id}
                  style={{ animationDelay: `${colIdx * 90}ms` }}
                  className="h-full rounded-2xl bg-white/[0.015] border border-white/10 p-2 shadow-xl backdrop-blur-xl flex flex-col justify-between overflow-hidden relative animate-col-slide-up"
                >
                  {/* Column Header */}
                  <div className="shrink-0 flex items-center justify-between pb-1.5 px-1 border-b border-white/5 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <ColIcon className="w-3.5 h-3.5" style={{ color: col.color }} />
                      <span className="font-bold text-white uppercase tracking-wider">
                        {col.title}
                      </span>
                    </div>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold", col.badgeBg)}>
                      {col.range}
                    </span>
                  </div>

                  {/* Connected Timetable Rail (Relative track height for 360 minutes) */}
                  <div className="flex-1 relative rounded-xl bg-black/40 border border-white/10 overflow-hidden my-1">
                    {/* Background Hourly Grid Guidelines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {col.hours.map((h, i) => (
                        <div
                          key={h}
                          className={cn(
                            "flex-1 flex items-start border-b border-white/[0.04] px-1.5 pt-0.5 text-[9px] font-mono",
                            i === 5 && "border-b-0"
                          )}
                        >
                          <span className="text-slate-500 font-medium">
                            {String(h).padStart(2, "0")}:00
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Empty Hour Click Triggers */}
                    <div className="absolute inset-0 flex flex-col justify-between z-0">
                      {col.hours.map((h) => {
                        const hStart = h * 60;
                        const hEnd = (h + 1) * 60;
                        const isOccupied = colBlocks.some((item) => {
                          return item.segStart < hEnd && item.segEnd > hStart;
                        });

                        if (isOccupied) return <div key={h} className="flex-1" />;

                        const isNight = h < 5 || h >= 23;

                        return (
                          <div
                            key={h}
                            onClick={() => {
                              setEditingSlot({
                                date: selectedDate,
                                startTime: `${String(h).padStart(2, "0")}:00`,
                                endTime: `${String(Math.min(23, h + 1)).padStart(2, "0")}:00`,
                                title: isNight ? "Sleep & Recovery" : "",
                                category: isNight ? "ROUTINE" : "DEEP_WORK",
                                notes: "",
                              });
                              setIsSlotModalOpen(true);
                            }}
                            className="flex-1 group/empty flex items-center justify-end pr-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
                          >
                            <span className="opacity-0 group-hover/empty:opacity-100 text-[8.5px] font-mono text-slate-400 flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded">
                              <Plus className="w-2.5 h-2.5 text-purple-400" />
                              <span>{isNight ? "Rest / Sleep" : "Add Slot"}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Spanning Activity Cards (Physically merged across full duration!) */}
                    {colBlocks.map(({ block, segStart, segEnd, isCrossStart, isCrossEnd, isCarryOver, isCarryOverConflict, isTomorrowContinuation }, cardIdx) => {
                      const clampedStart = Math.max(segStart, col.startMin);
                      const clampedEnd = Math.min(segEnd, col.endMin);

                      const topPct = ((clampedStart - col.startMin) / 360) * 100;
                      const heightPct = Math.max(5, ((clampedEnd - clampedStart) / 360) * 100);

                      const timingState = getSlotTimingState(block.startTime, block.endTime);
                      const isActive = timingState === "ACTIVE";
                      const isPast = timingState === "PAST";
                      const cfg = CATEGORY_CONFIG[block.category] || CATEGORY_CONFIG.ROUTINE;
                      const IconComp = cfg.icon;
                      const duration = getDurationLabel(block.startTime, block.endTime);
                      const isHovered = hoveredSlotId === block.id;

                      return (
                        <div
                          key={`${col.id}-${block.id}-${segStart}`}
                          onMouseEnter={() => setHoveredSlotId(block.id)}
                          onMouseLeave={() => setHoveredSlotId(null)}
                          onClick={() => {
                            setEditingSlot(block);
                            setIsSlotModalOpen(true);
                          }}
                          style={{
                            top: `${topPct}%`,
                            height: `calc(${heightPct}% - 2px)`,
                            left: "38px",
                            right: "3px",
                            animationDelay: `${colIdx * 90 + Math.min(cardIdx * 45, 300)}ms`,
                          }}
                          className={cn(
                            "absolute z-10 p-2 rounded-xl border transition-all duration-200 cursor-pointer select-none flex flex-col justify-between overflow-hidden animate-timeline-card",
                            isCarryOver && "border-dashed",
                            isCarryOver && isCarryOverConflict
                              ? "bg-rose-950/35 border-rose-500/60 ring-1 ring-rose-500/40"
                              : isCarryOver
                              ? "bg-amber-950/20 border-amber-500/45 hover:border-amber-400/60"
                              : isTomorrowContinuation
                              ? "bg-purple-950/25 border-purple-500/40 hover:border-purple-400/60"
                              : isActive
                              ? "bg-purple-950/60 border-purple-400/90 ring-1 ring-purple-400/80 shadow-[0_0_15px_rgba(168,85,247,0.35)]"
                              : isPast
                              ? "bg-white/[0.04] border-white/10 opacity-70 hover:opacity-100"
                              : isHovered
                              ? "bg-white/[0.08] border-purple-500/50 shadow-md"
                              : "bg-white/[0.05] border-white/15 hover:border-purple-500/40 hover:bg-white/[0.07]"
                          )}
                        >
                          {/* Animated bottom progress bar for active card */}
                          {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-amber-400 transition-all duration-500"
                                style={{ width: `${activeSlotProgress}%` }}
                              />
                            </div>
                          )}

                          {/* Left category accent spine */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{ backgroundColor: cfg.color }}
                          />

                          {/* Top Row: Time, Continuation Badges & State */}
                          <div className="flex items-center justify-between text-[9.5px] font-mono pl-1 gap-1">
                            <div className="flex items-center gap-1.5 font-bold text-white flex-wrap min-w-0">
                              <span className="shrink-0">
                                {isCarryOver
                                  ? `00:00 - ${block.endTime}`
                                  : isCrossStart
                                  ? `↳ ... `
                                  : `${block.startTime} - `}
                                {isTomorrowContinuation
                                  ? `${block.endTime}`
                                  : isCrossEnd
                                  ? `... ↴`
                                  : block.endTime}
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-normal shrink-0">
                                ({duration})
                              </span>

                              {/* Continuation from Yesterday Badge */}
                              {isCarryOver && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm shrink-0",
                                    isCarryOverConflict
                                      ? "bg-rose-500/25 border border-rose-500/40 text-rose-300"
                                      : "bg-amber-500/20 border border-amber-500/35 text-amber-300"
                                  )}
                                >
                                  {isCarryOverConflict ? (
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                  ) : (
                                    <CornerDownRight className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  )}
                                  <span>
                                    {isCarryOverConflict
                                      ? `Conflict: Cont. from yesterday (${block.originalStartTime || "yesterday"})`
                                      : `Cont. from yesterday (${block.originalStartTime || "yesterday"})`}
                                  </span>
                                </span>
                              )}

                              {/* Overnight Forward to Tomorrow Badge */}
                              {isTomorrowContinuation && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/35 text-[8px] font-bold text-indigo-300 shadow-sm shrink-0">
                                  <ArrowRight className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                  <span>Cont. tomorrow (until {block.endTime})</span>
                                </span>
                              )}

                              {/* Same-day Column Crossing Badge */}
                              {!isCarryOver && isCrossStart && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/10 border border-white/15 text-[8px] font-medium text-slate-300 shrink-0">
                                  <span>Cont. from {block.startTime}</span>
                                </span>
                              )}
                            </div>

                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-500/20 border border-purple-400/40 text-[8.5px] font-bold text-purple-300 animate-pulse shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>NOW</span>
                              </span>
                            ) : isPast ? (
                              <span className="text-[8.5px] text-slate-500 shrink-0">PAST</span>
                            ) : null}
                          </div>

                          {/* Middle: Title (Readable, clean wrap) */}
                          <div className="my-auto pl-1 min-w-0">
                            <p
                              className={cn(
                                "text-xs font-semibold leading-snug line-clamp-2 transition-colors",
                                isActive
                                  ? "text-purple-100 font-bold"
                                  : isPast
                                  ? "text-slate-300 group-hover:text-white"
                                  : "text-white group-hover:text-purple-300"
                              )}
                            >
                              {block.title}
                            </p>
                            {block.taskTitle && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono text-amber-300/90 truncate mt-0.5">
                                <Zap className="w-2 h-2 shrink-0 text-amber-400" />
                                <span className="truncate">{block.taskTitle}</span>
                              </span>
                            )}
                          </div>

                          {/* Bottom Row: Category badge & Actions */}
                          {heightPct >= 12 && (
                            <div className="flex items-center justify-between pt-1 pl-1 border-t border-white/5 text-[8.5px] font-mono">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-1 py-0.2 rounded border",
                                  cfg.border,
                                  cfg.bg,
                                  cfg.text
                                )}
                              >
                                <IconComp className="w-2.5 h-2.5" />
                                <span>{cfg.label}</span>
                              </span>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetSlotForTask(block);
                                    setIsKanbanDrawerOpen(true);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-amber-400 cursor-pointer"
                                  title="Attach Kanban Task"
                                >
                                  <Zap className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSlot(block);
                                    setIsSlotModalOpen(true);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-purple-300 cursor-pointer"
                                  title="Edit Slot"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* LIVE DYNAMIC MOVING TIME LINE (Red / Neon Line gliding down minute-by-minute) */}
                    {liveLineTopPct !== null && (
                      <div
                        style={{ top: `${liveLineTopPct}%` }}
                        className="absolute left-0 right-0 z-30 pointer-events-none transition-all duration-1000 flex items-center"
                      >
                        {/* Glowing Pill on the Left */}
                        <div className="bg-red-500 text-white font-mono text-[8px] font-bold px-1 py-0.2 rounded shadow-[0_0_8px_#ef4444] shrink-0 z-40 -ml-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>{nowTime.slice(0, 5)}</span>
                        </div>
                        {/* Glowing Red Line across the column */}
                        <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_10px_#ef4444]" />
                      </div>
                    )}
                  </div>

                  {/* Column Footer */}
                  <div className="shrink-0 text-[9px] font-mono text-slate-500 px-1 pt-0.5 flex items-center justify-between border-t border-white/5">
                    <span>{colBlocks.length} slots</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSlot({
                          date: selectedDate,
                          startTime: col.range.slice(0, 5),
                          endTime: col.range.slice(8, 13),
                          title: "",
                          category: "DEEP_WORK",
                          notes: "",
                        });
                        setIsSlotModalOpen(true);
                      }}
                      className="hover:text-purple-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────── */
          /* MODE 2: 24-HOUR CIRCULAR INFOGRAPHIC WHEEL                      */
          /* (DIRECTLY INSPIRED BY USER'S REFERENCE IMAGE)                   */
          /* ─────────────────────────────────────────────────────────────── */
          <div
            ref={wheelGridRef}
            key={`wheel-${selectedDate}`}
            className="h-full grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden p-1 relative"
          >
            {/* Left Panel: Afternoon & Night Slots (12:00-24:00) */}
            <div className="lg:col-span-3 rounded-2xl bg-white/[0.015] border border-white/10 p-3 shadow-xl backdrop-blur-xl flex flex-col justify-between overflow-hidden">
              <div className="shrink-0 flex items-center gap-2 pb-2 border-b border-white/5 text-[11px] font-mono font-bold text-purple-300">
                <Moon className="w-3.5 h-3.5" />
                <span>AFTERNOON & NIGHT (12:00 - 24:00)</span>
              </div>

              <div
                ref={leftScrollRef}
                onScroll={measure}
                className="flex-1 space-y-2 py-2 overflow-y-auto overflow-x-hidden scrollbar-none"
              >
                {nightPanelSlots.map((item, idx) => {
                    const b = item.slot;
                    const cfg = CATEGORY_CONFIG[b.category] || CATEGORY_CONFIG.ROUTINE;
                    const isNow = getSlotTimingState(b.startTime, b.endTime) === "ACTIVE";
                    const isHovered = hoveredSlotId === b.id;
                    const srcType = getSlotSourceType(b);

                    return (
                      <div
                        key={item.key}
                        ref={(el) => {
                          if (el) leftCardEls.current.set(b.id, el);
                          else leftCardEls.current.delete(b.id);
                        }}
                        onMouseEnter={() => setHoveredSlotId(b.id)}
                        onMouseLeave={() => setHoveredSlotId(null)}
                        onClick={() => {
                          setEditingSlot(b);
                          setIsSlotModalOpen(true);
                        }}
                        style={{ animationDelay: `${100 + Math.min(idx * 45, 450)}ms` }}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-mono group relative",
                          !hasIntroFinished && "animate-card-slide-left",
                          item.isContinuation && "border-dashed",
                          isNow
                            ? "bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                            : isHovered
                            ? "bg-white/[0.08] border-purple-500/50 shadow-md"
                            : item.isContinuation
                            ? "bg-purple-950/20 border-purple-500/40 hover:border-purple-400/60 hover:bg-purple-950/30"
                            : srcType === "PROJECT"
                            ? "bg-amber-950/15 border-amber-500/35 hover:border-amber-400/60 hover:bg-amber-950/25"
                            : srcType === "SKILL"
                            ? "bg-cyan-950/15 border-cyan-500/35 hover:border-cyan-400/60 hover:bg-cyan-950/25"
                            : "bg-white/[0.03] border-white/10 hover:border-purple-500/30"
                        )}
                      >

                        <div className="flex items-center justify-between text-[10px] text-white font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            <span>{item.displayTime}</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            {item.displayDuration}
                          </span>
                        </div>

                        {/* Badges row: side-by-side if more than 1 */}
                        {(item.isContinuation || item.crossLabel || srcType === "PROJECT" || srcType === "SKILL") && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {item.isContinuation && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-purple-300 bg-purple-500/20 border border-purple-500/35 px-1.5 py-0.5 rounded-md shadow-sm shrink-0">
                                <CornerDownRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                                <span>{item.crossLabel}</span>
                              </span>
                            )}
                            {!item.isContinuation && item.crossLabel && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/35 px-1.5 py-0.5 rounded-md shadow-sm shrink-0">
                                <ArrowRight className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                <span>{item.crossLabel}</span>
                              </span>
                            )}
                            {srcType === "PROJECT" && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md shadow-sm shadow-amber-500/20 shrink-0">
                                <Briefcase className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span>PROJECT HUB</span>
                              </span>
                            )}
                            {srcType === "SKILL" && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 rounded-md shadow-sm shadow-cyan-500/20 shrink-0">
                                <Sparkles className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                <span>SKILL MATRIX</span>
                              </span>
                            )}
                          </div>
                        )}

                        <p
                          className={cn(
                            "text-xs font-semibold mt-1 truncate transition-colors",
                            srcType === "PROJECT"
                              ? "text-amber-100 group-hover:text-amber-300"
                              : srcType === "SKILL"
                              ? "text-cyan-100 group-hover:text-cyan-300"
                              : "text-slate-200 group-hover:text-white"
                          )}
                        >
                          {b.title}
                        </p>
                      </div>
                    );
                  })}
              </div>

              <div className="shrink-0 pt-1.5 border-t border-white/5 text-[9px] font-mono text-slate-500 text-center">
                Afternoon & Night on 24H Wheel
              </div>
            </div>

            {/* Center Panel: Large 24-Hour Circular Infographic Wheel */}
            <div ref={wheelCenterRef} className="lg:col-span-6 rounded-2xl bg-white/[0.02] border border-white/10 p-2.5 sm:p-3 shadow-xl backdrop-blur-xl flex flex-col items-center justify-between overflow-hidden relative">
              {/* Top Dial Info */}
              <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 pb-1 border-b border-white/5">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Disc className="w-4 h-4 text-purple-400 animate-spin-slow" />
                  <span>24-HOUR CIRCULAR INFOGRAPHIC WHEEL</span>
                </span>
                <span
                  ref={clockBadgeRef}
                  className="shrink-0 whitespace-nowrap text-[10px] text-purple-300 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 shadow-sm"
                >
                  {nowTime} WIB
                </span>
              </div>

              {/* Large SVG Wheel (Elevated wedges + neutral rest sectors) */}
              <div className="relative flex-1 w-full min-h-0 flex items-center justify-center py-1">
                <div className="relative h-full max-h-full max-w-full aspect-square flex items-center justify-center">
                  <svg
                    key={`wheel-svg-${selectedDate}-${animKey}`}
                    ref={wheelSvgRef}
                    viewBox="0 0 440 440"
                    onMouseLeave={() => {
                      hoveredSlotIdRef.current = null;
                      setHoveredSlotId(null);
                      setWheelFreeTooltip(null);
                    }}
                    className="w-full h-full select-none drop-shadow-2xl animate-wheel-spin"
                  >
                    <defs>
                      <filter id="wheel-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Outer Hour Clock Rim */}
                    <circle
                      cx="220"
                      cy="220"
                      r="192"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.09)"
                      strokeWidth="1.5"
                    />

                    {/* Subdued Baseline Circle for Rest/Empty Sectors */}
                    <circle
                      cx="220"
                      cy="220"
                      r="130"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="3,3"
                      strokeWidth="1"
                    />

                    {/* 24-Hour Precision Tick Marks */}
                    {Array.from({ length: 24 }).map((_, h) => {
                      const angle = (h / 24) * 360;
                      const isMajor = h % 2 === 0;
                      const pStart = polarToCartesian(220, 220, isMajor ? 189 : 193, angle);
                      const pEnd = polarToCartesian(220, 220, 197, angle);
                      return (
                        <line
                          key={`tick-${h}`}
                          x1={pStart.x}
                          y1={pStart.y}
                          x2={pEnd.x}
                          y2={pEnd.y}
                          stroke="#ffffff"
                          strokeWidth={isMajor ? "1.5" : "1"}
                          opacity={isMajor ? 0.35 : 0.12}
                        />
                      );
                    })}

                    {/* Complete 24-Hour Outer Numeric Labels (00, 01, 02, ..., 23) */}
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const angle = (hour / 24) * 360;
                      const pt = polarToCartesian(220, 220, 208, angle);
                      const isEven = hour % 2 === 0;
                      const hourLabel = String(hour).padStart(2, "0");
                      return (
                        <text
                          key={hour}
                          x={pt.x}
                          y={pt.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={isEven ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.38)"}
                          fontSize={isEven ? "9.5" : "8"}
                          fontFamily="monospace"
                          fontWeight={isEven ? "bold" : "normal"}
                        >
                          {hourLabel}
                        </text>
                      );
                    })}

                    {/* ── Layer 1: Free / Empty slots (Low-profile milky-white frosted bar, r = 95 to 105) ── */}
                    {freeIntervals.map((free, idx) => {
                      const startAngle = (free.startMin / 1440) * 360;
                      const endAngle = (free.endMin / 1440) * 360;
                      const isNowFree =
                        isSelectedToday &&
                        nowMinutes >= free.startMin &&
                        nowMinutes < free.endMin;

                      // Short low-profile bar (r = 95 to 105, 10px height, animated with wave progress)
                      const pFree = getSectorProgress(heightProgress, free.startMin);
                      if (heightProgress < 1 && pFree < 0.005) return null;
                      const animFreeRadius = Math.max(95.5, 95 + (105 - 95) * pFree);
                      const wedgeD = describeWedge(220, 220, 95, animFreeRadius, startAngle, endAngle);
                      if (!wedgeD) return null;

                      const startStr = `${String(Math.floor(free.startMin / 60)).padStart(2, "0")}:${String(
                        free.startMin % 60
                      ).padStart(2, "0")}`;
                      const endHour = Math.floor(free.endMin / 60);
                      const endStr =
                        free.endMin === 1440
                          ? "24:00"
                          : `${String(endHour).padStart(2, "0")}:${String(free.endMin % 60).padStart(2, "0")}`;

                      const freeDurMin = free.endMin - free.startMin;
                      const freeDurLabel =
                        freeDurMin >= 60
                          ? `${Math.floor(freeDurMin / 60)}h ${freeDurMin % 60 > 0 ? `${freeDurMin % 60}m` : ""}`.trim()
                          : `${freeDurMin}m`;

                      const freeOpacity =
                        heightProgress === 1
                          ? isNowFree ? 1 : 0.95
                          : (isNowFree ? 1 : 0.95) * Math.min(1, Math.max(0.1, pFree * 2.5));

                      return (
                        <path
                          key={`free-${free.startMin}-${free.endMin}-${idx}`}
                          d={wedgeD}
                          fill={isNowFree ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.42)"}
                          stroke={isNowFree ? "#ffffff" : "rgba(255, 255, 255, 0.65)"}
                          strokeWidth={isNowFree ? "1.5" : "1"}
                          opacity={freeOpacity}
                          className={cn(
                            "cursor-pointer",
                            heightProgress === 1 && "transition-colors duration-200",
                            isNowFree
                              ? "filter drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                              : "hover:opacity-100 hover:fill-white/70 hover:stroke-white"
                          )}
                          onMouseEnter={(e) => {
                            hoveredSlotIdRef.current = null;
                            setHoveredSlotId(null);
                            setWheelFreeTooltip({
                              x: e.clientX,
                              y: e.clientY,
                              startStr,
                              endStr,
                              durationLabel: freeDurLabel,
                              isNowFree: !!isNowFree,
                            });
                          }}
                          onMouseLeave={() => setWheelFreeTooltip(null)}
                          onClick={() => {
                            setWheelFreeTooltip(null);
                            setEditingSlot({
                              date: selectedDate,
                              startTime: startStr,
                              endTime: endStr === "24:00" ? "23:59" : endStr,
                              title: "",
                              category: "ROUTINE",
                              notes: "",
                            });
                            setIsSlotModalOpen(true);
                          }}
                        />
                      );
                    })}

                    {/* ── Layer 2: Dynamic Stepping Timeblock Wedges (Option A Category + Option B Duration Momentum) ── */}
                    {timeblocks.map((block, blockIdx) => {
                      const cfg = CATEGORY_CONFIG[block.category] || CATEGORY_CONFIG.ROUTINE;
                      const isNow = getSlotTimingState(block.startTime, block.endTime) === "ACTIVE";
                      const isHovered = hoveredSlotId === block.id;
                      const srcType = getSlotSourceType(block);

                      // Check if adjacent to another block with the same category
                      const isConsecutiveSameCategory =
                        (blockIdx > 0 && timeblocks[blockIdx - 1].category === block.category) ||
                        (blockIdx < timeblocks.length - 1 && timeblocks[blockIdx + 1].category === block.category);

                      // Subtle zebra variation for adjacent same-category blocks
                      const zebraMult = isConsecutiveSameCategory && blockIdx % 2 === 1 ? 0.78 : 1.0;

                      const segments = getBlockSegments(
                        block.startTime,
                        block.endTime,
                        block.category,
                        isNow,
                        isHovered,
                        srcType
                      );

                      const firstSeg = segments[0];
                      const lastSeg = segments[segments.length - 1];

                      // Dynamic animated radius for divider seams and jewels
                      const pStart = getSectorProgress(heightProgress, firstSeg.startMin);
                      const pEnd = getSectorProgress(heightProgress, lastSeg.startMin);
                      const animFirstRadius = Math.max(95.5, 95 + (firstSeg.radius - 95) * pStart);
                      const animLastRadius = Math.max(95.5, 95 + (lastSeg.radius - 95) * pEnd);

                      // Start & End angles for high-contrast radial dividing lines (Option 1)
                      const blockStartAngle = (firstSeg.startMin / 1440) * 360;
                      const blockEndAngle = (lastSeg.endMin / 1440) * 360;

                      const pStartIn = polarToCartesian(220, 220, 95, blockStartAngle);
                      const pStartOut = polarToCartesian(220, 220, animFirstRadius, blockStartAngle);

                      const pEndIn = polarToCartesian(220, 220, 95, blockEndAngle);
                      const pEndOut = polarToCartesian(220, 220, animLastRadius, blockEndAngle);

                      const lastSegMidMin = (lastSeg.startMin + lastSeg.endMin) / 2;
                      const jewelPt = polarToCartesian(
                        220,
                        220,
                        animLastRadius - 2,
                        (lastSegMidMin / 1440) * 360
                      );

                      return (
                        <g
                          key={`block-${block.id}`}
                          className="cursor-pointer"
                          onMouseEnter={() => handleWheelWedgeHover(block.id)}
                          onMouseLeave={() => {
                            hoveredSlotIdRef.current = null;
                            setHoveredSlotId(null);
                          }}
                          onClick={() => {
                            setEditingSlot(block);
                            setIsSlotModalOpen(true);
                          }}
                        >
                          {segments.map((seg, segIdx) => {
                            const startAngle = (seg.startMin / 1440) * 360;
                            const endAngle = (seg.endMin / 1440) * 360;
                            const pSeg = getSectorProgress(heightProgress, seg.startMin);
                            if (heightProgress < 1 && pSeg < 0.005) return null;
                            const animSegRadius = Math.max(95.5, 95 + (seg.radius - 95) * pSeg);
                            const wedgeD = describeWedge(220, 220, 95, animSegRadius, startAngle, endAngle);
                            if (!wedgeD) return null;

                            const segFillOpacity =
                              heightProgress === 1
                                ? seg.opacity * zebraMult
                                : seg.opacity * zebraMult * Math.min(1, Math.max(0.1, pSeg * 2.5));
                            const segStrokeOpacity =
                              heightProgress === 1 ? 1 : Math.min(1, Math.max(0.1, pSeg * 3));

                            return (
                              <path
                                key={`seg-${block.id}-${segIdx}`}
                                d={wedgeD}
                                fill={cfg.color}
                                fillOpacity={segFillOpacity}
                                stroke={
                                  srcType === "PROJECT"
                                    ? "#f59e0b"
                                    : srcType === "SKILL"
                                    ? "#06b6d4"
                                    : "rgba(255, 255, 255, 0.15)"
                                }
                                strokeOpacity={segStrokeOpacity}
                                strokeWidth={srcType !== "STANDARD" || isHovered || isNow ? "2" : "1"}
                                className={cn(
                                  heightProgress === 1 && "transition-colors duration-200",
                                  isNow
                                    ? "opacity-100 filter drop-shadow-[0_0_12px_currentColor]"
                                    : isHovered
                                    ? "opacity-100 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                                    : "hover:opacity-100"
                                )}
                              />
                            );
                          })}

                          {/* ── Option 1: High-Contrast Radial Hairline Divider Seams at Boundaries ── */}
                          {/* Crisp luminous white line dividing adjacent tasks cleanly on dark background with smooth in/out transitions */}
                          {(heightProgress === 1 || pStart >= 0.05) && (
                            <path
                              d={`M ${pStartIn.x} ${pStartIn.y} L ${pStartOut.x} ${pStartOut.y}`}
                              stroke={isNow ? "#c084fc" : isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.85)"}
                              strokeWidth={isNow || isHovered ? 2.2 : 1.5}
                              strokeLinecap="round"
                              style={{
                                transition: heightProgress === 1 ? "stroke 200ms cubic-bezier(0, 0, 0.2, 1)" : "none",
                              }}
                              className={cn(
                                "pointer-events-none",
                                heightProgress === 1 && "transition-opacity duration-200 ease-out",
                                isNow
                                  ? "opacity-100 filter drop-shadow-[0_0_8px_#c084fc]"
                                  : isHovered
                                  ? "opacity-100 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]"
                                  : "opacity-85 filter drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                              )}
                              opacity={
                                heightProgress === 1
                                  ? undefined
                                  : Math.min(1, Math.max(0, (pStart - 0.05) * 3))
                              }
                            />
                          )}
                          {(heightProgress === 1 || pEnd >= 0.05) && (
                            <path
                              d={`M ${pEndIn.x} ${pEndIn.y} L ${pEndOut.x} ${pEndOut.y}`}
                              stroke={isNow ? "#c084fc" : isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.85)"}
                              strokeWidth={isNow || isHovered ? 2.2 : 1.5}
                              strokeLinecap="round"
                              style={{
                                transition: heightProgress === 1 ? "stroke 200ms cubic-bezier(0, 0, 0.2, 1)" : "none",
                              }}
                              className={cn(
                                "pointer-events-none",
                                heightProgress === 1 && "transition-opacity duration-200 ease-out",
                                isNow
                                  ? "opacity-100 filter drop-shadow-[0_0_8px_#c084fc]"
                                  : isHovered
                                  ? "opacity-100 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]"
                                  : "opacity-85 filter drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                              )}
                              opacity={
                                heightProgress === 1
                                  ? undefined
                                  : Math.min(1, Math.max(0, (pEnd - 0.05) * 3))
                              }
                            />
                          )}

                          {/* Special Project Hub Rim Jewel Dot on Peak Step */}
                          {srcType === "PROJECT" && (heightProgress === 1 || pEnd >= 0.1) && (
                            <circle
                              cx={jewelPt.x}
                              cy={jewelPt.y}
                              r="3"
                              fill="#f59e0b"
                              stroke="#ffffff"
                              strokeWidth="1"
                              opacity={heightProgress === 1 ? 1 : Math.min(1, Math.max(0, (pEnd - 0.1) * 3))}
                              className="animate-pulse drop-shadow-[0_0_8px_#f59e0b] pointer-events-none"
                            />
                          )}
                          {/* Special Skill Matrix Rim Jewel Dot on Peak Step */}
                          {srcType === "SKILL" && (heightProgress === 1 || pEnd >= 0.1) && (
                            <circle
                              cx={jewelPt.x}
                              cy={jewelPt.y}
                              r="3"
                              fill="#06b6d4"
                              stroke="#ffffff"
                              strokeWidth="1"
                              opacity={heightProgress === 1 ? 1 : Math.min(1, Math.max(0, (pEnd - 0.1) * 3))}
                              className="animate-pulse drop-shadow-[0_0_8px_#06b6d4] pointer-events-none"
                            />
                          )}
                        </g>
                      );
                    })}


                    {/* Real-time Moving Needle */}
                    {isSelectedToday && (() => {
                      const needleAngle = (nowMinutes / 1440) * 360;
                      const pStart = polarToCartesian(220, 220, 95, needleAngle);
                      const pTip = polarToCartesian(220, 220, 186, needleAngle);
                      return (
                        <>
                          <line
                            x1={pStart.x}
                            y1={pStart.y}
                            x2={pTip.x}
                            y2={pTip.y}
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            strokeDasharray="3,3"
                            opacity="0.9"
                          />
                          <circle
                            cx={pTip.x}
                            cy={pTip.y}
                            r="6.5"
                            fill="#ffffff"
                            stroke="#c084fc"
                            strokeWidth="2"
                            className="drop-shadow-[0_0_12px_#ffffff] animate-pulse"
                          />
                        </>
                      );
                    })()}

                    {/* Center Donut Hole (Cockpit info) */}
                    <circle
                      cx="220"
                      cy="220"
                      r="88"
                      fill="#0c0c14"
                      stroke="rgba(255, 255, 255, 0.14)"
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Center Donut Hole Overlay Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none animate-cockpit-reveal">
                    {currentActiveSlot ? (
                      <div className="flex flex-col items-center space-y-1 max-w-[150px]">
                        {(() => {
                          const activeSrc = getSlotSourceType(currentActiveSlot);
                          if (activeSrc === "PROJECT") {
                            return (
                              <span className="flex items-center gap-1 text-[8.5px] font-mono uppercase font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 shadow-sm shadow-amber-500/20">
                                <Briefcase className="w-2.5 h-2.5 text-amber-400" />
                                <span>PROJECT DIRECTIVE</span>
                              </span>
                            );
                          }
                          if (activeSrc === "SKILL") {
                            return (
                              <span className="flex items-center gap-1 text-[8.5px] font-mono uppercase font-bold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
                                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                                <span>SKILL MATRIX</span>
                              </span>
                            );
                          }
                          return (
                            <span className="flex items-center gap-1 text-[9px] font-mono uppercase font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>ACTIVE NOW</span>
                            </span>
                          );
                        })()}
                        <p className="text-xs font-bold text-white leading-snug line-clamp-2 w-full px-1">
                          {currentActiveSlot.title}
                        </p>
                        <p className="text-[10px] font-mono text-purple-300 font-semibold">
                          {activeSlotRemainingMinutes}m remaining
                        </p>
                        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all"
                            style={{ width: `${activeSlotProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-1.5 max-w-[150px]">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                          <Moon className="w-4 h-4 text-indigo-400" />
                        </div>
                        <span className="text-xs font-mono text-slate-300 font-bold tracking-wider">
                          FREE TIME
                        </span>
                        <p className="text-[10px] font-mono text-slate-500">
                          {nextUpcomingSlot ? `Next: ${nextUpcomingSlot.startTime}` : "Free Time"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Wheel Legend */}
              <div className="w-full flex items-center justify-between text-[9.5px] font-mono text-slate-400 pt-1 border-t border-white/5">
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-purple-500" />
                    <span>Raised Sector = Scheduled</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-slate-200/30 border border-white/40" />
                    <span>Low Bar = Free Time</span>
                  </span>
                </span>
                <span className="text-white font-bold">{stats.totalScheduledHours}h Scheduled</span>
              </div>
            </div>

            {/* Right Panel: Morning & Midday Slots (00:00-12:00) */}
            <div className="lg:col-span-3 rounded-2xl bg-white/[0.015] border border-white/10 p-3 shadow-xl backdrop-blur-xl flex flex-col justify-between overflow-hidden">
              <div className="shrink-0 flex items-center gap-2 pb-2 border-b border-white/5 text-[11px] font-mono font-bold text-amber-300">
                <Sun className="w-3.5 h-3.5" />
                <span>MORNING & MIDDAY (00:00 - 12:00)</span>
              </div>

              <div
                ref={rightScrollRef}
                onScroll={measure}
                className="flex-1 space-y-2 py-2 overflow-y-auto overflow-x-hidden scrollbar-none"
              >
                {morningPanelSlots.map((item, idx) => {
                    const b = item.slot;
                    const cfg = CATEGORY_CONFIG[b.category] || CATEGORY_CONFIG.ROUTINE;
                    const isNow = getSlotTimingState(b.startTime, b.endTime) === "ACTIVE";
                    const isHovered = hoveredSlotId === b.id;
                    const srcType = getSlotSourceType(b);

                    return (
                      <div
                        key={item.key}
                        ref={(el) => {
                          if (el) rightCardEls.current.set(b.id, el);
                          else rightCardEls.current.delete(b.id);
                        }}
                        onMouseEnter={() => setHoveredSlotId(b.id)}
                        onMouseLeave={() => setHoveredSlotId(null)}
                        onClick={() => {
                          setEditingSlot(b);
                          setIsSlotModalOpen(true);
                        }}
                        style={{ animationDelay: `${120 + Math.min(idx * 45, 450)}ms` }}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-mono group relative",
                          !hasIntroFinished && "animate-card-slide-right",
                          item.isContinuation && "border-dashed",
                          item.hasConflictWithToday
                            ? "bg-rose-950/30 border-rose-500/50 hover:border-rose-400/80 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                            : isNow
                            ? "bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                            : isHovered
                            ? "bg-white/[0.08] border-purple-500/50 shadow-md"
                            : item.isContinuation
                            ? "bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60 hover:bg-amber-950/30"
                            : srcType === "PROJECT"
                            ? "bg-amber-950/15 border-amber-500/35 hover:border-amber-400/60 hover:bg-amber-950/25"
                            : srcType === "SKILL"
                            ? "bg-cyan-950/15 border-cyan-500/35 hover:border-cyan-400/60 hover:bg-cyan-950/25"
                            : "bg-white/[0.03] border-white/10 hover:border-purple-500/30"
                        )}
                      >
                        <div className="flex items-center justify-between text-[10px] text-white font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            <span>{item.displayTime}</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            {item.displayDuration}
                          </span>
                        </div>

                        {/* Badges row: side-by-side if more than 1 */}
                        {(item.isContinuation || item.crossLabel || srcType === "PROJECT" || srcType === "SKILL") && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {item.isContinuation && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-sm shrink-0",
                                  item.hasConflictWithToday
                                    ? "text-rose-300 bg-rose-500/20 border border-rose-500/35"
                                    : "text-amber-300 bg-amber-500/20 border border-amber-500/35"
                                )}
                              >
                                {item.hasConflictWithToday ? (
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                ) : (
                                  <CornerDownRight className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                )}
                                <span>{item.crossLabel}</span>
                              </span>
                            )}
                            {!item.isContinuation && item.crossLabel && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-500/35 px-1.5 py-0.5 rounded-md shadow-sm shrink-0">
                                <ArrowRight className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span>{item.crossLabel}</span>
                              </span>
                            )}
                            {srcType === "PROJECT" && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md shadow-sm shadow-amber-500/20 shrink-0">
                                <Briefcase className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span>PROJECT HUB</span>
                              </span>
                            )}
                            {srcType === "SKILL" && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 rounded-md shadow-sm shadow-cyan-500/20 shrink-0">
                                <Sparkles className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                <span>SKILL MATRIX</span>
                              </span>
                            )}
                          </div>
                        )}

                        <p
                          className={cn(
                            "text-xs font-semibold mt-1 truncate transition-colors",
                            srcType === "PROJECT"
                              ? "text-amber-100 group-hover:text-amber-300"
                              : srcType === "SKILL"
                              ? "text-cyan-100 group-hover:text-cyan-300"
                              : "text-slate-200 group-hover:text-white"
                          )}
                        >
                          {b.title}
                        </p>
                      </div>
                    );
                  })}
              </div>

              <div className="shrink-0 pt-1.5 border-t border-white/5 text-[9px] font-mono text-slate-500 text-center">
                Morning & Midday on 24H Wheel
              </div>
            </div>

            {/* ─── Connector Lines Overlay SVG ─── */}
            {/* Cascades clockwise in turn: Right Top -> Right Bottom -> Left Bottom -> Left Top */}
            <svg
              key={`connectors-${selectedDate}-${animKey}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 50, overflow: "visible" }}
            >
              <defs>
                {clockBadgeRect && (
                  <mask id="exclude-clock-badge">
                    {/* Entire canvas is visible */}
                    <rect x="-500" y="-500" width="3000" height="3000" fill="white" />
                    {/* Punch out clock badge area with padding so no line touches it */}
                    <rect
                      x={clockBadgeRect.x - 4}
                      y={clockBadgeRect.y - 3}
                      width={clockBadgeRect.width + 8}
                      height={clockBadgeRect.height + 6}
                      rx={6}
                      fill="black"
                    />
                  </mask>
                )}
              </defs>

              <g mask={clockBadgeRect ? "url(#exclude-clock-badge)" : undefined}>
                {connectorLines.map((line) => {
                  const isHovered = (hoveredSlotId ?? hoveredSlotIdRef.current) === line.id;
                  const hi = line.isActive || isHovered;
                  return (
                    <g
                      key={`cl-${selectedDate}-${animKey}-${line.side}-${line.id}`}
                      style={{
                        animation:
                          hasIntroFinished || hi
                            ? "none"
                            : `connector-line-fade 0.25s ease-out ${line.animDelay}ms both`,
                      }}
                      className="transition-opacity duration-300"
                    >
                      {/* Angled leader line path from card edge → margin channel → wheel rim */}
                      <path
                        d={line.pathD}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={hi ? 2 : 1.2}
                        strokeDasharray={hi ? "6,3" : "5,4"}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={hi ? 1 : 0.55}
                        className={hi ? "drop-shadow-[0_0_6px_currentColor]" : ""}
                      />
                      {/* Dot at card edge (x1/y1) */}
                      <circle
                        cx={line.x1}
                        cy={line.y1}
                        r={hi ? 4.5 : 3}
                        fill={line.color}
                        opacity={hi ? 1 : 0.7}
                      />
                      {/* Dot at wheel rim (x2/y2) */}
                      <circle
                        cx={line.x2}
                        cy={line.y2}
                        r={hi ? 4.5 : 3}
                        fill={hi ? "#ffffff" : line.color}
                        stroke={line.color}
                        strokeWidth={1.5}
                        opacity={hi ? 1 : 0.75}
                      />
                    </g>
                  );
                })}
              </g>
            </svg>

          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4.5. CUSTOM FLOATING TOOLTIPS (Portalled directly to document.body) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Custom Tooltip for Free/Unscheduled Slots on the 24H Wheel */}
      {wheelFreeTooltip && (
        <FloatingPortalTooltip
          initialX={wheelFreeTooltip.x}
          initialY={wheelFreeTooltip.y}
          minWidth={190}
          clampPad={130}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  wheelFreeTooltip.isNowFree ? "bg-emerald-400 animate-pulse" : "bg-sky-400"
                )}
              />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                {wheelFreeTooltip.isNowFree ? "Current Free Time" : "Unscheduled Time"}
              </span>
            </div>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-bold">
              {wheelFreeTooltip.durationLabel}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-200 py-0.5 font-bold">
            <span>{wheelFreeTooltip.startStr} - {wheelFreeTooltip.endStr}</span>
          </div>

          <div className="flex items-center gap-1 text-[9.5px] text-purple-400 font-sans font-medium pt-1 border-t border-white/5">
            <Plus className="w-3 h-3" />
            <span>Click to schedule slot</span>
          </div>
        </FloatingPortalTooltip>
      )}

      {/* Custom Tooltip for the Top 24-Hour Panoramic Timeline Ribbon */}
      {ribbonTooltip && (
        <FloatingPortalTooltip
          initialX={ribbonTooltip.x}
          initialY={ribbonTooltip.y}
          minWidth={210}
          maxWidth={300}
          clampPad={150}
        >
          {ribbonTooltip.block ? (() => {
            const b = ribbonTooltip.block;
            const cfg = CATEGORY_CONFIG[b.category] || CATEGORY_CONFIG.ROUTINE;
            const timingState = getSlotTimingState(b.startTime, b.endTime);
            const isActive = timingState === "ACTIVE";
            const duration = getDurationLabel(b.startTime, b.endTime);
            const s = timeToMinutes(b.startTime);
            const e = timeToMinutes(b.endTime);
            const isOvernightOrigin = s > e;

            return (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider truncate"
                      style={{ color: cfg.color }}
                    >
                      {b.category.replace("_", " ")}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0",
                      isActive
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse"
                        : timingState === "PAST"
                        ? "bg-white/10 text-slate-400"
                        : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    )}
                  >
                    {timingState}
                  </span>
                </div>

                <div className="text-xs font-semibold text-white truncate font-sans">
                  {b.title}
                </div>

                <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                  <span className="font-bold text-white">
                    {b.startTime} - {b.endTime}
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                    {duration}
                  </span>
                </div>

                {b.isCarryOverFromYesterday && (
                  <div className="text-[9.5px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    ⮑ Cont. from yesterday ({b.originalStartTime || "yesterday"})
                  </div>
                )}
                {isOvernightOrigin && (
                  <div className="text-[9.5px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                    🌙 Cont. tomorrow (until {b.endTime})
                  </div>
                )}

                <div className="flex items-center justify-between text-[9px] text-slate-500 font-sans pt-1 border-t border-white/5">
                  <span>Click to edit block</span>
                  <span className="text-purple-400 font-mono">edit</span>
                </div>
              </>
            );
          })() : ribbonTooltip.freeInfo ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      ribbonTooltip.freeInfo.isNowFree ? "bg-emerald-400 animate-pulse" : "bg-sky-400"
                    )}
                  />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {ribbonTooltip.freeInfo.isNowFree ? "Current Free Time" : "Unscheduled Time"}
                  </span>
                </div>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-bold">
                  {ribbonTooltip.freeInfo.durationLabel}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-200 py-0.5 font-bold">
                <span>{ribbonTooltip.freeInfo.startStr} - {ribbonTooltip.freeInfo.endStr}</span>
              </div>

              <div className="flex items-center gap-1 text-[9.5px] text-purple-400 font-sans font-medium pt-1 border-t border-white/5">
                <Plus className="w-3 h-3" />
                <span>Click to schedule slot</span>
              </div>
            </>
          ) : null}
        </FloatingPortalTooltip>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. MODALS & DIALOGS                                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Modal A: Add / Edit Slot Dialog (Standard App Modal Style) */}
      <Dialog open={isSlotModalOpen} onOpenChange={setIsSlotModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono"
        >
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span>{editingSlot?.id ? "EDIT ROUTINE SLOT" : "NEW ROUTINE SLOT"}</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsSlotModalOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form
            onSubmit={handleSaveSlot}
            className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3"
          >
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4">
              {/* Overnight Carryover Notice Banner */}
              {editingSlot?.isCarryOverFromYesterday && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
                  <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-bold text-amber-300">Overnight Carryover from Yesterday</p>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                      This routine slot originates from {editingSlot.originalDate} ({editingSlot.originalStartTime} - {editingSlot.endTime}). To modify or remove this task, please edit it on its origin date.
                    </p>
                    {editingSlot.originalDate && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedDate(editingSlot.originalDate!);
                          setIsSlotModalOpen(false);
                        }}
                        className="mt-1 bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 border border-amber-500/40 text-[11px] h-7 px-3 rounded-xl font-mono cursor-pointer"
                      >
                        Jump to {editingSlot.originalDate}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Activity Title with Options & Suggestions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300">Activity Title *</label>
                  <span className="text-[10px] text-slate-400 font-mono">Type or pick option below</span>
                </div>
                <Input
                  required
                  placeholder="e.g., Deep Work: Feature Development"
                  value={editingSlot?.title || ""}
                  onChange={(e) =>
                    setEditingSlot((prev) =>
                      prev ? { ...prev, title: e.target.value } : { title: e.target.value }
                    )
                  }
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-purple-500/50"
                />

                {/* Suggestions Section: Projects, Skills, Presets */}
                <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>SUGGESTIONS</span>
                    </span>
                    <div className="flex items-center gap-1 text-[9.5px] font-mono">
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("ALL")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "ALL"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("PROJECTS")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "PROJECTS"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Projects ({projectSuggestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("SKILLS")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "SKILLS"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Skills ({skillSuggestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("PRESETS")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "PRESETS"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Presets
                      </button>
                    </div>
                  </div>

                  {/* Suggestions Pills List (Fixed Height) */}
                  <div className="flex flex-wrap gap-1.5 h-28 overflow-y-auto pr-1 scrollbar-thin content-start">
                    {/* Projects from ProjectHub */}
                    {(activeSuggestionTab === "ALL" || activeSuggestionTab === "PROJECTS") &&
                      projectSuggestions.map((proj) => (
                        <button
                          key={`proj-${proj.id}`}
                          type="button"
                          onClick={() => {
                            setEditingSlot((prev) => ({
                              ...(prev || {}),
                              title: `Project: ${proj.name}`,
                              category: "BUSINESS",
                            }));
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-mono bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                          title={`Click to use Project: ${proj.name}`}
                        >
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{proj.name}</span>
                        </button>
                      ))}

                    {/* Skills from Skill Matrix */}
                    {(activeSuggestionTab === "ALL" || activeSuggestionTab === "SKILLS") &&
                      skillSuggestions.map((sk) => (
                        <button
                          key={`sk-${sk.id}`}
                          type="button"
                          onClick={() => {
                            setEditingSlot((prev) => ({
                              ...(prev || {}),
                              title: `Skill: ${sk.title}`,
                              category: "DEEP_WORK",
                            }));
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-mono bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                          title={`Click to practice Skill: ${sk.title}`}
                        >
                          <Sparkles className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{sk.title}</span>
                        </button>
                      ))}

                    {/* Quick Presets */}
                    {(activeSuggestionTab === "ALL" || activeSuggestionTab === "PRESETS") &&
                      QUICK_PRESETS.map((preset, idx) => {
                        const IconComp = preset.icon;
                        return (
                          <button
                            key={`preset-${idx}`}
                            type="button"
                            onClick={() => {
                              setEditingSlot((prev) => ({
                                ...(prev || {}),
                                title: preset.title,
                                category: preset.category,
                              }));
                            }}
                            className="px-2 py-1 rounded-xl text-[10px] font-mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <IconComp className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                            <span>{preset.title}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Start & End Time (Custom GlassTimePicker) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Start Time *</span>
                  </label>
                  <GlassTimePicker
                    value={editingSlot?.startTime || "09:00"}
                    onChange={(val) =>
                      setEditingSlot((prev) =>
                        prev ? { ...prev, startTime: val } : { startTime: val }
                      )
                    }
                    placeholder="Start Time..."
                    accentColor="purple"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>End Time *</span>
                  </label>
                  <GlassTimePicker
                    value={editingSlot?.endTime || "10:00"}
                    onChange={(val) =>
                      setEditingSlot((prev) =>
                        prev ? { ...prev, endTime: val } : { endTime: val }
                      )
                    }
                    placeholder="End Time..."
                    accentColor="purple"
                  />
                </div>
              </div>

              {/* Real-time Time Collision Warning Banner */}
              {slotConflict.hasConflict && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-300">Schedule Collision Detected</p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed font-sans">
                      {slotConflict.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Real-time Next-Day Schedule Collision Warning Banner */}
              {nextDayConflict.hasConflict && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-300">Tomorrow Schedule Collision Detected</p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed font-sans">
                      {nextDayConflict.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Category *</label>
                <Select
                  value={editingSlot?.category || "ROUTINE"}
                  onValueChange={(val) =>
                    setEditingSlot((prev) =>
                      prev
                        ? { ...prev, category: val || "ROUTINE" }
                        : { category: val || "ROUTINE" }
                    )
                  }
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-purple-500/50">
                    <div className="flex items-center gap-2 flex-1 text-left">
                      {editingSlot?.category && CATEGORY_CONFIG[editingSlot.category] ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_CONFIG[editingSlot.category].color }}
                          />
                          <span className="text-white font-medium">
                            {CATEGORY_CONFIG[editingSlot.category].label}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Select Category</span>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-white font-mono text-xs rounded-2xl p-1 shadow-2xl">
                    <SelectItem value="DEEP_WORK">🟣 Deep Work</SelectItem>
                    <SelectItem value="BUSINESS">🟠 Business</SelectItem>
                    <SelectItem value="HEALTH">🟢 Health / Meals</SelectItem>
                    <SelectItem value="PRAYER">🟡 Prayer</SelectItem>
                    <SelectItem value="MEETING">🔵 Meeting</SelectItem>
                    <SelectItem value="ROUTINE">⚪ Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Notes (Optional)</label>
                <Input
                  placeholder="e.g., Focus milestones or guidelines..."
                  value={editingSlot?.notes || ""}
                  onChange={(e) =>
                    setEditingSlot((prev) =>
                      prev ? { ...prev, notes: e.target.value } : { notes: e.target.value }
                    )
                  }
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-purple-500/50"
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-4 border-t border-white/10 flex items-center justify-between gap-3 mt-3">
              {editingSlot?.id && !editingSlot?.isCarryOverFromYesterday ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setSlotToDelete(editingSlot as TimeblockItem);
                    setIsSlotModalOpen(false);
                  }}
                  className="h-11 px-4 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-mono cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSlotModalOpen(false)}
                  className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 px-5 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    slotConflict.hasConflict ||
                    nextDayConflict.hasConflict ||
                    !!editingSlot?.isCarryOverFromYesterday ||
                    isSavingSlot
                  }
                  className={cn(
                    "font-mono text-xs font-bold rounded-2xl h-11 px-6 shadow-lg transition-all flex items-center gap-2",
                    slotConflict.hasConflict ||
                      nextDayConflict.hasConflict ||
                      !!editingSlot?.isCarryOverFromYesterday ||
                      isSavingSlot
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-50 shadow-none"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 cursor-pointer"
                  )}
                >
                  {isSavingSlot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Slot</span>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Standard App Confirmation Modal: Delete Routine Slot */}
      <Dialog open={!!slotToDelete} onOpenChange={(open) => !open && setSlotToDelete(null)}>
        <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-7 h-7 animate-pulse" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">
              {slotToDelete && slotToDelete.id > 0 && slotToDelete.masterRoutineId
                ? "RESTORE MASTER TEMPLATE"
                : slotToDelete && slotToDelete.id < 0
                ? "REMOVE ROUTINE SLOT"
                : "DELETE CUSTOM SLOT"}
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
              {slotToDelete && slotToDelete.id > 0 && slotToDelete.masterRoutineId ? (
                <>
                  Slot <span className="text-rose-300 font-bold">&quot;{slotToDelete?.title}&quot;</span> has custom changes. Deleting it will restore the default master template for this slot.
                </>
              ) : slotToDelete && slotToDelete.id < 0 ? (
                <>
                  Are you sure you want to remove <span className="text-rose-300 font-bold">&quot;{slotToDelete?.title}&quot;</span> from today&apos;s routine? (You can restore all default slots anytime by clicking &quot;Reset&quot;).
                </>
              ) : (
                <>
                  Are you sure you want to delete slot <span className="text-rose-300 font-bold">&quot;{slotToDelete?.title}&quot;</span> ({slotToDelete?.startTime} - {slotToDelete?.endTime})?
                </>
              )}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {slotToDelete && slotToDelete.id > 0 && slotToDelete.masterRoutineId
                ? "The original master routine template will be restored."
                : "This action will affect today's schedule."}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSlotToDelete(null)}
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeletingSlot}
              onClick={handleConfirmDeleteSlot}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer flex items-center justify-center gap-2"
            >
              {isDeletingSlot ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-rose-200" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>
                  {slotToDelete && slotToDelete.id > 0 && slotToDelete.masterRoutineId
                    ? "Restore Master"
                    : "Delete Slot"}
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Standard App Confirmation Modal: Delete Daily Habit */}
      <Dialog open={!!habitToDelete} onOpenChange={(open) => !open && setHabitToDelete(null)}>
        <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-sm p-5 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">DELETE HABIT</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
              Are you sure you want to delete habit <span className="text-rose-300 font-bold">&quot;{habitToDelete?.title}&quot;</span>?
            </p>
            <p className="text-[10px] text-slate-500 mt-1">This will permanently remove this habit and all its logged history.</p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHabitToDelete(null)}
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-xl h-9 text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeletingHabit}
              onClick={handleConfirmDeleteHabit}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl h-9 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer flex items-center justify-center gap-2"
            >
              {isDeletingHabit ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-200" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Habit</span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Standard App Confirmation Modal: Reset Day Routine to Master */}
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#16131c] border-purple-500/30 text-slate-100 rounded-3xl max-w-lg max-h-[85vh] p-6 shadow-2xl backdrop-blur-2xl font-mono flex flex-col space-y-4"
        >
          <div className="flex items-center gap-3 pb-2 border-b border-white/10 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <RotateCcw className="w-5 h-5 text-purple-400 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                RESET TO MASTER PROTOCOL
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Revert <strong className="text-white">{selectedDate}</strong> back to default{" "}
                <strong className="text-purple-300">{dayProfile}</strong> template.
              </p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {customSlotsToClear.length > 0 ? (
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-rose-300 font-bold flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Slots to be cleared ({customSlotsToClear.length}):</span>
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    Will restore {dayProfile} template
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white/[0.02] border border-white/10 rounded-2xl scrollbar-thin">
                  {customSlotsToClear.map((slot) => {
                    const cfg = CATEGORY_CONFIG[slot.category] || CATEGORY_CONFIG.ROUTINE;
                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-2 px-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            {slot.startTime} - {slot.endTime}
                          </span>
                          <span className="text-white truncate font-medium">{slot.title}</span>
                        </div>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.color }}
                          title={cfg.label}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-slate-400 font-sans leading-relaxed">
                  These {customSlotsToClear.length} custom slot{customSlotsToClear.length > 1 ? "s" : ""} will be removed. Resetting will restore the clean recurring Master Protocol template for {dayProfile}.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-2 my-2 font-sans">
                <div className="w-9 h-9 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  No Custom Slots to Clear
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                  All active slots on this date currently match the default{" "}
                  <strong className="text-purple-300">{dayProfile}</strong> Master Protocol template. Resetting will re-sync and restore the fresh template.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-white/10 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetConfirmOpen(false)}
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isResettingDay}
              onClick={handleConfirmResetToMaster}
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-purple-600/40 cursor-pointer flex items-center justify-center gap-2"
            >
              {isResettingDay ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Resetting...</span>
                </>
              ) : (
                <span>
                  {customSlotsToClear.length > 0
                    ? `Reset Protocol (${customSlotsToClear.length})`
                    : "Reset Protocol"}
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal B: Attach Task from Omni-Kanban */}
      <Dialog open={isKanbanDrawerOpen} onOpenChange={setIsKanbanDrawerOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg max-h-[88vh] p-6 font-mono shadow-2xl backdrop-blur-2xl flex flex-col"
        >
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>ATTACH KANBAN TASK</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsKanbanDrawerOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <p className="text-xs text-slate-300 pt-2">
            Select an active Omni-Kanban task to link to slot{" "}
            <strong className="text-white">
              {targetSlotForTask?.startTime} - {targetSlotForTask?.endTime}
            </strong>
            :
          </p>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin my-3">
            {targetSlotForTask?.taskId && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between mb-2">
                <span className="text-xs text-rose-300 font-medium">Task currently attached</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    handleDetachTask(targetSlotForTask.id);
                    setIsKanbanDrawerOpen(false);
                  }}
                  className="h-8 text-xs px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono cursor-pointer"
                >
                  Detach Task
                </Button>
              </div>
            )}

            {kanbanTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No active tasks found in Omni-Kanban.
              </div>
            ) : (
              kanbanTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleAttachTask(t)}
                  className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-purple-500/40 flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs font-semibold text-white group-hover:text-purple-300 truncate">
                      {t.title}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {t.projectName || "General Project"} • Priority: {t.priority}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-purple-500/30 text-purple-300 bg-purple-500/10 shrink-0"
                  >
                    Select
                  </Badge>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsKanbanDrawerOpen(false)}
              className="w-full border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal C: Manage Master Routines (Weekday, Friday, Weekend) */}
      <Dialog
        open={isMasterModalOpen}
        onOpenChange={(open) => {
          setIsMasterModalOpen(open);
          if (!open) loadData(selectedDate);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl max-h-[88vh] p-6 font-mono shadow-2xl backdrop-blur-2xl flex flex-col"
        >
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              <span>MASTER ROUTINE PROTOCOLS</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => {
                setIsMasterModalOpen(false);
                loadData(selectedDate);
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          {/* Profile Tabs & Add Slot Header */}
          <div className="shrink-0 flex items-center justify-between gap-2 my-3">
            <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/10 flex-1">
              {(["WEEKDAY", "FRIDAY", "WEEKEND"] as DayProfileType[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => loadMasterRoutines(tab)}
                  className={cn(
                    "flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer",
                    masterProfileTab === tab
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {tab === "FRIDAY"
                    ? "🕌 Friday"
                    : tab === "WEEKEND"
                    ? "🚀 Weekend"
                    : "⚡ Weekday"}
                </button>
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingMasterSlot({
                  id: null,
                  dayProfile: masterProfileTab,
                  startTime: "09:00",
                  endTime: "10:00",
                  title: "",
                  category: "DEEP_WORK",
                });
                setIsMasterSlotDialogOpen(true);
              }}
              className="h-10 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-2xl text-xs font-mono font-bold shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-purple-400" />
              Add Slot
            </Button>
          </div>

          <p className="text-[11px] text-slate-400 font-mono mb-2 shrink-0">
            Click any recurring slot below to edit or modify its schedule:
          </p>

          {/* Master Slots List */}
          <div className="overflow-y-auto flex-1 space-y-2 pr-1 scrollbar-thin my-1 min-h-0">
            {masterRoutines.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No routine templates registered for this profile.
              </div>
            ) : (
              masterRoutines.map((mr) => {
                const catCfg = CATEGORY_CONFIG[mr.category] || CATEGORY_CONFIG.ROUTINE;
                const CatIcon = catCfg.icon;

                return (
                  <div
                    key={mr.id}
                    onClick={() => {
                      setEditingMasterSlot({
                        id: mr.id,
                        dayProfile: masterProfileTab,
                        startTime: mr.startTime,
                        endTime: mr.endTime,
                        title: mr.title,
                        category: mr.category,
                      });
                      setIsMasterSlotDialogOpen(true);
                    }}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/30 flex items-center justify-between text-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <span className="font-mono text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl font-bold text-slate-300 shrink-0">
                        {mr.startTime} - {mr.endTime}
                      </span>
                      <span className="truncate text-white font-medium group-hover:text-purple-300 transition-colors">
                        {mr.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono border",
                          catCfg.bg,
                          catCfg.text,
                          catCfg.border
                        )}
                      >
                        <CatIcon className="w-3 h-3 shrink-0" />
                        <span>{catCfg.label}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMasterSlot({
                            id: mr.id,
                            dayProfile: masterProfileTab,
                            startTime: mr.startTime,
                            endTime: mr.endTime,
                            title: mr.title,
                            category: mr.category,
                          });
                          setIsMasterSlotDialogOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Edit slot"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMasterSlotToDelete({ id: mr.id, title: mr.title });
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
                        title="Delete slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsMasterModalOpen(false);
                loadData(selectedDate);
              }}
              className="w-full border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal D: Direct Edit / Add Master Routine Slot */}
      <Dialog
        open={isMasterSlotDialogOpen}
        onOpenChange={setIsMasterSlotDialogOpen}
      >
        <DialogContent
          showCloseButton={false}
          className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono"
        >
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              <span>
                {editingMasterSlot?.id ? "EDIT MASTER PROTOCOL SLOT" : "NEW MASTER PROTOCOL SLOT"}
              </span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsMasterSlotDialogOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form
            onSubmit={handleSaveMasterSlot}
            className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3"
          >
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4">
              {/* Day Profile Indicator */}
              <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-xs">
                <span className="text-purple-300 font-bold">Day Profile Template:</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] uppercase border-purple-500/40 text-purple-200 bg-purple-500/20 px-2.5 py-0.5"
                >
                  {editingMasterSlot?.dayProfile === "FRIDAY"
                    ? "🕌 Friday"
                    : editingMasterSlot?.dayProfile === "WEEKEND"
                    ? "🚀 Weekend"
                    : "⚡ Weekday"}
                </Badge>
              </div>

              {/* Activity Title with Options & Suggestions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300">Activity Title *</label>
                  <span className="text-[10px] text-slate-400 font-mono">Type or pick option below</span>
                </div>
                <Input
                  required
                  placeholder="e.g., Deep Work: System Architecture"
                  value={editingMasterSlot?.title || ""}
                  onChange={(e) =>
                    setEditingMasterSlot((prev) =>
                      prev ? { ...prev, title: e.target.value } : { title: e.target.value } as any
                    )
                  }
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-purple-500/50"
                />

                {/* Suggestions Section: Projects, Skills, Presets */}
                <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>SUGGESTIONS</span>
                    </span>
                    <div className="flex items-center gap-1 text-[9.5px] font-mono">
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("ALL")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "ALL"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("PROJECTS")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "PROJECTS"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Projects ({projectSuggestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("SKILLS")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "SKILLS"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Skills ({skillSuggestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSuggestionTab("PRESETS")}
                        className={cn(
                          "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                          activeSuggestionTab === "PRESETS"
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Presets
                      </button>
                    </div>
                  </div>

                  {/* Suggestions Pills List (Fixed Height) */}
                  <div className="flex flex-wrap gap-1.5 h-28 overflow-y-auto pr-1 scrollbar-thin content-start">
                    {(activeSuggestionTab === "ALL" || activeSuggestionTab === "PROJECTS") &&
                      projectSuggestions.map((proj) => (
                        <button
                          key={`m-proj-${proj.id}`}
                          type="button"
                          onClick={() => {
                            setEditingMasterSlot((prev) => ({
                              ...(prev || ({} as any)),
                              title: `Project: ${proj.name}`,
                              category: "BUSINESS",
                            }));
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-mono bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{proj.name}</span>
                        </button>
                      ))}

                    {(activeSuggestionTab === "ALL" || activeSuggestionTab === "SKILLS") &&
                      skillSuggestions.map((sk) => (
                        <button
                          key={`m-sk-${sk.id}`}
                          type="button"
                          onClick={() => {
                            setEditingMasterSlot((prev) => ({
                              ...(prev || ({} as any)),
                              title: `Skill: ${sk.title}`,
                              category: "DEEP_WORK",
                            }));
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-mono bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{sk.title}</span>
                        </button>
                      ))}

                    {(activeSuggestionTab === "ALL" || activeSuggestionTab === "PRESETS") &&
                      QUICK_PRESETS.map((preset, idx) => {
                        const IconComp = preset.icon;
                        return (
                          <button
                            key={`m-preset-${idx}`}
                            type="button"
                            onClick={() => {
                              setEditingMasterSlot((prev) => ({
                                ...(prev || ({} as any)),
                                title: preset.title,
                                category: preset.category,
                              }));
                            }}
                            className="px-2 py-1 rounded-xl text-[10px] font-mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <IconComp className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                            <span>{preset.title}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Start & End Time (Custom GlassTimePicker) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Start Time *</span>
                  </label>
                  <GlassTimePicker
                    value={editingMasterSlot?.startTime || "09:00"}
                    onChange={(val) =>
                      setEditingMasterSlot((prev) =>
                        prev ? { ...prev, startTime: val } : ({ startTime: val } as any)
                      )
                    }
                    placeholder="Start Time..."
                    accentColor="purple"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>End Time *</span>
                  </label>
                  <GlassTimePicker
                    value={editingMasterSlot?.endTime || "10:00"}
                    onChange={(val) =>
                      setEditingMasterSlot((prev) =>
                        prev ? { ...prev, endTime: val } : ({ endTime: val } as any)
                      )
                    }
                    placeholder="End Time..."
                    accentColor="purple"
                  />
                </div>
              </div>

              {/* Real-time Time Collision Warning Banner */}
              {masterSlotConflict.hasConflict && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-300">Schedule Collision Detected</p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed font-sans">
                      {masterSlotConflict.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Real-time Next-Day Schedule Collision Warning Banner for Master Template */}
              {masterNextDayConflict.hasConflict && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-300">Next-Day Protocol Collision Detected</p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed font-sans">
                      {masterNextDayConflict.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Category *</label>
                <Select
                  value={editingMasterSlot?.category || "ROUTINE"}
                  onValueChange={(val) =>
                    setEditingMasterSlot((prev) =>
                      prev
                        ? { ...prev, category: val || "ROUTINE" }
                        : ({ category: val || "ROUTINE" } as any)
                    )
                  }
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-purple-500/50">
                    <div className="flex items-center gap-2 flex-1 text-left">
                      {editingMasterSlot?.category && CATEGORY_CONFIG[editingMasterSlot.category] ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_CONFIG[editingMasterSlot.category].color }}
                          />
                          <span className="text-white font-medium">
                            {CATEGORY_CONFIG[editingMasterSlot.category].label}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Select Category</span>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-white font-mono text-xs rounded-2xl p-1 shadow-2xl">
                    <SelectItem value="DEEP_WORK">🟣 Deep Work</SelectItem>
                    <SelectItem value="BUSINESS">🟠 Business</SelectItem>
                    <SelectItem value="HEALTH">🟢 Health / Meals</SelectItem>
                    <SelectItem value="PRAYER">🟡 Prayer</SelectItem>
                    <SelectItem value="MEETING">🔵 Meeting</SelectItem>
                    <SelectItem value="ROUTINE">⚪ Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-4 border-t border-white/10 flex items-center justify-between gap-3 mt-3">
              {editingMasterSlot?.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setMasterSlotToDelete({
                      id: editingMasterSlot.id!,
                      title: editingMasterSlot.title,
                    });
                    setIsMasterSlotDialogOpen(false);
                  }}
                  className="h-11 px-4 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-mono cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMasterSlotDialogOpen(false)}
                  className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 px-5 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    masterSlotConflict.hasConflict ||
                    masterNextDayConflict.hasConflict ||
                    isSavingMasterSlot
                  }
                  className={cn(
                    "font-mono text-xs font-bold rounded-2xl h-11 px-6 shadow-lg transition-all flex items-center gap-2",
                    masterSlotConflict.hasConflict ||
                      masterNextDayConflict.hasConflict ||
                      isSavingMasterSlot
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-50 shadow-none"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 cursor-pointer"
                  )}
                >
                  {isSavingMasterSlot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Template</span>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal: Delete Master Routine Template Slot */}
      <Dialog
        open={!!masterSlotToDelete}
        onOpenChange={(open) => !open && setMasterSlotToDelete(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-7 h-7 animate-pulse" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">
              DELETE MASTER TEMPLATE SLOT
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
              Are you sure you want to delete master routine template{" "}
              <span className="text-rose-300 font-bold">
                &quot;{masterSlotToDelete?.title}&quot;
              </span>
              ? Future dates generated from this profile will not include this slot.
            </p>
            <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMasterSlotToDelete(null)}
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeletingMasterSlot}
              onClick={handleConfirmDeleteMasterSlot}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer flex items-center justify-center gap-2"
            >
              {isDeletingMasterSlot ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-rose-200" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Template</span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
