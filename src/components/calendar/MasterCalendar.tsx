"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Pencil,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Sparkles,
  ExternalLink,
  Database,
  Check,
  Filter,
  Tag,
  RefreshCw,
  Layers,
  CalendarDays,
  MapPin,
  PartyPopper,
  Info,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GlassDatePicker } from "@/components/ui/glass-date-picker";
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
import { GoogleIcon } from "@/components/ui/google-icon";
import { cn } from "@/lib/utils";
import {
  UnifiedCalendarEvent,
  WeekEventSpan,
  getCalendarMonthGrid,
  calculateEventSpans,
  isSameDay,
  isMultiDayEvent,
  isRedDate,
  formatTime,
  formatDateRange,
} from "@/lib/calendar-utils";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
} from "@/app/calendar/actions";

interface MasterCalendarProps {
  initialEvents?: any[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function MasterCalendar({ initialEvents }: MasterCalendarProps) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Current viewed Month & Selected Day
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Source Filter: 'ALL' | 'LOCAL' | 'GCAL' | 'KANBAN'
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "LOCAL" | "GCAL" | "KANBAN">("ALL");

  // Create Event Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newEndDate, setNewEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newIsAllDay, setNewIsAllDay] = useState(false);
  const [newEventType, setNewEventType] = useState<"task" | "learning" | "general">("task");

  // Edit Event Modal State
  const [editingEvent, setEditingEvent] = useState<UnifiedCalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("10:00");
  const [editIsAllDay, setEditIsAllDay] = useState(false);
  const [editEventType, setEditEventType] = useState<"task" | "learning" | "general">("task");

  // Delete Confirmation Modal State
  const [deletingEvent, setDeletingEvent] = useState<UnifiedCalendarEvent | null>(null);

  // Calculate Month Boundaries for API Range
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthRange = useMemo(() => {
    const start = new Date(year, month - 1, 20).toISOString();
    const end = new Date(year, month + 2, 10).toISOString();
    return { start, end };
  }, [year, month]);

  // SWR for Unified Calendar Events API
  const { data: apiData, mutate, isValidating: isFetchingEvents } = useSWR(
    `/api/calendar/events?start=${encodeURIComponent(monthRange.start)}&end=${encodeURIComponent(
      monthRange.end
    )}`,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  // Normalize all events from API (fallback to initialEvents if loading)
  const allEvents: UnifiedCalendarEvent[] = useMemo(() => {
    if (apiData?.success && Array.isArray(apiData.events)) {
      return apiData.events;
    }
    if (initialEvents && Array.isArray(initialEvents)) {
      return initialEvents.map((e: any) => ({
        id: `local-${e.id}`,
        localId: e.id,
        title: e.title,
        start: new Date(e.startTime).toISOString(),
        end: new Date(e.endTime).toISOString(),
        source: "LOCAL" as const,
        eventType: e.eventType || "general",
        isAllDay: false,
      }));
    }
    return [];
  }, [apiData, initialEvents]);

  // Filter events by source
  const filteredEvents = useMemo(() => {
    if (sourceFilter === "LOCAL") {
      return allEvents.filter((e) => e.source === "LOCAL");
    }
    if (sourceFilter === "GCAL") {
      return allEvents.filter((e) => e.source === "GCAL");
    }
    if (sourceFilter === "KANBAN") {
      return allEvents.filter((e) => e.source === "KANBAN");
    }
    return allEvents;
  }, [allEvents, sourceFilter]);

  // Handle URL Search Params Navigation
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const queryParam = searchParams.get("search") || searchParams.get("q");

    if (dateParam) {
      const targetDate = new Date(dateParam);
      if (!isNaN(targetDate.getTime())) {
        setCurrentDate(targetDate);
        setSelectedDate(targetDate);
      }
    } else if (queryParam) {
      const found = allEvents.find((e) =>
        e.title.toLowerCase().includes(queryParam.toLowerCase())
      );
      if (found) {
        const targetDate = new Date(found.start);
        if (!isNaN(targetDate.getTime())) {
          setCurrentDate(targetDate);
          setSelectedDate(targetDate);
          setSelectedEventId(found.id);
        }
      }
    }
  }, [searchParams, allEvents]);

  // Navigation handlers
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Generate 7-column grid rows
  const monthWeeks = useMemo(() => {
    return getCalendarMonthGrid(year, month);
  }, [year, month]);

