"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
  Tag,
  ExternalLink,
  Database,
  CheckSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GoogleIcon } from "@/components/ui/google-icon";
import {
  UnifiedCalendarEvent,
  isSameDay,
  isMultiDayEvent,
  isRedDate,
  formatTime,
  formatDateRange,
} from "@/lib/calendar-utils";

export interface CalendarEventItem {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  eventType: string;
  description?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function MiniCalendarWidget({ events: initialLocalEvents }: { events: CalendarEventItem[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Date range for SWR
  const monthRange = useMemo(() => {
    const start = new Date(year, month - 1, 20).toISOString();
    const end = new Date(year, month + 2, 10).toISOString();
    return { start, end };
  }, [year, month]);

  // Fetch Unified Events (Local + Google Calendar) via SWR
  const { data: apiData } = useSWR(
    `/api/calendar/events?start=${encodeURIComponent(monthRange.start)}&end=${encodeURIComponent(
      monthRange.end
    )}`,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  // Normalize events
  const unifiedEvents: UnifiedCalendarEvent[] = useMemo(() => {
    if (apiData?.success && Array.isArray(apiData.events)) {
      return apiData.events;
    }
    if (initialLocalEvents && Array.isArray(initialLocalEvents)) {
      return initialLocalEvents.map((e) => ({
        id: `local-${e.id}`,
        localId: e.id,
        title: e.title,
        start: new Date(e.startTime).toISOString(),
        end: new Date(e.endTime).toISOString(),
        source: "LOCAL" as const,
        eventType: (e.eventType as "task" | "learning" | "general") || "general",
        isAllDay: false,
        description: e.description,
      }));
    }
    return [];
  }, [apiData, initialLocalEvents]);

  // Get events overlapping a specific date
  const getEventsForDate = (date: Date) => {
    const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const dEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    return unifiedEvents.filter((ev) => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return evEnd.getTime() >= dStart.getTime() && evStart.getTime() <= dEnd.getTime();
    });
  };

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const selectedDayHoliday = selectedDate ? isRedDate(selectedDate) : null;
  const gcalConnected = apiData?.gcalConnected;

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col justify-between h-full border border-white/10 relative overflow-hidden font-mono">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-white tracking-wider uppercase">
                  MASTER CALENDAR
                </h3>
                {gcalConnected && (
                  <span title="Google Calendar Synced" className="flex items-center">
                    <GoogleIcon className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {monthNames[month]} {year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 mb-1.5 font-bold uppercase">
          <span className="text-rose-400">Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Month Grid (Fixed 42 slots / 6 rows so height never shifts) */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-prev-${i}`} className="h-8" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const thisDate = new Date(year, month, dayNum);
            const isToday = isSameDay(thisDate, new Date());
            const isSelected = selectedDate && isSameDay(thisDate, selectedDate);
            const dayEvents = getEventsForDate(thisDate);
            const hasEvents = dayEvents.length > 0;
            const redInfo = isRedDate(thisDate);
            const hasKanbanTask = dayEvents.some((e) => e.source === "KANBAN");
            const hasGcalEvent = dayEvents.some((e) => e.source === "GCAL");

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDate(thisDate)}
                title={redInfo.isHoliday ? redInfo.name : undefined}
                className={`h-8 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                  isSelected
                    ? "bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30"
                    : isToday
                    ? "bg-white/10 text-purple-300 font-bold border border-purple-500/40"
                    : redInfo.isRed
                    ? "text-rose-400 font-bold hover:bg-rose-500/10"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span>{dayNum}</span>
                {hasEvents && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                      isSelected
                        ? "bg-white"
                        : hasKanbanTask
                        ? "bg-amber-400"
                        : hasGcalEvent
                        ? "bg-emerald-400"
                        : "bg-purple-400"
                    }`}
                  />
                )}
              </button>
            );
          })}

          {/* Trailing empty slots to guarantee 6 rows (42 total slots) */}
          {Array.from({ length: Math.max(0, 42 - (firstDay + daysInMonth)) }).map((_, i) => (
            <div key={`empty-next-${i}`} className="h-8" />
          ))}
        </div>
      </div>

      {/* Selected Date Layered Events View */}
      <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <span>
              {selectedDate
                ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Events"}
            </span>
            {selectedDayHoliday?.isHoliday && (
              <span className="text-[9px] text-rose-400 font-bold truncate max-w-[120px]">
                • {selectedDayHoliday.name}
              </span>
            )}
          </span>
          <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 text-[9px] px-2 py-0">
            {selectedDayEvents.length} Event{selectedDayEvents.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {selectedDayEvents.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic py-1">No scheduled events for this date.</p>
        ) : selectedDayEvents.length > 1 ? (
          /* Layered Stacked Deck Visual for >1 Events */
          <div
            onClick={() => setIsModalOpen(true)}
            className="group relative cursor-pointer pt-1 pb-2"
            title="Click to view all stacked events"
          >
            {/* Stack Layer 2 */}
            <div className="absolute inset-x-2 bottom-0 h-10 rounded-xl bg-purple-950/40 border border-purple-500/20 translate-y-2 scale-95 opacity-60 transition-transform group-hover:translate-y-2.5" />
            {/* Stack Layer 1 */}
            <div className="absolute inset-x-1 bottom-0 h-10 rounded-xl bg-purple-900/50 border border-purple-500/30 translate-y-1 scale-[0.97] opacity-85 transition-transform group-hover:translate-y-1.5" />

            {/* Top Main Card */}
            <div className="relative z-10 p-2.5 rounded-xl bg-[#0f0e17] border border-purple-500/50 group-hover:border-purple-400 transition-all flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedDayEvents[0].source === "GCAL" ? (
                  <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                ) : selectedDayEvents[0].source === "KANBAN" ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {selectedDayEvents[0].title}
                  </div>
                  <div className="text-[10px] text-purple-300 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-400" />
                    <span>+{selectedDayEvents.length - 1} more event{selectedDayEvents.length - 1 > 1 ? "s" : ""} stacked</span>
                  </div>
                </div>
              </div>

              <Badge className="bg-purple-600 hover:bg-purple-500 text-white text-[9px] px-2 py-0.5 shrink-0 ml-2 shadow-sm">
                View All ({selectedDayEvents.length})
              </Badge>
            </div>
          </div>
        ) : (
          /* Single Event View */
          <div
            onClick={() => setIsModalOpen(true)}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/40 transition-all cursor-pointer text-xs flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-2 truncate">
              {selectedDayEvents[0].source === "GCAL" ? (
                <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
              ) : selectedDayEvents[0].source === "KANBAN" ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              )}
              <span className="text-white truncate font-bold group-hover:text-purple-300">
                {selectedDayEvents[0].title}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" />
              {selectedDayEvents[0].isAllDay
                ? "All Day"
                : formatTime(selectedDayEvents[0].start)}
            </span>
          </div>
        )}
      </div>

      {/* Calendar Events Detail Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg w-[92vw] bg-[#0e0e12]/95 border-white/15 text-slate-100 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
          <DialogTitle className="sr-only">Schedule Details</DialogTitle>

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                    : "Events Overview"}
                </h3>
                <p className="text-[11px] text-purple-300">
                  {selectedDayEvents.length} Event{selectedDayEvents.length !== 1 ? "s" : ""} Scheduled
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Event Items List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {selectedDayEvents.map((ev) => {
              const isGcal = ev.source === "GCAL";
              const isKanban = ev.source === "KANBAN";

              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white leading-snug break-words">
                      {ev.title}
                    </h4>
                    {isGcal ? (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10 text-[9px] uppercase shrink-0 flex items-center gap-1">
                        <GoogleIcon className="w-2.5 h-2.5" /> Google
                      </Badge>
                    ) : isKanban ? (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-300 bg-amber-500/10 text-[9px] uppercase shrink-0 flex items-center gap-1">
                        <CheckSquare className="w-2.5 h-2.5" /> Kanban Task
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 text-[9px] uppercase shrink-0">
                        <Database className="w-2.5 h-2.5 mr-1" /> {ev.eventType || "local"}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{formatDateRange(ev.start, ev.end, ev.isAllDay)}</span>
                    </div>

                    {isGcal && ev.htmlLink && (
                      <a
                        href={ev.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {isKanban && (
                      <Link
                        href="/tasks"
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <span>Open Task</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  {ev.description && (
                    <p className="text-xs text-slate-300 font-sans leading-relaxed pt-1 border-t border-white/5 break-words">
                      {ev.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <Link
              href="/calendar"
              className="text-xs text-purple-400 hover:text-purple-300 underline flex items-center gap-1 font-bold"
            >
              Open Full Master Calendar →
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
