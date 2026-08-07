"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Code2,
  LineChart,
  Bot,
  Globe,
  Server,
  Film,
  Wallet,
  Brain,
  Settings,
  Zap,
  Sparkles,
  Database,
  Calendar,
  DollarSign,
  Layers,
  Folder,
  BookOpen,
  Terminal,
  Activity,
  LucideIcon,
} from "lucide-react";

interface AppItem {
  id: number;
  name: string;
  url: string;
  iconName?: string;
  category?: string;
  useFavicon?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Code2,
  LineChart,
  Bot,
  Globe,
  Server,
  Film,
  Wallet,
  Brain,
  Settings,
  Zap,
  Sparkles,
  Database,
  Calendar,
  DollarSign,
  Layers,
  Folder,
  BookOpen,
  Terminal,
  Activity,
};

function getAppIcon(app: AppItem) {
  if (app.useFavicon && app.url.startsWith("http")) {
    try {
      const hostname = new URL(app.url).hostname;
      return (
        <img
          src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
          alt={app.name}
          className="w-5 h-5 object-contain"
          onError={(e) => {
            // fallback
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      );
    } catch {
      // fallback
    }
  }

  const IconComp = (app.iconName && ICON_MAP[app.iconName]) ? ICON_MAP[app.iconName] : Globe;
  return <IconComp className="w-5 h-5" />;
}

export function AppLauncherWidget({ apps = [] }: { apps?: AppItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // Mouse wheel horizontal scroll handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRef.current && e.deltaY !== 0) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // scroll speed multiplier
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  return (
    <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-mono tracking-wider uppercase">
              QUICK APP LAUNCHER &amp; WEB SHORTCUTS
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              Scroll horizontally • Fast Launchpad for Core Utilities &amp; Web Services
            </p>
          </div>
        </div>

        <Link
          href="/apps"
          className="text-xs font-mono text-purple-400 hover:text-purple-300 underline flex items-center gap-1"
        >
          All Applications →
        </Link>
      </div>

      {/* Scrollable Container with Drag & Mouse Wheel */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex items-center gap-3 overflow-x-auto scrollbar-none py-1 cursor-grab active:cursor-grabbing select-none transition-all`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {apps.map((app) => {
          const isExternal = app.url.startsWith("http");
          const content = (
            <div className="min-w-[130px] sm:min-w-[140px] p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 transition-all flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer shadow-md hover:-translate-y-1">
              <div className="p-2.5 rounded-xl border text-purple-300 bg-purple-500/10 border-purple-500/30 transition-transform group-hover:scale-110 flex items-center justify-center">
                {getAppIcon(app)}
              </div>
              <div className="w-full">
                <div className="text-xs font-bold font-mono text-white group-hover:text-purple-300 transition-colors truncate max-w-[110px] mx-auto">
                  {app.name}
                </div>
                <div className="text-[9px] text-slate-400 font-mono truncate">{app.category || "App"}</div>
              </div>
            </div>
          );

          if (isExternal) {
            return (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
              >
                {content}
              </a>
            );
          }

          return (
            <Link key={app.id} href={app.url} draggable={false}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
