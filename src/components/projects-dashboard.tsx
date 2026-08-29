"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Project } from "@/db/schema";
import {
  createProjectHubAction,
  deleteProjectHubAction,
  uploadProjectMediaAction,
} from "@/app/projects/actions";
import { GlassDatePicker } from "@/components/ui/glass-date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Target,
  Plus,
  Calendar,
  Layers,
  FileText,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  Zap,
  Pause,
  Flag,
  AlertTriangle,
  Search,
  X,
  Trash2,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  MoreVertical,
  ImageIcon,
  UploadCloud,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function extractYouTubeThumbnail(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    let videoId: string | null = null;
    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.slice(1);
    } else if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
    }
    if (videoId) {
      videoId = videoId.split("?")[0].split("&")[0];
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } catch {}
  return null;
}

export function resolveAssetMediaUrl(asset: any): string {
  if (!asset) return "";
  if (asset.thumbnailUrl && typeof asset.thumbnailUrl === "string" && asset.thumbnailUrl.trim().length > 0) {
    return asset.thumbnailUrl.trim();
  }
  const yt = extractYouTubeThumbnail(asset.urlOrPath || "");
  if (yt) return yt;
  if (asset.gdriveId && (asset.type === "image" || /\.(png|jpg|jpeg|webp|gif|svg|ico|bmp|avif)$/i.test(asset.title || asset.urlOrPath || ""))) {
    return `/api/drive/preview/${asset.gdriveId}`;
  }
  return asset.urlOrPath || "";
}

export function isAssetImage(asset: any): boolean {
  if (!asset) return false;
  // 1. Explicit image asset type
  if (asset.type === "image") return true;
  // 2. Asset with web OpenGraph / custom thumbnail (e.g. bookmarks in Asset Vault)
  if (asset.thumbnailUrl && typeof asset.thumbnailUrl === "string" && asset.thumbnailUrl.trim().length > 0) return true;
  // 3. YouTube link asset with auto thumbnail
  if (asset.urlOrPath && extractYouTubeThumbnail(asset.urlOrPath)) return true;
  // 4. Matches image file extensions
  const imageExtRegex = /\.(png|jpg|jpeg|webp|gif|svg|ico|bmp|avif)$/i;
  if (asset.title && imageExtRegex.test(asset.title)) return true;
  if (asset.urlOrPath && imageExtRegex.test(asset.urlOrPath)) return true;
  return false;
}

export function isImageIcon(val: string | null | undefined): boolean {
  if (!val) return false;
  const str = val.trim().toLowerCase();
  return (
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("/uploads/") ||
    str.startsWith("/api/drive/") ||
    str.startsWith("data:image/") ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico|bmp|avif)$/i.test(str)
  );
}

