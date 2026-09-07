"use client";

import React from "react";
import { Search, Command, Music } from "lucide-react";
import { HeaderRoutineWidget } from "@/components/header-routine-widget";

export function SearchTrigger() {
  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent("open-global-search"));
  };

  const handleOpenSpotifySearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-spotify-search"));
  };

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 max-w-full">
      {/* Compact Quick Command Search Trigger Button */}
      <button
        onClick={handleOpenSearch}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs font-mono text-slate-400 hover:text-slate-200 transition-all cursor-pointer group shrink-0"
        title="Search pages, notes, tasks (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
        <span className="hidden sm:inline text-[11px] text-slate-400 group-hover:text-slate-300 font-medium">
          Search
        </span>
        <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded group-hover:text-white group-hover:border-white/20 transition-colors flex items-center">
          <Command className="w-2.5 h-2.5 mr-0.5" />K
        </kbd>
      </button>

      {/* Quick Spotify Track Search Button */}
      <button
        onClick={handleOpenSpotifySearch}
        className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-xs font-mono transition-all cursor-pointer shadow-sm group shrink-0"
        title="Search Spotify Tracks & Instant Play (Alt+S)"
      >
        <Music className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold">Spotify</span>
        <kbd className="px-1 py-0.2 text-[9px] font-mono bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-300">
          Alt+S
        </kbd>
      </button>

      {/* Live Routine & Time Indicator with Next Routine Custom Tooltip */}
      <HeaderRoutineWidget />
    </div>
  );
}
