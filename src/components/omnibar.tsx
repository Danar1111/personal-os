"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  CheckSquare,
  Brain,
  Wallet,
  FileText,
  FolderArchive,
  HardDrive,
  Calendar,
  Timer,
  Sparkles,
  AppWindow,
  Film,
  Settings,
  Folder,
  ArrowRight,
  Command as CommandIcon,
  X,
  Loader2,
  Wand2,
  BrainCircuit,
  Mail,
  Music,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { globalSearchAction, GlobalSearchResult } from "@/app/actions/global-search";

const PAGE_ITEMS = [
  { id: "page-overview", group: "Pages & Apps", title: "Overview Dashboard", subtitle: "Main Bento Dashboard", url: "/", icon: LayoutDashboard },
  { id: "page-spotify", group: "Pages & Apps", title: "Spotify Music Player & Synced Lyrics", subtitle: "Real-time Now Playing, Synced Lyrics & Controls", url: "#spotify", icon: Music },
  { id: "page-tasks", group: "Pages & Apps", title: "Task Omni-Kanban", subtitle: "Project & Task Management", url: "/tasks", icon: CheckSquare },

  { id: "page-skills", group: "Pages & Apps", title: "Skill Matrix", subtitle: "Learning & Progress Tracking", url: "/skills", icon: Brain },
  { id: "page-finance", group: "Pages & Apps", title: "Finance Hub", subtitle: "Income & Expense Tracker", url: "/finance", icon: Wallet },
  { id: "page-vault", group: "Pages & Apps", title: "Second Brain Vault", subtitle: "Zettelkasten Notes & Knowledge Base", url: "/vault", icon: FileText },
  { id: "page-inventory", group: "Pages & Apps", title: "Asset Vault", subtitle: "Digital Inventory & Media", url: "/inventory", icon: FolderArchive },
  { id: "page-drive", group: "Pages & Apps", title: "Local Drive", subtitle: "Cloud & Local File Storage", url: "/drive", icon: HardDrive },
  { id: "page-calendar", group: "Pages & Apps", title: "Master Calendar", subtitle: "Events & Timetable", url: "/calendar", icon: Calendar },
  { id: "page-zen", group: "Pages & Apps", title: "Zen Time-Blocker", subtitle: "Focus & Productivity Blocker", url: "/zen", icon: Timer },
  { id: "page-briefing", group: "Pages & Apps", title: "Daily AI Briefing", subtitle: "Daily Brief & Intelligence Summary", url: "/ai-briefing", icon: Sparkles },
  { id: "page-image-analyzer", group: "Pages & Apps", title: "AI Image Detail Analyzer", subtitle: "Reverse-Engineer Images into Prompts", url: "/apps/image-analyzer", icon: Wand2 },
  { id: "page-apps", group: "Pages & Apps", title: "App Launcher", subtitle: "Installed Web & System Tools", url: "/apps", icon: AppWindow },
  { id: "page-watchlist", group: "Pages & Apps", title: "TMDB Watchlist", subtitle: "Movies & Series Watchlist", url: "/watchlist", icon: Film },
  { id: "page-knowledge", group: "Pages & Apps", title: "Personal Knowledge Vault", subtitle: "Brand Guidelines, Bio & Secure Keys", url: "/knowledge", icon: BrainCircuit },
  { id: "page-emailer", group: "Pages & Apps", title: "Omni-Emailer Studio", subtitle: "Brevo Transactional Email & Templates", url: "/emailer/templates", icon: Mail },
  { id: "page-settings", group: "Pages & Apps", title: "System Settings", subtitle: "Control Center & Security Configuration", url: "/settings", icon: Settings },
];

