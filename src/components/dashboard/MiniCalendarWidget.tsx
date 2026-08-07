"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface CalendarEventItem {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  eventType: string;
  description?: string;
}

export function MiniCalendarWidget({ events }: { events: CalendarEventItem[] }) {
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

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getEventsForDate = (date: Date) => {
    return events.filter((ev) => {
      const evDate = new Date(ev.startTime);
      return isSameDay(evDate, date);
    });
  };

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col justify-between h-full border border-white/10 relative overflow-hidden">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white font-mono tracking-wider uppercase">
                MASTER CALENDAR
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {monthNames[month]} {year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[10px] font-mono text-slate-400 mb-2 font-bold uppercase">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Month Grid (Fixed 42 slots / 6 rows so height never shifts) */}
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
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

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDate(thisDate)}
                className={`h-8 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                  isSelected
                    ? "bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30"
                    : isToday
                    ? "bg-white/10 text-purple-300 font-bold border border-purple-500/40"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span>{dayNum}</span>
                {hasEvents && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                      isSelected ? "bg-white" : "bg-emerald-400 glow-emerald"
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
      <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300">
          <span>
            {selectedDate
              ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Events"}
          </span>
          <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 text-[9px] px-2 py-0">
            {selectedDayEvents.length} Event{selectedDayEvents.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {selectedDayEvents.length === 0 ? (
          <p className="text-[11px] font-mono text-slate-500 italic py-1">No scheduled events for this date.</p>
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
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-white truncate">
                    {selectedDayEvents[0].title}
                  </div>
                  <div className="text-[10px] font-mono text-purple-300 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-400" />
                    <span>+{selectedDayEvents.length - 1} more event{selectedDayEvents.length - 1 > 1 ? "s" : ""} stacked</span>
                  </div>
                </div>
              </div>

              <Badge className="bg-purple-600 hover:bg-purple-500 text-white font-mono text-[9px] px-2 py-0.5 shrink-0 ml-2 shadow-sm">
                View All ({selectedDayEvents.length})
              </Badge>
            </div>
          </div>
        ) : (
          /* Single Event View */
          <div
            onClick={() => setIsModalOpen(true)}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/40 transition-all cursor-pointer text-xs font-mono flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              <span className="text-white truncate font-bold group-hover:text-purple-300">{selectedDayEvents[0].title}</span>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1 font-sans">
              <Clock className="w-3 h-3 text-purple-400" />
              {new Date(selectedDayEvents[0].startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      {/* Calendar Events Detail Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg w-[92vw] bg-[#0e0e12]/95 border-white/15 text-slate-100 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-4">
          <DialogTitle className="sr-only">Schedule Details</DialogTitle>

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono text-white tracking-wide">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                    : "Events Overview"}
                </h3>
                <p className="text-[11px] text-purple-300 font-mono">
                  {selectedDayEvents.length} Event{selectedDayEvents.length !== 1 ? "s" : ""} Scheduled
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Event Items List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {selectedDayEvents.map((ev) => {
              const startStr = new Date(ev.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const endStr = new Date(ev.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold font-mono text-white leading-snug">
                      {ev.title}
                    </h4>
                    <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 font-mono text-[9px] uppercase shrink-0">
                      <Tag className="w-2.5 h-2.5 mr-1" /> {ev.eventType}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>{startStr} – {endStr}</span>
                  </div>

                  {ev.description && (
                    <p className="text-xs text-slate-300 font-sans leading-relaxed pt-1 border-t border-white/5">
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
              className="text-xs font-mono text-purple-400 hover:text-purple-300 underline flex items-center gap-1"
            >
              Open Full Master Calendar →
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