  // Get all events overlapping the selected day
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const selStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0,
      0,
      0,
      0
    );
    const selEnd = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      23,
      59,
      59,
      999
    );

    return filteredEvents.filter((ev) => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return evEnd.getTime() >= selStart.getTime() && evStart.getTime() <= selEnd.getTime();
    });
  }, [selectedDate, filteredEvents]);

  // Selected Day Tanggal Merah / Holiday Info
  const selectedDayHoliday = useMemo(() => {
    if (!selectedDate) return null;
    return isRedDate(selectedDate);
  }, [selectedDate]);

  // Handle Create Event Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let start: Date;
    let end: Date;

    if (newIsAllDay) {
      const [sYear, sMonth, sDay] = newStartDate.split("-").map(Number);
      const [eYear, eMonth, eDay] = (newEndDate || newStartDate).split("-").map(Number);
      start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
      end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    } else {
      start = new Date(`${newStartDate}T${newStartTime}:00`);
      end = new Date(`${newEndDate || newStartDate}T${newEndTime}:00`);
    }

    if (end.getTime() < start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    startTransition(async () => {
      await createEventAction({
        title: newTitle.trim(),
        startTime: start,
        endTime: end,
        eventType: newEventType,
      });
      setNewTitle("");
      setIsCreateOpen(false);
      mutate();
    });
  };

  // Open Edit Modal
  const openEditModal = (event: UnifiedCalendarEvent) => {
    if (event.source !== "LOCAL" || !event.localId) return;
    setEditingEvent(event);
    setEditTitle(event.title);

    const s = new Date(event.start);
    const e = new Date(event.end);

    setEditStartDate(s.toISOString().split("T")[0]);
    setEditEndDate(e.toISOString().split("T")[0]);

    const sHours = String(s.getHours()).padStart(2, "0");
    const sMins = String(s.getMinutes()).padStart(2, "0");
    const eHours = String(e.getHours()).padStart(2, "0");
    const eMins = String(e.getMinutes()).padStart(2, "0");

    setEditStartTime(`${sHours}:${sMins}`);
    setEditEndTime(`${eHours}:${eMins}`);
    setEditIsAllDay(event.isAllDay);
    setEditEventType(event.eventType || "task");
  };

  // Handle Edit Event Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editingEvent.localId || !editTitle.trim()) return;

    let start: Date;
    let end: Date;

    if (editIsAllDay) {
      const [sYear, sMonth, sDay] = editStartDate.split("-").map(Number);
      const [eYear, eMonth, eDay] = (editEndDate || editStartDate).split("-").map(Number);
      start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
      end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    } else {
      start = new Date(`${editStartDate}T${editStartTime}:00`);
      end = new Date(`${editEndDate || editStartDate}T${editEndTime}:00`);
    }

    if (end.getTime() < start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    startTransition(async () => {
      await updateEventAction(editingEvent.localId!, {
        title: editTitle.trim(),
        startTime: start,
        endTime: end,
        eventType: editEventType,
      });
      setEditingEvent(null);
      mutate();
    });
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = () => {
    if (!deletingEvent || !deletingEvent.localId) return;

    startTransition(async () => {
      await deleteEventAction(deletingEvent.localId!);
      setDeletingEvent(null);
      mutate();
    });
  };

  const gcalConnected = apiData?.gcalConnected;
  const localCount = allEvents.filter((e) => e.source === "LOCAL").length;
  const gcalCount = allEvents.filter((e) => e.source === "GCAL").length;
  const kanbanCount = allEvents.filter((e) => e.source === "KANBAN").length;

  return (
    <div className="space-y-4 font-mono">
      {/* MAIN GRID & DETAIL PANEL SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: MASTER 7-COLUMN MONTH GRID (lg:col-span-8) */}
        <div className="lg:col-span-8 2xl:col-span-8 rounded-3xl bg-[#0e0e1a]/90 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Weekday Header Row */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
            {WEEKDAY_NAMES.map((dayName, idx) => (
              <div
                key={dayName}
                className={cn(
                  "py-2.5 text-center text-[10px] sm:text-xs font-bold tracking-wider",
                  idx === 6 ? "text-rose-400" : idx === 5 ? "text-slate-400" : "text-slate-300"
                )}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Month Week Rows Container */}
          <div className="divide-y divide-white/5">
            {monthWeeks.map((weekDates, weekIdx) => {
              // Calculate Multi-Day Horizontal Spanning Blocks for this week
              const weekSpans = calculateEventSpans(filteredEvents, weekDates);
              const maxTrack = weekSpans.reduce((max, s) => Math.max(max, s.trackIndex), -1);

              return (
                <div key={`week-${weekIdx}`} className="relative min-h-[82px] sm:min-h-[92px] lg:min-h-[96px] flex flex-col">
                  {/* Background Day Cells Layer (7 cols) */}
                  <div className="grid grid-cols-7 divide-x divide-white/5 flex-1 min-h-[82px] sm:min-h-[92px] lg:min-h-[96px]">
                    {weekDates.map((dayDate, dayColIdx) => {
                      const isCurrentMonth = dayDate.getMonth() === month;
                      const isToday = isSameDay(dayDate, new Date());
                      const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
                      const redInfo = isRedDate(dayDate);

                      // Single-day timed events for this cell
                      const singleDayEvents = filteredEvents.filter(
                        (e) => !isMultiDayEvent(e) && isSameDay(new Date(e.start), dayDate)
                      );

                      // Total events overlapping this day
                      const multiDayCountOnThisDay = weekSpans.filter(
                        (s) =>
                          dayColIdx + 1 >= s.startColumn &&
                          dayColIdx + 1 <= s.startColumn + s.colSpan - 1
                      ).length;
                      const totalEventsOnDay = singleDayEvents.length + multiDayCountOnThisDay;

                      return (
                        <div
                          key={dayDate.toISOString()}
                          onClick={() => setSelectedDate(dayDate)}
                          className={cn(
                            "p-1 sm:p-1.5 flex flex-col transition-colors cursor-pointer relative group",
                            !isCurrentMonth && "bg-white/[0.01] opacity-35 hover:opacity-70",
                            isCurrentMonth && "hover:bg-white/[0.03]",
                            isSelected && "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/40",
                            redInfo.isHoliday && isCurrentMonth && "bg-rose-500/[0.03]"
                          )}
                        >
                          {/* Day Number & Holiday Tag Header */}
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span
                              className={cn(
                                "text-[11px] sm:text-xs font-mono font-bold w-5 h-5 sm:w-5.5 sm:h-5.5 flex items-center justify-center rounded-md transition-all shrink-0",
                                isToday
                                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40 font-extrabold"
                                  : isSelected
                                  ? "bg-white/20 text-white font-bold"
                                  : redInfo.isRed
                                  ? isCurrentMonth
                                    ? "text-rose-400 font-bold"
                                    : "text-rose-400/50"
                                  : isCurrentMonth
                                  ? "text-slate-300 group-hover:text-white"
                                  : "text-slate-600"
                              )}
                            >
                              {dayDate.getDate()}
                            </span>

                            {/* Holiday Chip if applicable */}
                            {redInfo.isHoliday && isCurrentMonth && (
                              <span
                                className="text-[8px] sm:text-[9px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-1 py-0.2 rounded truncate max-w-[55px] sm:max-w-[75px]"
                                title={redInfo.name}
                              >
                                {redInfo.name}
                              </span>
                            )}

                            {/* Event count chip if crowded */}
                            {totalEventsOnDay > 2 && !redInfo.isHoliday && (
                              <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono hidden sm:inline-block">
                                {totalEventsOnDay} ev
                              </span>
                            )}
                          </div>

                          {/* Spacer to push single-day events below multi-day horizontal tracks */}
                          {maxTrack >= 0 && (
                            <div
                              style={{ height: `${(Math.min(maxTrack, 2) + 1) * 19}px` }}
                              className="pointer-events-none"
                            />
                          )}

                          {/* Single-Day / Timed Events Stack */}
                          <div className="space-y-0.5 mt-auto pt-0.5 overflow-hidden">
                            {singleDayEvents.slice(0, Math.max(1, 2 - Math.min(maxTrack + 1, 2))).map((ev) => {
                              const isLocal = ev.source === "LOCAL";
                              const isGcal = ev.source === "GCAL";
                              const isKanban = ev.source === "KANBAN";

                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDate(dayDate);
                                    setSelectedEventId(ev.id);
                                  }}
                                  className={cn(
                                    "w-full text-left px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] truncate flex items-center gap-1 transition-all cursor-pointer",
                                    isLocal && "bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/25",
                                    isGcal && "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25",
                                    isKanban && "bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30",
                                    selectedEventId === ev.id && (
                                      isLocal ? "ring-1.5 ring-indigo-400 bg-indigo-500/30 shadow-xs" :
                                      isGcal ? "ring-1.5 ring-emerald-400 bg-emerald-500/30 shadow-xs" :
                                      "ring-1.5 ring-amber-400 bg-amber-500/35 shadow-xs"
                                    )
                                  )}
                                  title={`${ev.title} (${formatTime(ev.start)})`}
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      isLocal ? "bg-indigo-400" : isGcal ? "bg-emerald-400" : "bg-amber-400"
                                    )}
                                  />
                                  <span className="font-bold text-[8px] sm:text-[9px] opacity-80 shrink-0">
                                    {formatTime(ev.start)}
                                  </span>
                                  <span className="truncate font-medium">{ev.title}</span>
                                </button>
                              );
                            })}

                            {/* +X More Indicator */}
                            {singleDayEvents.length > Math.max(1, 2 - Math.min(maxTrack + 1, 2)) && (
                              <div className="text-[8px] sm:text-[9px] text-amber-400 font-bold px-1 hover:underline cursor-pointer">
                                +{singleDayEvents.length - Math.max(1, 2 - Math.min(maxTrack + 1, 2))} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Multi-Day Spanning Event Blocks Overlay Layer (Supports up to track index 2: 3 simultaneous tracks) */}
                  {weekSpans.length > 0 && (
                    <div className="absolute top-6 sm:top-6.5 left-0 right-0 px-1 pointer-events-none grid grid-cols-7 gap-x-1 gap-y-0.5 auto-rows-[18px]">
                      {weekSpans
                        .filter((s) => s.trackIndex <= 2) // Support up to 3 simultaneous multi-day bars (Tracks 0, 1, 2)
                        .map((span) => {
                          const isLocal = span.event.source === "LOCAL";
                          const isGcal = span.event.source === "GCAL";
                          const isKanban = span.event.source === "KANBAN";
                          const isSelected = selectedEventId === span.event.id;

                          return (
                            <div
                              key={`${span.event.id}-${weekIdx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const evStartDate = new Date(span.event.start);
                                setSelectedDate(evStartDate);
                                setSelectedEventId(span.event.id);
                              }}
                              style={{
                                gridColumnStart: span.startColumn,
                                gridColumnEnd: `span ${span.colSpan}`,
                                gridRowStart: span.trackIndex + 1,
                              }}
                              className={cn(
                                "pointer-events-auto h-[18px] px-1.5 flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-bold transition-all truncate cursor-pointer z-10",
                                isLocal && "bg-indigo-500/35 text-indigo-100 border border-indigo-500/60 hover:bg-indigo-500/45 shadow-xs shadow-indigo-500/20",
                                isGcal && "bg-emerald-500/35 text-emerald-100 border border-emerald-500/60 hover:bg-emerald-500/45 shadow-xs shadow-emerald-500/20",
                                isKanban && "bg-amber-500/35 text-amber-100 border border-amber-500/60 hover:bg-amber-500/45 shadow-xs shadow-amber-500/20",
                                span.isStartEdge ? "rounded-l-md" : "rounded-l-none border-l-0",
                                span.isEndEdge ? "rounded-r-md" : "rounded-r-none border-r-0",
                                isSelected && (
                                  isLocal ? "ring-2 ring-indigo-400 shadow-md shadow-indigo-500/30" :
                                  isGcal ? "ring-2 ring-emerald-400 shadow-md shadow-emerald-500/30" :
                                  "ring-2 ring-amber-400 shadow-md shadow-amber-500/30"
                                )
                              )}
                              title={`${span.event.title} (${formatDateRange(
                                span.event.start,
                                span.event.end,
                                span.event.isAllDay
                              )})`}
                            >
                              {span.isStartEdge && (
                                <span className="shrink-0 flex items-center">
                                  {isLocal ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                  ) : isGcal ? (
                                    <GoogleIcon className="w-2.5 h-2.5" />
                                  ) : (
                                    <CheckSquare className="w-2.5 h-2.5 text-amber-300" />
                                  )}
                                </span>
                              )}
                              <span className="truncate">{span.event.title}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: MONTH NAVIGATOR + ACTIONS + SELECTED DAY DETAIL (lg:col-span-4) */}
        <div className="lg:col-span-4 2xl:col-span-4 flex flex-col gap-3.5 max-h-[580px] lg:max-h-[610px]">
          {/* Card 1: Month Navigator & Quick Controls */}
          <div className="p-3.5 rounded-3xl bg-[#0e0e1a]/90 border border-white/10 shadow-2xl backdrop-blur-xl space-y-3">
            {/* Month Name & Stepper Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {MONTH_NAMES[month]} {year}
                </h2>
                {isFetchingEvents && (
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                )}
              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-2xl p-0.5 shadow-inner">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevMonth}
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={goToToday}
                  className="h-7 px-2 text-[11px] text-slate-200 hover:text-white hover:bg-white/10 font-bold rounded-xl cursor-pointer"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextMonth}
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Action Row: New Event + Google Sync */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  const selStr = selectedDate
                    ? selectedDate.toISOString().split("T")[0]
                    : new Date().toISOString().split("T")[0];
                  setNewStartDate(selStr);
                  setNewEndDate(selStr);
                  setIsCreateOpen(true);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8.5 rounded-2xl gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Event</span>
              </Button>

              {gcalConnected ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] h-8.5 px-2.5 gap-1.5 rounded-2xl flex font-mono"
                  title="Google Calendar Connected & Synced"
                >
                  <GoogleIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">Synced</span>
                </Badge>
              ) : (
                <a
                  href="/api/google/login"
                  className="border border-white/10 bg-white/[0.03] hover:bg-white/10 text-slate-300 text-[10px] h-8.5 px-2.5 gap-1.5 rounded-2xl flex items-center transition-colors font-mono"
                  title="Connect Google Account"
                >
                  <GoogleIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">Connect</span>
                </a>
              )}
            </div>

            {/* Source Filter Tabs */}
            <div className="grid grid-cols-4 bg-white/[0.04] border border-white/10 rounded-2xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSourceFilter("ALL")}
                className={cn(
                  "py-1 rounded-xl font-bold transition-all text-center cursor-pointer text-[10px]",
                  sourceFilter === "ALL"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                All ({allEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("LOCAL")}
                className={cn(
                  "py-1 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[10px]",
                  sourceFilter === "LOCAL"
                    ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Database className="w-2.5 h-2.5 text-indigo-400" />
                <span>Local ({localCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("GCAL")}
                className={cn(
                  "py-1 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[10px]",
                  sourceFilter === "GCAL"
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <GoogleIcon className="w-2.5 h-2.5" />
                <span>Google ({gcalCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("KANBAN")}
                className={cn(
                  "py-1 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[10px]",
                  sourceFilter === "KANBAN"
                    ? "bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <CheckSquare className="w-2.5 h-2.5 text-amber-400" />
                <span>Tasks ({kanbanCount})</span>
              </button>
            </div>
          </div>

          {/* Card 2: Selected Day Details Card (Bounded Height with internal scroll) */}
          <div className="p-4 rounded-3xl bg-[#0e0e1a]/90 border border-white/10 shadow-2xl backdrop-blur-xl flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Selected Day
                </span>
                <h3 className="text-sm font-bold text-white leading-snug">
                  {selectedDate.toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
              </div>
              <Badge
                variant="outline"
                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-mono px-2 py-0.5"
              >
                {selectedDayEvents.length} Events
              </Badge>
            </div>

            {/* National Holiday Banner if applicable */}
            {selectedDayHoliday?.isHoliday && (
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 shrink-0 animate-in fade-in duration-200">
                <PartyPopper className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block">
                    Hari Libur Nasional
                  </span>
                  <p className="text-[11px] font-bold text-rose-200 leading-tight truncate">
                    {selectedDayHoliday.name}
                  </p>
                </div>
              </div>
            )}

            {/* Event List with Scroll for Selected Day */}
            {selectedDayEvents.length === 0 ? (
              <div className="p-6 text-center space-y-2 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 my-auto">
                <CalendarDays className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-mono">No events scheduled for this day.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const selStr = selectedDate.toISOString().split("T")[0];
                    setNewStartDate(selStr);
                    setNewEndDate(selStr);
                    setIsCreateOpen(true);
                  }}
                  className="border-white/15 text-slate-300 hover:text-white hover:bg-white/10 text-xs rounded-xl h-8 px-3 gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Event</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {selectedDayEvents.map((ev) => {
                  const isLocal = ev.source === "LOCAL";
                  const isGcal = ev.source === "GCAL";
                  const isKanban = ev.source === "KANBAN";
                  const isSelected = selectedEventId === ev.id;
                  const isMulti = isMultiDayEvent(ev);

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5 cursor-pointer shadow-sm",
                        isLocal && (
                          isSelected
                            ? "bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/80 shadow-lg shadow-indigo-500/20"
                            : "bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-950/30"
                        ),
                        isGcal && (
                          isSelected
                            ? "bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-500/20"
                            : "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-950/30"
                        ),
                        isKanban && (
                          isSelected
                            ? "bg-amber-950/40 border-amber-400 ring-2 ring-amber-500/80 shadow-lg shadow-amber-500/20"
                            : "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-950/30"
                        )
                      )}
                    >
                      {/* Top Badges & Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isLocal && (
                            <Badge
                              variant="outline"
                              className="border-indigo-500/40 bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-lg font-bold font-mono flex items-center gap-1"
                            >
                              <Database className="w-2.5 h-2.5" />
                              LOCAL
                            </Badge>
                          )}

                          {isGcal && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-lg font-bold font-mono flex items-center gap-1.5"
                            >
                              <GoogleIcon className="w-3 h-3" />
                              Google
                            </Badge>
                          )}

                          {isKanban && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-lg font-bold font-mono flex items-center gap-1"
                            >
                              <CheckSquare className="w-2.5 h-2.5" />
                              KANBAN TASK
                            </Badge>
                          )}

                          {isKanban && ev.taskStatus && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-lg uppercase font-mono font-bold",
                                ev.taskStatus === "done"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : ev.taskStatus === "in_progress"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                              )}
                            >
                              {ev.taskStatus.replace("_", " ")}
                            </Badge>
                          )}

                          {isKanban && ev.taskPriority && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-lg uppercase font-mono",
                                ev.taskPriority === "high"
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300 font-bold"
                                  : ev.taskPriority === "low"
                                  ? "border-slate-500/30 bg-slate-500/10 text-slate-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              )}
                            >
                              {ev.taskPriority}
                            </Badge>
                          )}

                          {isLocal && ev.eventType && (
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-white/5 text-slate-300 text-[10px] px-2 py-0.5 rounded-lg capitalize font-medium"
                            >
                              {ev.eventType}
                            </Badge>
                          )}

                          {isMulti && !isKanban && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/15 text-amber-300 text-[10px] px-2 py-0.5 rounded-lg font-semibold"
                            >
                              Multi-Day
                            </Badge>
                          )}
                        </div>

                        {/* Actions for LOCAL vs GCAL vs KANBAN */}
                        {isLocal && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(ev);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              title="Edit Event"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingEvent(ev);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {isGcal && ev.htmlLink && (
                          <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-bold shrink-0"
                          >
                            <span>Google</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {isKanban && (
                          <a
                            href="/tasks"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-bold shrink-0"
                          >
                            <span>Open Task</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Event Title */}
                      <h4 className="text-sm font-bold text-white leading-snug break-words pt-0.5">
                        {ev.title}
                      </h4>

                      {/* Event Time / Range */}
                      <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                        <Clock className={cn("w-3.5 h-3.5 shrink-0", isLocal ? "text-indigo-400" : isGcal ? "text-emerald-400" : "text-amber-400")} />
                        <span>
                          {isKanban
                            ? `Deadline: ${new Date(ev.start).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
                            : formatDateRange(ev.start, ev.end, ev.isAllDay)}
                        </span>
                      </div>

                      {/* Location link to Google Maps */}
                      {ev.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-start gap-1.5 text-xs text-slate-300 hover:text-emerald-300 transition-colors group/loc py-0.5 cursor-pointer"
                          title="Open in Google Maps"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-400 group-hover/loc:scale-110 transition-transform shrink-0 mt-0.5" />
                          <span className="break-words group-hover/loc:underline leading-snug">{ev.location}</span>
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover/loc:opacity-100 shrink-0 text-slate-400 group-hover/loc:text-emerald-300 mt-0.5" />
                        </a>
                      )}

                      {/* Description */}
                      {ev.description && (
                        <div className="text-xs text-slate-300 bg-black/30 p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap break-words leading-relaxed font-sans max-h-28 overflow-y-auto">
                          {ev.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: CREATE LOCAL EVENT */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#0e0e1a]/95 border border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>CREATE CALENDAR EVENT</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase">Event Title *</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. System Architecture Review"
                  required
                  className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3.5"
                />
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="space-y-0.5">
                  <span className="font-bold text-white block text-xs">All-Day / Multi-Day Event</span>
                  <span className="text-[10px] text-slate-400 block">
                    Span full days without specific start/end clock times
                  </span>
                </div>
                <Switch
                  checked={newIsAllDay}
                  onCheckedChange={(checked) => setNewIsAllDay(Boolean(checked))}
                  className="data-checked:bg-indigo-600 cursor-pointer"
                />
              </div>

              {/* Date Range Inputs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
                  <GlassDatePicker
                    value={newStartDate}
                    onChange={(val) => {
                      setNewStartDate(val);
                      if (newEndDate && val > newEndDate) {
                        setNewEndDate(val);
                      }
                    }}
                    placeholder="Start Date"
                    accentColor="indigo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
                  <GlassDatePicker
                    value={newEndDate}
                    onChange={setNewEndDate}
                    minDate={newStartDate}
                    placeholder="End Date"
                    accentColor="indigo"
                  />
                </div>
              </div>

              {/* Time Inputs (if not all day) */}
              {!newIsAllDay && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Start Time</label>
                    <Input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3 text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">End Time</label>
                    <Input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3 text-xs [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}

              {/* Event Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase">Category</label>
                <Select
                  value={newEventType}
                  onValueChange={(val: any) => setNewEventType(val)}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121222] border-white/15 text-white rounded-2xl font-mono">
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-white/15 text-slate-300 rounded-2xl h-10 px-4 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl h-10 px-5 text-xs shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {isPending ? "Creating..." : "Save Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDIT LOCAL EVENT */}
      <Dialog open={Boolean(editingEvent)} onOpenChange={(o) => !o && setEditingEvent(null)}>
        <DialogContent className="bg-[#0e0e1a]/95 border border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-400" />
              <span>EDIT EVENT</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase">Event Title *</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3.5"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="space-y-0.5">
                  <span className="font-bold text-white block text-xs">All-Day / Multi-Day Event</span>
                  <span className="text-[10px] text-slate-400 block">
                    Span full days without specific clock times
                  </span>
                </div>
                <Switch
                  checked={editIsAllDay}
                  onCheckedChange={(checked) => setEditIsAllDay(Boolean(checked))}
                  className="data-checked:bg-indigo-600 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
                  <GlassDatePicker
                    value={editStartDate}
                    onChange={(val) => {
                      setEditStartDate(val);
                      if (editEndDate && val > editEndDate) {
                        setEditEndDate(val);
                      }
                    }}
                    placeholder="Start Date"
                    accentColor="indigo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
                  <GlassDatePicker
                    value={editEndDate}
                    onChange={setEditEndDate}
                    minDate={editStartDate}
                    placeholder="End Date"
                    accentColor="indigo"
                  />
                </div>
              </div>

              {!editIsAllDay && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Start Time</label>
                    <Input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3 text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">End Time</label>
                    <Input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3 text-xs [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase">Category</label>
                <Select
                  value={editEventType}
                  onValueChange={(val: any) => setEditEventType(val)}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/15 text-white rounded-2xl h-10 px-3 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121222] border-white/15 text-white rounded-2xl font-mono">
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeletingEvent(editingEvent);
                  setEditingEvent(null);
                }}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-2xl h-10 px-3 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingEvent(null)}
                  className="border-white/15 text-slate-300 rounded-2xl h-10 px-4 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl h-10 px-5 text-xs shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: DELETE CONFIRMATION */}
      <Dialog open={Boolean(deletingEvent)} onOpenChange={(o) => !o && setDeletingEvent(null)}>
        <DialogContent className="bg-[#0e0e1a]/95 border border-rose-500/30 text-slate-100 rounded-3xl max-w-sm p-6 shadow-2xl backdrop-blur-2xl font-mono space-y-4">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">Delete Event?</h4>
              <p className="text-[11px] text-rose-300/80">This action cannot be undone.</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Event:</span>
            <p className="text-xs font-bold text-white">{deletingEvent?.title}</p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingEvent(null)}
              className="border-white/15 text-slate-300 rounded-2xl h-10 px-4 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleDeleteConfirm}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl h-10 px-5 text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
