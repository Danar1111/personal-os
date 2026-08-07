import React from "react";
import { getCalendarEvents } from "./actions";
import { MasterCalendar } from "@/components/master-calendar";
import { Calendar as CalendarIcon, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;

export default async function CalendarPage() {
  const initialEvents = await getCalendarEvents();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <CalendarIcon className="w-7 h-7 text-indigo-400" />
            <span>MASTER CALENDAR</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Time Management • Drizzle ORM + Laragon MySQL Event Scheduler & Timeline
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Scheduled Events:</span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
            {initialEvents.length}
          </Badge>
        </div>
      </div>

      {/* Master Calendar Component */}
      <MasterCalendar initialEvents={initialEvents} />
    </div>
  );
}
