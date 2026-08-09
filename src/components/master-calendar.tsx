"use client";

import React, { useState, useTransition } from "react";
import { CalendarEvent } from "@/db/schema";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
} from "@/app/calendar/actions";
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
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MasterCalendarProps {
  initialEvents: CalendarEvent[];
}

import { useSearchParams } from "next/navigation";

export function MasterCalendar({ initialEvents }: MasterCalendarProps) {
  const [isPending, startTransition] = useTransition();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [calendarVisibleLimit, setCalendarVisibleLimit] = useState<number>(6);
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const dateParam = searchParams.get("date");
    const queryParam = searchParams.get("search") || searchParams.get("q");

    if (dateParam) {
      const targetDate = new Date(dateParam);
      if (!isNaN(targetDate.getTime())) {
        setCurrentDate(targetDate);
        setSelectedDate(targetDate);
      }
    } else if (queryParam) {
      const foundEvent = initialEvents.find((e) => e.title.toLowerCase().includes(queryParam.toLowerCase()));
      if (foundEvent && foundEvent.startTime) {
        const targetDate = new Date(foundEvent.startTime);
        if (!isNaN(targetDate.getTime())) {
          setCurrentDate(targetDate);
          setSelectedDate(targetDate);
        }
      }
    }
  }, [searchParams, initialEvents]);

  // Create Event Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newEventType, setNewEventType] = useState<"task" | "learning" | "general">("task");

  // Edit Event Modal State
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("10:00");
  const [editEventType, setEditEventType] = useState<"task" | "learning" | "general">("task");

  // Custom Glassmorphic Delete Confirmation Modal State (Popup Verif)
  const [deletingEventConfirm, setDeletingEventConfirm] = useState<CalendarEvent | null>(null);

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Helper to match dates
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getEventsForDay = (day: number) => {
    const targetDate = new Date(year, month, day);
    return initialEvents.filter((ev) => isSameDay(new Date(ev.startTime), targetDate));
  };

  // Filter events for selected day or all upcoming
  const filteredEvents = selectedDate
    ? initialEvents.filter((ev) => isSameDay(new Date(ev.startTime), selectedDate))
    : initialEvents;

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const start = new Date(`${newDate}T${newStartTime}:00`);
    const end = new Date(`${newDate}T${newEndTime}:00`);

    startTransition(async () => {
      await createEventAction({
        title: newTitle,
        startTime: start,
        endTime: end,
        eventType: newEventType,
      });
      setNewTitle("");
      setIsCreateOpen(false);
    });
  };

  const openEditModal = (ev: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(ev);
    setEditTitle(ev.title);
    const start = new Date(ev.startTime);
    const end = new Date(ev.endTime);
    setEditDate(start.toISOString().split("T")[0]);
    setEditStartTime(start.toTimeString().slice(0, 5));
    setEditEndTime(end.toTimeString().slice(0, 5));
    setEditEventType(ev.eventType as any);
  };

  const handleUpdateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editTitle.trim()) return;

    const start = new Date(`${editDate}T${editStartTime}:00`);
    const end = new Date(`${editDate}T${editEndTime}:00`);

    startTransition(async () => {
      await updateEventAction(editingEvent.id, {
        title: editTitle,
        startTime: start,
        endTime: end,
        eventType: editEventType,
      });
      setEditingEvent(null);
    });
  };

  const formatTimeRange = (startStr: Date, endStr: Date) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "task":
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-300 bg-rose-500/10 text-[10px] font-mono">
            TASK ITEM
          </Badge>
        );
      case "learning":
        return (
          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px] font-mono">
            SKILL LEARNING
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] font-mono">
            GENERAL EVENT
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Header & Schedule Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-md">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <span>{monthNames[month]} {year}</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {initialEvents.length} Total Scheduled Events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setCurrentDate(new Date());
                setSelectedDate(new Date());
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-semibold cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Schedule Event Dialog Modal */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "sm" }), "bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-4 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer shrink-0")}>
              <Plus className="w-4 h-4" /> Schedule Event
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
              <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
                <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-400" /> SCHEDULE NEW EVENT
                </DialogTitle>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </DialogHeader>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Event Title *</label>
                  <Input
                    autoFocus
                    required
                    placeholder="e.g. Next.js Architecture Deep Dive"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Event Type *</label>
                  <Select value={newEventType} onValueChange={(val: any) => setNewEventType(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[180px]">
                      <SelectItem value="task" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Task Item (Rose)</SelectItem>
                      <SelectItem value="learning" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Skill Learning (Purple)</SelectItem>
                      <SelectItem value="general" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">General Event (Emerald)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Date</label>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Start Time</label>
                    <Input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">End Time</label>
                    <Input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3 font-mono"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                    {isPending ? "Scheduling..." : "Save Event to Calendar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid & Timeline Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Calendar Grid (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-3xl border border-white/10 shadow-lg space-y-4">
          {/* Day of Week Labels */}
          <div className="grid grid-cols-7 text-center font-mono text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-white/10">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank leading slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-20 rounded-2xl bg-white/[0.01] border border-transparent" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateObj = new Date(year, month, dayNum);
              const dayEvents = getEventsForDay(dayNum);
              const isToday = isSameDay(dateObj, new Date());
              const isSelected = selectedDate && isSameDay(dateObj, selectedDate);

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDate(dateObj)}
                  className={cn(
                    "h-20 p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden",
                    isSelected
                      ? "bg-indigo-600/25 border-indigo-500/60 shadow-[0_0_14px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/50"
                      : isToday
                      ? "bg-white/[0.04] border-indigo-500/40"
                      : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                  )}
                >
                  {/* Date Number */}
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-mono font-bold w-5 h-5 flex items-center justify-center rounded-lg",
                        isToday
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40"
                          : isSelected
                          ? "text-indigo-300 font-extrabold"
                          : "text-slate-300"
                      )}
                    >
                      {dayNum}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-1.5 py-0.5 rounded-md font-bold">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Indicator Dots */}
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={cn(
                          "w-2 h-2 rounded-full",
                          ev.eventType === "task"
                            ? "bg-rose-400 shadow-[0_0_4px_#fb7185]"
                            : ev.eventType === "learning"
                            ? "bg-purple-400 shadow-[0_0_4px_#c084fc]"
                            : "bg-emerald-400 shadow-[0_0_4px_#34d399]"
                        )}
                        title={ev.title}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[8px] font-mono text-slate-400 font-bold">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline & Day Details Side Panel (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-3xl border border-white/10 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Selected Date Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "Upcoming Timeline"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {filteredEvents.length} Scheduled Events
                </p>
              </div>

              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10 cursor-pointer transition-colors"
                >
                  View All Events
                </button>
              )}
            </div>

            {/* Event Timeline List */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredEvents.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-white/10 rounded-2xl">
                  No events scheduled for this selection
                </div>
              ) : (
                filteredEvents.slice(0, calendarVisibleLimit).map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 transition-all space-y-2 group relative shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      {getTypeBadge(ev.eventType)}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => openEditModal(ev, e)}
                          className="w-7 h-7 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer"
                          title="Edit Event"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingEventConfirm(ev);
                          }}
                          className="w-7 h-7 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white font-sans group-hover:text-indigo-300 transition-colors">
                      {ev.title}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{formatTimeRange(ev.startTime, ev.endTime)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Show More / Show Less Expander Button */}
            {filteredEvents.length > 6 && (
              <div className="flex justify-center pt-2">
                {calendarVisibleLimit < filteredEvents.length ? (
                  <Button
                    size="xs"
                    onClick={() => setCalendarVisibleLimit(filteredEvents.length)}
                    className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-mono text-[10px] rounded-xl h-8 px-3 gap-1 cursor-pointer w-full"
                  >
                    Show More (+{filteredEvents.length - calendarVisibleLimit} events)
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setCalendarVisibleLimit(6)}
                    className="border-white/15 text-slate-400 hover:text-white font-mono text-[10px] rounded-xl h-8 px-3 cursor-pointer w-full"
                  >
                    Show Less
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Event Modal Dialog */}
      {editingEvent && (
        <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" /> EDIT EVENT DETAILS
              </DialogTitle>
              <button
                onClick={() => setEditingEvent(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Event Title</label>
                <Input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Event Type</label>
                <Select value={editEventType} onValueChange={(val: any) => setEditEventType(val)}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                    <SelectValue placeholder="Select event type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[180px]">
                    <SelectItem value="task" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Task Item (Rose)</SelectItem>
                    <SelectItem value="learning" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Skill Learning (Purple)</SelectItem>
                    <SelectItem value="general" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">General Event (Emerald)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Date</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Start Time</label>
                  <Input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">End Time</label>
                  <Input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3 font-mono"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                  {isPending ? "Saving..." : "Update Event"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC DELETE EVENT CONFIRMATION DIALOG (Popup Verif) */}
      {deletingEventConfirm && (
        <Dialog open={!!deletingEventConfirm} onOpenChange={() => setDeletingEventConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE CALENDAR EVENT</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete event <span className="text-rose-300 font-bold">&quot;{deletingEventConfirm.title}&quot;</span> from your Master Calendar schedule?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingEventConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingEventConfirm.id;
                  startTransition(async () => {
                    await deleteEventAction(id);
                    setDeletingEventConfirm(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
