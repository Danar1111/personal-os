"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Sun,
  CheckSquare,
  Wallet,
  Calendar,
  Loader2,
  Bot,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DailyBriefingProps {
  taskCount: number;
  transactionCount: number;
  eventCount: number;
}

export function DailyBriefing({
  taskCount,
  transactionCount,
  eventCount,
}: DailyBriefingProps) {
  const [briefingText, setBriefingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateBriefing = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setBriefingText("");

    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to generate briefing (HTTP ${response.status})`
        );
      }

      if (!response.body) {
        throw new Error("No response stream body returned from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        
        // Sanitize Vercel AI SDK text stream protocol formatting if present
        let cleaned = rawChunk;
        if (cleaned.startsWith('0:"')) {
          cleaned = cleaned
            .replace(/^0:"/, "")
            .replace(/"\n?$/, "")
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"');
        }

        fullText += cleaned;
        setBriefingText(fullText);
      }
    } catch (err: any) {
      console.error("Briefing generation failed:", err);
      setErrorMsg(err.message || "Failed to generate morning briefing");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Action Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-400">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>DAILY AI BRIEFING ENGINE</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Executive Morning Synthesis • Aggregates Tasks, Ledger & Master Calendar
              </p>
            </div>
          </div>

          <Button
            size="lg"
            disabled={isLoading}
            onClick={handleGenerateBriefing}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-xs rounded-2xl h-12 px-6 shadow-xl shadow-indigo-600/30 gap-2 shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing Briefing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate Executive Briefing</span>
              </>
            )}
          </Button>
        </div>

        {/* Live Context Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/10 font-mono">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Kanban Tasks</div>
              <div className="text-sm font-bold text-white">{taskCount} Active Items</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Ledger Entries</div>
              <div className="text-sm font-bold text-white">{transactionCount} Transactions</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Calendar Timeline</div>
              <div className="text-sm font-bold text-white">{eventCount} Events Scheduled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Briefing Output Display Area */}
      <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              MORNING INTELLIGENCE REPORT
            </h3>
          </div>

          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px] font-mono">
            {isLoading ? "STREAMING REAL-TIME..." : briefingText ? "SYNTHESIS COMPLETE" : "STANDBY"}
          </Badge>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {briefingText ? (
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 font-sans leading-relaxed whitespace-pre-wrap pt-2">
            {briefingText}
          </div>
        ) : (
          !errorMsg && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 text-slate-500 font-mono text-xs">
              <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
              <p>Click "Generate Executive Briefing" above to compile your morning briefing</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