export function Omnibar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dbResults, setDbResults] = useState<GlobalSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Auto scroll highlighted item into view during arrow key navigation
  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = itemRefs.current.get(selectedIndex);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Listen for global custom open event or Ctrl+K shortcut
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-global-search", handleOpen);

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-global-search", handleOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Run DB search on query change
  useEffect(() => {
    if (!query.trim()) {
      setDbResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearchAction(query);
        setDbResults(res);
        setSelectedIndex(0);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Match static pages against query
  const matchedPages = PAGE_ITEMS.filter(
    (p) =>
      !query.trim() ||
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  // Group all results by group name
  const allMatchedItems = [
    ...(query.trim()
      ? [
          {
            id: "ask-omni-ai",
            group: "Omni AI Assistant",
            title: `Ask Omni AI Assistant: "${query.trim()}"`,
            subtitle: "Send prompt to GPT-4o Personal OS Assistant (Ctrl+J)",
            url: "#omni-ai",
            icon: Sparkles,
          },
        ]
      : []),
    ...matchedPages.map((p) => ({
      id: p.id,
      group: p.group,
      title: p.title,
      subtitle: p.subtitle,
      url: p.url,
      icon: p.icon,
    })),
    ...dbResults.map((d) => ({
      id: d.id,
      group: d.group,
      title: d.title,
      subtitle: d.subtitle,
      url: d.url,
      icon:
        d.type === "app"
          ? AppWindow
          : d.type === "note"
          ? FileText
          : d.type === "task"
          ? CheckSquare
          : d.type === "skill"
          ? Brain
          : d.type === "finance"
          ? Wallet
          : d.type === "drive"
          ? HardDrive
          : d.type === "asset"
          ? FolderArchive
          : d.type === "calendar"
          ? Calendar
          : Folder,
    })),
  ];

  // Group items by group string
  const groups = allMatchedItems.reduce<Record<string, typeof allMatchedItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const flattenedList = Object.values(groups).flat();

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, flattenedList.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flattenedList.length) % Math.max(1, flattenedList.length));
    } else if (e.key === "Enter" && flattenedList[selectedIndex]) {
      e.preventDefault();
      handleSelectItem(flattenedList[selectedIndex]);
    }
  };

  const handleSelectItem = (item: (typeof flattenedList)[0]) => {
    const currentQuery = query;
    setIsOpen(false);
    setQuery("");
    if (item.id === "page-spotify") {
      window.dispatchEvent(new CustomEvent("trigger-spotify-status-check"));
      return;
    }

 else if (item.id === "ask-omni-ai") {
      window.dispatchEvent(new CustomEvent("open-omni-ai", { detail: { initialQuery: currentQuery } }));
    } else if (item.url.startsWith("http://") || item.url.startsWith("https://")) {

      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      // Only show loading if navigating to a different page
      const targetPath = item.url.split("?")[0].split("#")[0];
      if (targetPath !== window.location.pathname) {
        window.dispatchEvent(new CustomEvent("nav:start"));
      }
      router.push(item.url);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#0e0e14]/95 border-white/15 text-slate-100 max-w-2xl w-[92vw] max-h-[80vh] rounded-3xl p-0 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden font-mono"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Universal App & Data Search</DialogTitle>

        {/* Search Header Input */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, vault notes, tasks, finance, files..."
            className="bg-transparent border-none text-sm text-white placeholder:text-slate-500 focus-visible:ring-0 p-2 h-auto font-mono"
          />
          {isPending && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Badge variant="outline" className="border-white/15 text-slate-400 text-[10px] px-2 py-4 shrink-0 hidden sm:inline-flex">
            ESC to close
          </Badge>
        </div>

        {/* Grouped Search Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin max-h-[60vh]">
          {flattenedList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-1">
              <Search className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
              <p>No results found for &quot;{query}&quot;</p>
              <p className="text-[10px] text-slate-600 font-sans">Try searching for pages, notes, tasks, or transactions</p>
            </div>
          ) : (
            Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName} className="space-y-1">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-3 py-1 border-b border-white/5 flex items-center justify-between">
                  <span>{groupName}</span>
                  <span className="text-slate-500 text-[9px]">{items.length} items</span>
                </div>

                <div className="space-y-0.5 pt-1">
                  {items.map((item) => {
                    const itemGlobalIndex = flattenedList.findIndex((i) => i.id === item.id);
                    const isSelected = itemGlobalIndex === selectedIndex;
                    const isSpotifyItem = item.id === "page-spotify";
                    const IconComponent = item.icon;

                    return (
                      <div
                        key={item.id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(itemGlobalIndex, el);
                          else itemRefs.current.delete(itemGlobalIndex);
                        }}
                        onClick={() => handleSelectItem(item)}
                        onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all text-xs font-mono group",
                          isSelected
                            ? isSpotifyItem
                              ? "bg-[#1DB954]/20 border border-[#1DB954]/50 text-white shadow-md shadow-[#1DB954]/20"
                              : "bg-indigo-600/30 border border-indigo-500/40 text-white shadow-md"
                            : isSpotifyItem
                            ? "bg-[#1DB954]/[0.05] hover:bg-[#1DB954]/15 border border-[#1DB954]/20 text-slate-200"
                            : "hover:bg-white/5 text-slate-300 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                              isSpotifyItem
                                ? "bg-[#1DB954]/20 border-[#1DB954]/50 text-[#1DB954]"
                                : isSelected
                                ? "bg-indigo-500/30 border-indigo-500/50 text-indigo-300"
                                : "bg-white/[0.04] border-white/10 text-slate-400 group-hover:text-slate-200"
                            )}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <span className="font-bold truncate text-slate-100 group-hover:text-white">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="text-[10px] text-slate-400 font-sans truncate">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && (
                            <span className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                              Jump to <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">esc</kbd> Dismiss</span>
          </div>
          <span>Universal OS Search</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