export function ProjectIconDisplay({
  icon,
  className = "w-9 h-9",
  imageClassName = "w-full h-full object-cover rounded-xl",
  emojiClassName = "text-lg",
  fallback = <Target className="w-4.5 h-4.5 text-indigo-400" />,
}: {
  icon?: string | null;
  className?: string;
  imageClassName?: string;
  emojiClassName?: string;
  fallback?: React.ReactNode;
}) {
  if (!icon) {
    return (
      <div className={cn("rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0", className)}>
        {fallback}
      </div>
    );
  }

  if (isImageIcon(icon)) {
    return (
      <div className={cn("rounded-2xl bg-white/5 border border-white/15 overflow-hidden shrink-0 shadow-inner flex items-center justify-center p-0.5", className)}>
        <img
          src={icon}
          alt="Logo"
          className={imageClassName}
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center shrink-0 shadow-inner", className, emojiClassName)}>
      <span>{icon}</span>
    </div>
  );
}

interface ProjectsDashboardProps {
  initialProjects: Project[];
  initialImageAssets?: any[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PLANNING: { label: "Planning", color: "bg-blue-500/20 text-blue-400 border-blue-500/40", icon: <Clock className="w-3.5 h-3.5 text-blue-400" /> },
  ACTIVE: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", icon: <Zap className="w-3.5 h-3.5 text-emerald-400" /> },
  PAUSED: { label: "Paused", color: "bg-amber-500/20 text-amber-400 border-amber-500/40", icon: <Pause className="w-3.5 h-3.5 text-amber-400" /> },
  OVERDUE: { label: "Overdue", color: "bg-rose-500/20 text-rose-400 border-rose-500/40", icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> },
  COMPLETED: { label: "Completed", color: "bg-purple-500/20 text-purple-400 border-purple-500/40", icon: <Flag className="w-3.5 h-3.5 text-purple-400" /> },
};

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectsDashboard({ initialProjects, initialImageAssets = [] }: ProjectsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isPending, startTransition] = useTransition();

  const imageAssetsList = useMemo(() => initialImageAssets.filter(isAssetImage), [initialImageAssets]);

  // Keep state updated when server re-renders or props change
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  // Refresh server data when navigating to dashboard
  useEffect(() => {
    router.refresh();
  }, [router]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Sync from URL search params (e.g. from Universal Search)
  useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Create Project Modal State
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [iconMode, setIconMode] = useState<"presets" | "upload" | "drive">("presets");
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverSourceTab, setCoverSourceTab] = useState<"upload" | "drive" | "url">("upload");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [status, setStatus] = useState("PLANNING");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState("");

  const iconInputRef = React.useRef<HTMLInputElement>(null);

  // Delete Confirmation Modal State
  const [deletingProjectConfirm, setDeletingProjectConfirm] = useState<Project | null>(null);

  const handleOpenNewProject = () => {
    setName("");
    setDescription("");
    setIcon("🎯");
    setIconMode("presets");
    setCoverUrl("");
    setCoverSourceTab("upload");
    setStatus("PLANNING");
    setStartDate("");
    setTargetDate("");
    setError("");
    setIsNewProjectOpen(true);
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "cover");
      const res = await uploadProjectMediaAction(formData);
      if (res.success && res.url) {
        setCoverUrl(res.url);
      } else {
        setError(res.error || "Failed to upload cover image");
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload cover image");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleIconFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingIcon(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "icon");
      const res = await uploadProjectMediaAction(formData);
      if (res.success && res.url) {
        setIcon(res.url);
      } else {
        setError(res.error || "Failed to upload icon / logo");
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload icon / logo");
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setError("");

    startTransition(async () => {
      try {
        const result = await createProjectHubAction({
          name: name.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          coverUrl: coverUrl.trim() || undefined,
          status,
          startDate: startDate || undefined,
          targetDate: targetDate || undefined,
          isHub: true,
        });

        if (result.success && result.insertId) {
          setIsNewProjectOpen(false);
          router.push(`/projects/${result.insertId}`);
        }
      } catch (err: any) {
        setError(err.message || "Failed to create project");
      }
    });
  };

  const handleDeleteProjectConfirmed = () => {
    if (!deletingProjectConfirm) return;
    const id = deletingProjectConfirm.id;
    startTransition(async () => {
      await deleteProjectHubAction(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeletingProjectConfirm(null);
    });
  };

  // Filtered Projects computation
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, searchQuery, statusFilter]);

  const activeCount = useMemo(() => projects.filter((p) => p.status === "ACTIVE").length, [projects]);
  const planningCount = useMemo(() => projects.filter((p) => p.status === "PLANNING").length, [projects]);
  const pausedCount = useMemo(() => projects.filter((p) => p.status === "PAUSED").length, [projects]);
  const overdueCount = useMemo(() => projects.filter((p) => p.status === "OVERDUE").length, [projects]);
  const completedCount = useMemo(() => projects.filter((p) => p.status === "COMPLETED").length, [projects]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <Target className="w-7 h-7 text-indigo-400" />
            <span>PROJECT &amp; STRATEGY HUB</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Macro-level Command Center • Roadmaps • Docs • Scoped Kanban
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{projects.length} Projects</span>
          </div>
          <Button
            onClick={handleOpenNewProject}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium font-mono shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Toolbar: Live Search & Status Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-3xl bg-white/[0.03] border border-white/10">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title or description..."
            className="pl-9 pr-8 bg-white/[0.04] border-white/10 text-xs text-white rounded-2xl h-11 font-mono focus:border-indigo-500 placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer",
              statusFilter === "ALL"
                ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
            )}
          >
            All ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "ACTIVE"
                ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30"
                : "bg-white/5 border border-white/10 text-emerald-400 hover:bg-emerald-500/10"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Active ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PLANNING")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "PLANNING"
                ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                : "bg-white/5 border border-white/10 text-blue-400 hover:bg-blue-500/10"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Planning ({planningCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PAUSED")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "PAUSED"
                ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30"
                : "bg-white/5 border border-white/10 text-amber-400 hover:bg-amber-500/10"
            )}
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Paused ({pausedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("OVERDUE")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "OVERDUE"
                ? "bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30"
                : "bg-white/5 border border-white/10 text-rose-400 hover:bg-rose-500/10"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue ({overdueCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "COMPLETED"
                ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                : "bg-white/5 border border-white/10 text-purple-400 hover:bg-purple-500/10"
            )}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Completed ({completedCount})</span>
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4 text-slate-500">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-slate-300 font-mono text-base font-semibold mb-1">
            {searchQuery ? "No Matching Projects Found" : "No Strategic Projects Yet"}
          </h3>
          <p className="text-slate-500 text-xs max-w-sm mb-6 font-mono">
            {searchQuery
              ? `No projects matched "${searchQuery}". Try clearing your search or change the filter.`
              : "Create a project to map your business roadmap, project phases, scoped Kanban, and attached documents."}
          </p>
          {searchQuery ? (
            <Button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              variant="outline"
              className="border-white/15 text-slate-300 hover:bg-white/10 text-xs font-mono rounded-2xl h-10 px-5 gap-2 cursor-pointer"
            >
              Clear Search
            </Button>
          ) : (
            <Button
              onClick={handleOpenNewProject}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.PLANNING;
            const phaseCount = (project as any).phaseCount ?? 0;
            const taskCount = (project as any).taskCount ?? 0;
            const doneTaskCount = (project as any).doneTaskCount ?? 0;
            const docCount = (project as any).docCount ?? 0;
            const linkCount = (project as any).linkCount ?? 0;
            const progress = (project as any).progress ?? 0;

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group relative flex flex-col justify-between rounded-3xl bg-[#12111a]/80 border border-white/10 hover:border-indigo-500/50 hover:bg-[#161424]/90 transition-all duration-300 overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 backdrop-blur-xl"
              >
                {/* Consistent Top Cover / Aesthetic Cyberpunk Fallback Banner */}
                <div className="relative w-full h-32 sm:h-36 bg-[#161424] overflow-hidden border-b border-white/10 group-hover:border-indigo-500/30 transition-colors shrink-0">
                  {project.coverUrl ? (
                    <>
                      <img
                        src={project.coverUrl}
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#12111a] via-[#12111a]/25 to-transparent" />
                    </>
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-between px-5 bg-gradient-to-br from-[#1c192e] via-[#131220] to-[#1a172c]">
                      {/* Sleek top glowing neon accent line */}
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                      {/* Tech dot matrix pattern */}
                      <div
                        className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.14] transition-opacity pointer-events-none"
                        style={{
                          backgroundImage: `radial-gradient(circle at 1px 1px, #a5b4fc 1px, transparent 0)`,
                          backgroundSize: "16px 16px",
                        }}
                      />
                      {/* Watermarked Ambient Icon */}
                      <div className="absolute right-4 -bottom-1 opacity-[0.08] group-hover:opacity-[0.18] group-hover:scale-110 transition-all duration-500 pointer-events-none select-none text-6xl">
                        {project.icon && !isImageIcon(project.icon) ? project.icon : "🎯"}
                      </div>
                      <div className="relative z-10 space-y-0.5">
                        <span className="text-[10px] font-mono tracking-wider text-indigo-400/80 font-bold uppercase block">
                          PROJECT WORKSPACE
                        </span>
                        <span className="text-xs font-mono text-slate-400 group-hover:text-slate-200 transition-colors truncate max-w-[220px] block font-medium">
                          {project.name}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#12111a] via-transparent to-transparent pointer-events-none" />
                    </div>
                  )}
                </div>

                <div className="p-5.5 space-y-4 flex-1">
                  {/* Card Header: Icon + Title + Status + Delete Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ProjectIconDisplay
                        icon={project.icon}
                        className="w-10 h-10 rounded-2xl group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-white font-bold text-base font-mono leading-snug group-hover:text-indigo-300 transition-colors truncate">
                          {project.name}
                        </h3>
                        {(project.startDate || project.targetDate) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">
                              {formatDate(project.startDate as string | null) ?? "—"} &rarr;{" "}
                              {formatDate(project.targetDate as string | null) ?? "TBD"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`border text-[10px] font-mono px-2.5 py-1 flex items-center gap-1.5 shadow-sm ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingProjectConfirm(project);
                        }}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Project Description */}
                  {project.description ? (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 font-sans">
                      {project.description}
                    </p>
                  ) : (
                    <p className="text-slate-600 text-xs italic font-mono">
                      No description provided.
                    </p>
                  )}

                  {/* Dynamic Progress Bar */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5 font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Completion</span>
                      <span className="font-bold text-indigo-400">{progress}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>{doneTaskCount}/{taskCount} tasks done</span>
                      <span>{phaseCount} phases</span>
                    </div>
                  </div>
                </div>

                {/* Footer Metrics & Open Indicator */}
                <div className="px-5.5 py-3.5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between font-mono text-xs text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                      {docCount} docs
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                      {linkCount} links
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    <span>Open Hub</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── CREATE PROJECT POPUP MODAL ── */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-2xl max-h-[88vh] p-7 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-4 mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-mono text-white tracking-wide uppercase">
                  Create New Project
                </DialogTitle>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Set up high-level roadmaps, deadlines, and strategic milestones
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNewProjectOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-2">
            <div className="overflow-y-auto flex-1 pr-2 space-y-5 max-h-[64vh]">
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                  {error}
                </div>
              )}

              {/* Project Icon / Logo & Name */}
              <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-200 flex items-center gap-2">
                    <Smile className="w-4 h-4 text-indigo-400" />
                    <span>PROJECT ICON / LOGO</span>
                  </label>
                  {/* Icon Mode Tabs */}
                  <div className="flex items-center gap-1 p-0.5 bg-white/[0.04] border border-white/10 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIconMode("presets")}
                      className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer ${
                        iconMode === "presets"
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Emoji Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setIconMode("upload")}
                      className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        iconMode === "upload"
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <UploadCloud className="w-3 h-3" />
                      Upload Logo
                    </button>
                    <button
                      type="button"
                      onClick={() => setIconMode("drive")}
                      className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer ${
                        iconMode === "drive"
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      From Assets
                    </button>
                  </div>
                </div>

                {/* Hidden input for Icon Upload */}
                <input
                  type="file"
                  ref={iconInputRef}
                  onChange={handleIconFileUpload}
                  accept="image/*"
                  className="hidden"
                />

                <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3.5 items-start">
                  <div className="space-y-1.5 flex flex-col items-center">
                    <ProjectIconDisplay
                      icon={icon}
                      className="w-16 h-16 rounded-2xl text-2xl border-white/20"
                      imageClassName="w-full h-full object-contain p-1 rounded-xl"
                    />
                    {isImageIcon(icon) && (
                      <button
                        type="button"
                        onClick={() => setIcon("🎯")}
                        className="text-[9px] font-mono text-rose-400 hover:underline cursor-pointer"
                      >
                        Reset Icon
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-300">Project Name *</label>
                      <Input
                        required
                        autoFocus
                        placeholder="e.g. NextGen SaaS Platform 2.0"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-white/[0.04] border-white/15 text-sm text-white font-mono rounded-2xl h-11 px-4 focus:border-indigo-500"
                      />
                    </div>

                    {iconMode === "presets" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {["🎯", "🚀", "💻", "⚡", "📱", "🎨", "🌐", "💼", "📊", "💡", "🛠️", "🔥"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setIcon(emoji)}
                              className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                                icon === emoji
                                  ? "bg-indigo-500/30 border border-indigo-500/60 scale-110 shadow-lg shadow-indigo-500/20"
                                  : "bg-white/5 hover:bg-white/15 border border-white/10 hover:scale-105"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {iconMode === "upload" && (
                      <button
                        type="button"
                        onClick={() => iconInputRef.current?.click()}
                        disabled={isUploadingIcon}
                        className="w-full py-2.5 px-3 border border-dashed border-white/20 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-indigo-500/5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-mono text-slate-300"
                      >
                        {isUploadingIcon ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            <span>Uploading & Syncing to Drive...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Choose Logo File (PNG, JPG, SVG, WebP)</span>
                          </>
                        )}
                      </button>
                    )}

                    {iconMode === "drive" && (
                      <div className="space-y-1.5 max-h-24 overflow-y-auto">
                        {imageAssetsList.length === 0 ? (
                          <span className="text-[10px] font-mono text-slate-500">No image assets found.</span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {imageAssetsList.map((asset: any) => {
                              const assetUrl = resolveAssetMediaUrl(asset);
                              return (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => setIcon(assetUrl)}
                                  className={`w-7 h-7 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                    icon === assetUrl ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-white/10"
                                  }`}
                                  title={asset.title}
                                >
                                  <img src={assetUrl} alt={asset.title} className="w-full h-full object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover / Thumbnail Image Selector */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-200 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    <span>PROJECT COVER / THUMBNAIL</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">Optional</span>
                </div>

                {/* Source Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/10 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setCoverSourceTab("upload")}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      coverSourceTab === "upload"
                        ? "bg-indigo-600 text-white font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Upload Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverSourceTab("drive")}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      coverSourceTab === "drive"
                        ? "bg-indigo-600 text-white font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    From Drive / Assets ({imageAssetsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverSourceTab("url")}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      coverSourceTab === "url"
                        ? "bg-indigo-600 text-white font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Direct URL
                  </button>
                </div>

                {/* Hidden File Input for Local Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCoverFileUpload}
                  accept="image/*"
                  className="hidden"
                />

                {coverSourceTab === "upload" && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingCover}
                      className="w-full py-4 px-4 border-2 border-dashed border-white/15 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-indigo-500/5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 transition-colors">
                        {isUploadingCover ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-mono text-slate-200 block font-medium">
                          {isUploadingCover
                            ? "Saving media & auto-uploading to Google Drive..."
                            : "Click to browse and upload image from your computer"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          File will be saved to local media storage and indexed in Drive Vault
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {coverSourceTab === "drive" && (
                  <div className="space-y-2">
                    {imageAssetsList.length === 0 ? (
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-500 font-mono">
                        No image assets found in Drive / Asset Vault. You can upload a local image or paste a URL.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-1">
                        {imageAssetsList.map((asset: any) => {
                          const assetUrl = resolveAssetMediaUrl(asset);
                          const isSelected = coverUrl === assetUrl;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => setCoverUrl(assetUrl)}
                              className={`relative group h-20 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-indigo-500 ring-2 ring-indigo-500/50 scale-95"
                                  : "border-white/10 hover:border-white/30"
                              }`}
                            >
                              <img
                                src={assetUrl}
                                alt={asset.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                <span className="text-[9px] text-white truncate block font-mono text-left">
                                  {asset.title}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {coverSourceTab === "url" && (
                  <div className="space-y-2">
                    <Input
                      placeholder="https://images.unsplash.com/... or image URL"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white font-mono rounded-2xl h-11 px-4 focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Live Preview Box with Remove Action */}
                {coverUrl && (
                  <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-indigo-500/30 group mt-2">
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                      onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex items-end justify-between p-3">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                        Cover Preview Active
                      </span>
                      <button
                        type="button"
                        onClick={() => setCoverUrl("")}
                        className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/40 text-rose-300 text-[10px] font-mono transition-colors cursor-pointer"
                      >
                        Remove Cover
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Description</label>
                <Textarea
                  placeholder="Describe project objectives, scope, or high-level milestones..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="bg-white/[0.04] border-white/15 text-xs text-white font-sans rounded-2xl p-3.5 resize-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>START DATE</span>
                  </label>
                  <GlassDatePicker
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                    placeholder="Select start date..."
                    accentColor="indigo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>TARGET DATE</span>
                  </label>
                  <GlassDatePicker
                    value={targetDate}
                    onChange={(val) => setTargetDate(val)}
                    placeholder="Select target date..."
                    accentColor="purple"
                  />
                </div>
              </div>
            </div>

            {/* Full Width Create Project Button */}
            <DialogFooter className="shrink-0 pt-4 border-t border-white/10 mt-3 flex items-center">
              <Button
                type="submit"
                disabled={isPending || !name.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-xs font-bold rounded-2xl h-12 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <span>Create Project</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── STANDARD GLASSMORPHIC DELETE PROJECT MODAL ── */}
      {deletingProjectConfirm && (
        <Dialog open={!!deletingProjectConfirm} onOpenChange={() => setDeletingProjectConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE STRATEGIC PROJECT</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingProjectConfirm.name}&quot;</span>?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">All phases will be deleted. Scoped tasks and drive files will be unlinked. This cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingProjectConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={handleDeleteProjectConfirmed}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
