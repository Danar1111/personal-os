import React from "react";
import { db } from "@/db";
import { tasks, transactions, calendarEvents } from "@/db/schema";
import { DailyBriefing } from "@/components/daily-briefing";
import { Sparkles, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;

export default async function AIBriefingPage() {
  const allTasks = await db.select().from(tasks);
  const allTransactions = await db.select().from(transactions);
  const allEvents = await db.select().from(calendarEvents);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <Sun className="w-7 h-7 text-amber-400" />
            <span>DAILY AI BRIEFING</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Morning Executive Dashboard • Real-Time AI Synthesis of Tasks, Ledger & Master Calendar
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Engine:</span>
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px]">
            CONNECTED
          </Badge>
        </div>
      </div>

      {/* Daily Briefing Component */}
      <DailyBriefing
        taskCount={allTasks.length}
        transactionCount={allTransactions.length}
        eventCount={allEvents.length}
      />
    </div>
  );
}
