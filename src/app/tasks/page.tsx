import React from "react";
import { getTasksWithProjects } from "./actions";
import { KanbanBoard } from "@/components/kanban-board";
import { CheckSquare, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0; // Disable static cache for live data updates

export default async function TasksPage() {
  const {
    tasks: initialTasks,
    projects: initialProjects,
    assets: initialAssets,
    notes: initialNotes,
  } = await getTasksWithProjects();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <CheckSquare className="w-7 h-7 text-indigo-400" />
            <span>OMNI-KANBAN MANAGEMENT HUB</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Data-First Operations • Real-time Drizzle ORM + Asset & Second Brain Integration
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Total Tasks in DB:</span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
            {initialTasks.length}
          </Badge>
        </div>
      </div>

      {/* Interactive Client Board Component */}
      <KanbanBoard
        initialTasks={initialTasks}
        initialProjects={initialProjects}
        initialAssets={initialAssets}
        initialNotes={initialNotes}
      />
    </div>
  );
}
