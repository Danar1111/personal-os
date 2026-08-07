"use client";

import React from "react";
import { Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchTrigger() {
  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent("open-global-search"));
  };

  return (
    <div
      onClick={handleOpenSearch}
      className="flex items-center gap-3 w-96 relative cursor-pointer group"
    >
      <div className="relative w-full">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-white transition-colors" />
        <Input
          readOnly
          placeholder="Search pages, notes, tasks, items... (Ctrl+K)"
          className="pl-9 pr-12 bg-white/[0.04] border-white/10 text-xs text-slate-200 placeholder:text-slate-400 rounded-xl cursor-pointer group-hover:border-indigo-500/50 group-hover:bg-white/[0.06] transition-all font-mono"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded group-hover:text-white group-hover:border-white/20 transition-colors">
          <Command className="w-2.5 h-2.5 inline mr-0.5" />K
        </kbd>
      </div>
    </div>
  );
}
