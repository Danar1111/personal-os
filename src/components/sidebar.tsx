"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useZenRunning } from "@/hooks/use-zen-running";
import {
  LayoutDashboard,
  CheckSquare,
  Sparkles,
  Wallet,
  Brain,
  FileText,
  FolderArchive,
  HardDrive,
  Calendar,
  Timer,
  AppWindow,
  Film,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Flame,
  Lock,
  Wand2,
  BrainCircuit,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserNicknameAction } from "@/app/knowledge/actions";
import { SpotifyFloatingWidget } from "@/components/spotify-floating-widget";


const navItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Task Omni-Kanban", href: "/tasks", icon: CheckSquare },
  { name: "Skill Matrix", href: "/skills", icon: Brain },
  { name: "Finance Hub", href: "/finance", icon: Wallet },
  { name: "Second Brain Vault", href: "/vault", icon: FileText },
  { name: "Asset Vault", href: "/inventory", icon: FolderArchive },
  { name: "Local Drive", href: "/drive", icon: HardDrive },
  { name: "Master Calendar", href: "/calendar", icon: Calendar },
  { name: "Zen Time-Blocker", href: "/zen", icon: Timer },
  { name: "Daily AI Briefing", href: "/ai-briefing", icon: Sparkles },
  { name: "AI Image Analyzer", href: "/apps/image-analyzer", icon: Wand2 },
  { name: "App Launcher", href: "/apps", icon: AppWindow },
  { name: "TMDB Watchlist", href: "/watchlist", icon: Film },
  { name: "Knowledge Vault", href: "/knowledge", icon: BrainCircuit },
  { name: "Omni-Emailer", href: "/emailer", icon: Mail },
  { name: "System Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [zenWarning, setZenWarning] = useState(false);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const pathname = usePathname();
  const zenRunning = useZenRunning();

  React.useEffect(() => {
    getUserNicknameAction().then((name) => {
      if (name) setUserNickname(name);
    });
  }, [pathname]);

  const handleLockedNav = () => {
    setZenWarning(true);
    setTimeout(() => setZenWarning(false), 2200);
  };

  const displayName = userNickname || "Admin Architect";
  const avatarInitials = userNickname
    ? userNickname.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen glass-panel border-r border-white/10 transition-all duration-300 z-30 select-none",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center h-16 border-b border-white/10 transition-all relative",
          isCollapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 shrink-0",
            isCollapsed && "justify-center w-full"
          )}
          title="Personal OS Overview"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 shrink-0 shadow-lg shadow-indigo-500/20 overflow-hidden">
            <img src="/logo.png" alt="Personal OS Logo" className="w-full h-full object-cover" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-wider text-white uppercase font-mono truncate">
                Personal OS
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse glow-emerald shrink-0" />
                v1.0 ONLINE
              </span>
            </div>
          )}
        </Link>

        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "transition-all cursor-pointer flex items-center justify-center text-slate-300 hover:text-white bg-[#141420] border border-white/20 shadow-xl hover:scale-110 z-40",
            isCollapsed
              ? "absolute -right-3.5 top-4.5 w-7 h-7 rounded-full"
              : "w-8 h-8 rounded-lg hover:bg-white/10 border-transparent bg-transparent"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-200" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {/* Zen lock warning banner */}
        {zenRunning && zenWarning && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-amber-400 text-[11px] font-mono animate-in fade-in slide-in-from-top-1 duration-200">
            <Flame className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span>Navigation locked during Zen</span>
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isZenPage = item.href === "/zen";
          const isLocked = zenRunning && !isZenPage;

          if (isLocked) {
            return (
              <button
                key={item.href}
                onClick={handleLockedNav}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative cursor-not-allowed opacity-40",
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400"
                )}
              >
                <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                {!isCollapsed && (
                  <span className="truncate tracking-wide font-mono text-[13px] flex-1 text-left">
                    {item.name}
                  </span>
                )}
                {!isCollapsed && (
                  <Lock className="w-3 h-3 text-slate-600 shrink-0" />
                )}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative",
                isActive
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                isZenPage && zenRunning && "ring-1 ring-amber-500/40 bg-amber-500/10 text-amber-300 border border-amber-500/20"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200",
                  isZenPage && zenRunning && "text-amber-400"
                )}
              />
              {!isCollapsed && (
                <span className="truncate tracking-wide font-mono text-[13px] flex-1">
                  {item.name}
                </span>
              )}
              {isZenPage && zenRunning && !isCollapsed && (
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              )}
              {isActive && !zenRunning && (
                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Spotify Mini Music Player */}
      <div className="px-3 py-2 border-t border-white/10">

        <SpotifyFloatingWidget isCollapsed={isCollapsed} />
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-white/10">

        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/5",
            isCollapsed && "justify-center"
          )}
        >
          <div className="relative">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-900/50 border border-indigo-500/40 text-indigo-200 font-bold text-xs font-mono">
              {avatarInitials}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0a0a0b] rounded-full"></span>
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-white truncate" title={displayName}>
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-indigo-400 inline" />
                Root Access
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
