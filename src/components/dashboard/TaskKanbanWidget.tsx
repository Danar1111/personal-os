"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ListTodo, ArrowUpRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority?: string;
}

interface TaskKanbanWidgetProps {
  tasks: TaskItem[];
  totalTasks: number;
  completedTasks: number;
}

export function TaskKanbanWidget({
  tasks = [],
  totalTasks = 0,
  completedTasks = 0,
}: TaskKanbanWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statusPriority: Record<string, number> = {
    in_progress: 1,
    todo: 2,
    done: 3,
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const pA = statusPriority[a.status] || 2;
    const pB = statusPriority[b.status] || 2;
    return pA - pB;
  });

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-6 border border-white/10 flex flex-col justify-start h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <ListTodo className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-mono tracking-wider uppercase">
              TASK OMNI-KANBAN
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">{completionRate}% Completion Rate</p>
          </div>
        </div>

        <Link href="/tasks" className="text-slate-400 hover:text-white transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Task Completion Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono text-slate-300">
          <span>Completed Tasks</span>
          <span className="font-bold text-white">{completedTasks} / {totalTasks}</span>
        </div>
        <Progress value={completionRate} className="h-2 bg-white/10" />
      </div>

      {/* Task List (Fits up to 4 items without scrollbar, scrolls if > 4) */}
      {tasks.length === 0 ? (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs font-mono text-slate-500">
          No active tasks found in Omni-Kanban.
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto max-h-[230px] pr-1 font-mono">
          {sortedTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => setIsModalOpen(true)}
              className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-500/40 cursor-pointer flex items-center justify-between text-xs transition-all group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-400" : "bg-indigo-400"}`} />
                <span className={`truncate max-w-[170px] ${t.status === "done" ? "line-through text-slate-500" : "text-white group-hover:text-indigo-300"}`}>
                  {t.title}
                </span>
              </div>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 shrink-0 ${
                  t.status === "done"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
                }`}
              >
                {t.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Task Stack Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg w-[92vw] bg-[#0e0e12]/95 border-white/15 text-slate-100 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-4">
          <DialogTitle className="sr-only">Task Stack Details</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                <ListTodo className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono text-white tracking-wide uppercase">
                  TASK OMNI-KANBAN WORKSPACE
                </h3>
                <p className="text-[11px] text-indigo-300 font-mono">
                  {completedTasks} / {totalTasks} Tasks Completed ({completionRate}%)
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

          {/* Task Items List */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {sortedTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 hover:border-indigo-500/40 transition-all font-mono text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-400" : "bg-indigo-400"}`} />
                  <span className={`truncate ${t.status === "done" ? "line-through text-slate-400" : "text-white font-semibold"}`}>
                    {t.title}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[9px] px-2 py-0.5 shrink-0 ${
                    t.status === "done"
                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                      : "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
                  }`}
                >
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <Link
              href="/tasks"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
            >
              Open Full Omni-Kanban Workspace →
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
