import React from "react";
import { ZenTimer } from "@/components/zen-timer";
import { Timer, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ZenPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <Timer className="w-7 h-7 text-indigo-400" />
            <span>ZEN TIME-BLOCKER</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Focus & Productivity • 25m Focus / 5m Break Pomodoro Engine
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Cinematic Focus Mode:</span>
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px]">
            ACTIVE
          </Badge>
        </div>
      </div>

      {/* Zen Timer Component */}
      <ZenTimer />
    </div>
  );
}
