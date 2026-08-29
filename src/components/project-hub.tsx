"use client";

import React, { useState, useTransition, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Project, ProjectPhase, Task, Asset, Note } from "@/db/schema";
import {
  createPhaseAction,
  updatePhaseAction,
  deletePhaseAction,
  updateProjectAction,
  deleteProjectHubAction,
  uploadProjectMediaAction,
} from "@/app/projects/actions";
import { isAssetImage, isImageIcon, ProjectIconDisplay, resolveAssetMediaUrl } from "@/components/projects-dashboard";
import {
  createDriveAssetAction,
  updateDriveAssetAction,
  deleteDriveAssetAction,
  getSyncFolderSettingAction,
} from "@/app/drive/actions";
import {
  createAssetAction,
  updateAssetAction,
  deleteAssetAction,
} from "@/app/inventory/actions";
import { KanbanBoard } from "@/components/kanban-board";
import { ProjectGantt, getPaletteForTitle } from "@/components/project-gantt";
import { GlassDatePicker } from "@/components/ui/glass-date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Layers,
  Plus,
  Trash2,
  Edit3,
  CheckSquare,
  FileText,
  Calendar,
  Loader2,
  Download,
  Eye,
  UploadCloud,
  CheckCircle2,
  File,
  Clock,
  Zap,
  Flag,
  Pause,
  Settings,
  AlertTriangle,
  Link2,
  X,
  Sparkles,
  Lock,
  Search,
  HardDrive,
  RefreshCw,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Presentation,
  FileCode,
  ImageIcon,
  Music,
  Film,
  FileArchive,
  Check,
  Globe,
  Smile,
  Pencil,
  Bookmark,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Filter,
} from "lucide-react";
import { useUploadStore } from "@/lib/store/useUploadStore";
import { useLocalUploadStore } from "@/lib/store/useLocalUploadStore";
import { FilePreviewModal, PreviewableFile } from "@/components/file-preview-modal";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface ProjectHubProps {
  project: Project;
  initialPhases: ProjectPhase[];
  initialTasks: Task[];
  initialAssets: Asset[];
  allProjects?: Project[];
  allAssets?: Asset[];
  allNotes?: Note[];
}

import { computeProjectAutoStatus } from "@/lib/project-status-engine";

const PHASE_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  PLANNED: { label: "Planned", icon: <Clock className="w-3.5 h-3.5 text-blue-400" /> },
  IN_PROGRESS: { label: "In Progress", icon: <Zap className="w-3.5 h-3.5 text-emerald-400" /> },
  DONE: { label: "Done", icon: <Flag className="w-3.5 h-3.5 text-purple-400" /> },
  BLOCKED: { label: "Blocked", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> },
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PLANNING: { label: "Planning", color: "bg-blue-500/20 text-blue-400 border-blue-500/40", icon: <Clock className="w-3.5 h-3.5 text-blue-400" /> },
  ACTIVE: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", icon: <Zap className="w-3.5 h-3.5 text-emerald-400" /> },
  PAUSED: { label: "Paused", color: "bg-amber-500/20 text-amber-400 border-amber-500/40", icon: <Pause className="w-3.5 h-3.5 text-amber-400" /> },
  OVERDUE: { label: "Overdue", color: "bg-rose-500/20 text-rose-400 border-rose-500/40", icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> },
  COMPLETED: { label: "Completed", color: "bg-purple-500/20 text-purple-400 border-purple-500/40", icon: <Flag className="w-3.5 h-3.5 text-purple-400" /> },
};

function formatStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PLANNED":
      return "Planned";
    case "IN_PROGRESS":
      return "In Progress";
    case "DONE":
      return "Done";
    case "BLOCKED":
      return "Blocked";
    default:
      return status || "Planned";
  }
}

/**
 * Format date only (YYYY-MM-DD / Short Month Day, Year) — NO HOURS/MINUTES
 */
function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) {
      const clean = String(d).split("T")[0];
      return clean;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
}

function formatBytes(bytes: number | string | undefined | null): string {
  if (!bytes) return "—";
  const num = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num === 0) return "—";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getDomainFromUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

function extractYouTubeThumbnail(urlStr: string): string | null {
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

function getFileExtension(title: string, urlOrPath?: string): string {
  if (title && title.includes(".")) {
    const parts = title.split(".");
    return parts[parts.length - 1].toLowerCase();
  }
  if (urlOrPath && urlOrPath.includes(".")) {
    const clean = urlOrPath.split("?")[0];
    const parts = clean.split(".");
    return parts[parts.length - 1].toLowerCase();
  }
  return "file";
}

/**
 * Standard Dark-Mode Checkbox (Matching Drive Page)
 */
function CustomCheckbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "w-4 h-4 rounded-md flex items-center justify-center transition-all cursor-pointer select-none shrink-0 outline-none",
        checked
          ? "bg-indigo-600 border border-indigo-400 text-white shadow-md shadow-indigo-600/50 scale-105"
          : "bg-white/[0.05] border border-white/20 hover:border-indigo-400/80 hover:bg-white/10 text-transparent",
        className
      )}
    >
      {checked ? <Check className="w-3 h-3 stroke-[3]" /> : <span className="w-3 h-3" />}
    </button>
  );
}

function getRichFileIcon(ext: string, mimeType?: string, iconLink?: string) {
  if (iconLink) {
    return (
      <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/15 flex items-center justify-center p-1.5 shadow-sm shrink-0">
        <img
          src={iconLink}
          alt=""
          className="w-5 h-5 object-contain"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  const lowerExt = ext.toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  // 1. PDF
  if (lowerExt === "pdf" || lowerMime.includes("pdf")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  }

  // 2. Spreadsheets
  if (["csv", "xlsx", "xls"].includes(lowerExt) || lowerMime.includes("spreadsheet") || lowerMime.includes("sheet")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
        <FileSpreadsheet className="w-4 h-4" />
      </div>
    );
  }

  // 3. Presentations
  if (["pptx", "ppt", "key"].includes(lowerExt) || lowerMime.includes("presentation")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
        <Presentation className="w-4 h-4" />
      </div>
    );
  }

  // 4. Documents
  if (["doc", "docx", "rtf", "odt"].includes(lowerExt) || lowerMime.includes("document") || lowerMime.includes("word")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  }

  // 5. Code
  if (["ts", "tsx", "js", "jsx", "json", "py", "html", "css", "sql", "sh", "ipynb"].includes(lowerExt) || lowerMime.includes("code")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-sm shrink-0">
        <FileCode className="w-4 h-4" />
      </div>
    );
  }

  // 6. Images
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(lowerExt) || lowerMime.startsWith("image/")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-sm shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  // 7. Audio
  if (["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(lowerExt) || lowerMime.startsWith("audio/")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
        <Music className="w-4 h-4" />
      </div>
    );
  }

  // 8. Video
  if (["mp4", "webm", "mkv", "mov", "avi"].includes(lowerExt) || lowerMime.startsWith("video/")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-sm shrink-0">
        <Film className="w-4 h-4" />
      </div>
    );
  }

  // 9. Archives
  if (["zip", "rar", "tar", "gz", "7z"].includes(lowerExt) || lowerMime.includes("zip")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shadow-sm shrink-0">
        <FileArchive className="w-4 h-4" />
      </div>
    );
  }

  // Default File
  return (
    <div className="w-8 h-8 rounded-xl bg-slate-500/15 border border-slate-500/30 flex items-center justify-center text-slate-400 shadow-sm shrink-0">
      <File className="w-4 h-4" />
    </div>
  );
}

function detectFileType(file: File): "pdf" | "image" | "video" {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() || "";
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(ext)) {
    return "image";
  }
  if (file.type.startsWith("video/") || ["mp4", "webm", "mkv", "mov", "avi", "wmv", "flv"].includes(ext)) {
    return "video";
  }
  return "pdf";
}

// ── Main ProjectHub Component ────────────────────────────────────────────────
export function ProjectHub({
  project: initialProject,
  initialPhases,
  initialTasks,
  initialAssets,
  allProjects = [],
  allAssets = [],
  allNotes = [],
}: ProjectHubProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [phases, setPhases] = useState<ProjectPhase[]>(initialPhases);
  const [assetList, setAssetList] = useState<Asset[]>(initialAssets);
  const [isPending, startTransition] = useTransition();

  // Active Tab state for programmatic switching
  const [activeTab, setActiveTab] = useState<string>("roadmap");

  // Expanded Phase IDs in Roadmap Breakdown
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<number[]>([]);
  const [highlightedPhaseId, setHighlightedPhaseId] = useState<number | null>(null);

  const toggleExpandPhase = (phaseId: number) => {
    setExpandedPhaseIds((prev) =>
      prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId]
    );
  };

  const handlePhaseSelect = (phaseId: number) => {
    setActiveTab("roadmap");
    setExpandedPhaseIds((prev) => (prev.includes(phaseId) ? prev : [...prev, phaseId]));
    setHighlightedPhaseId(phaseId);
    setTimeout(() => {
      setHighlightedPhaseId((curr) => (curr === phaseId ? null : curr));
    }, 2200);

    // Expand first, then execute a single smooth scroll once fully expanded
    setTimeout(() => {
      const el = document.getElementById(`phase-card-${phaseId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 320);
  };

  // Separate Documents (files) and Links
  const documentList = useMemo(() => assetList.filter((a) => a.type !== "link"), [assetList]);
  const linkList = useMemo(() => assetList.filter((a) => a.type === "link"), [assetList]);

  // Stores
  const localUpload = useLocalUploadStore();
  const { addToQueue, queue } = useUploadStore();

  // Sync Folder state
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [selectedFolderName, setSelectedFolderName] = useState<string>("Google Drive");

  useEffect(() => {
    getSyncFolderSettingAction().then((res) => {
      if (res.folderId) setSelectedFolderId(res.folderId);
      if (res.folderName) setSelectedFolderName(res.folderName);
    });
  }, []);

  // Listen to queue completions to update local state in real time
  useEffect(() => {
    queue.forEach((item) => {
      if (item.status === "completed" && item.assetId) {
        setAssetList((prev) =>
          prev.map((a) =>
            a.id === item.assetId
              ? {
                  ...a,
                  syncStatus: item.targetSyncStatus || "SYNCED_LOCAL_KEPT",
                  gdriveId: item.gdriveId || a.gdriveId,
                }
              : a
          )
        );
      }
    });
  }, [queue]);

  // ── Auto-Calculate Phase Progress & Status from Scoped Kanban Tasks ──
  const phasesWithTaskProgress = useMemo(() => {
    return phases.map((p) => {
      const phaseTasks = initialTasks.filter((t) => t.phaseId === p.id);
      const hasTasks = phaseTasks.length > 0;
      if (!hasTasks) {
        return {
          ...p,
          taskCount: 0,
          doneTaskCount: 0,
          isAutoCalculated: false,
        };
      }
      const doneCount = phaseTasks.filter((t) => t.status === "done").length;
      const inProgCount = phaseTasks.filter((t) => t.status === "in_progress").length;
      const autoProgress = Math.round((doneCount / phaseTasks.length) * 100);
      const autoStatus =
        doneCount === phaseTasks.length
          ? "DONE"
          : doneCount > 0 || inProgCount > 0
          ? "IN_PROGRESS"
          : (p.status || "PLANNED");

      return {
        ...p,
        progress: autoProgress,
        status: autoStatus,
        taskCount: phaseTasks.length,
        doneTaskCount: doneCount,
        isAutoCalculated: true,
      };
    });
  }, [phases, initialTasks]);

  // ── Confirmation Modal States ─────────────────────────────────────────────
  const [deletingPhaseConfirm, setDeletingPhaseConfirm] = useState<ProjectPhase | null>(null);
  const [deletingAssetConfirm, setDeletingAssetConfirm] = useState<Asset | null>(null);
  const [deletingLinkConfirm, setDeletingLinkConfirm] = useState<Asset | null>(null);
  const [deletingProjectConfirm, setDeletingProjectConfirm] = useState<boolean>(false);

  // ── Project Edit / Settings Dialog ───────────────────────────────────────
  const coverInputRef = useRef<HTMLInputElement>(null);
  const editIconInputRef = useRef<HTMLInputElement>(null);
  const [editCoverSourceTab, setEditCoverSourceTab] = useState<"upload" | "drive" | "url">("upload");
  const [editIconMode, setEditIconMode] = useState<"presets" | "upload" | "drive">("presets");
  const [isUploadingEditCover, setIsUploadingEditCover] = useState(false);
  const [isUploadingEditIcon, setIsUploadingEditIcon] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: project.name,
    description: project.description || "",
    icon: (project as any).icon || "🎯",
    coverUrl: (project as any).coverUrl || "",
    status: project.status || "PLANNING",
    startDate: project.startDate ? String(project.startDate).split("T")[0] : "",
    targetDate: project.targetDate ? String(project.targetDate).split("T")[0] : "",
  });

  const handleEditCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEditCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "cover");
      formData.append("projectId", String(project.id));
      const res = await uploadProjectMediaAction(formData);
      if (res.success && res.url) {
        setProjectForm((f) => ({ ...f, coverUrl: res.url! }));
      }
    } catch (err) {
      console.error("Cover upload error:", err);
    } finally {
      setIsUploadingEditCover(false);
    }
  };

  const handleEditIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEditIcon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "icon");
      formData.append("projectId", String(project.id));
      const res = await uploadProjectMediaAction(formData);
      if (res.success && res.url) {
        setProjectForm((f) => ({ ...f, icon: res.url! }));
      }
    } catch (err) {
      console.error("Icon upload error:", err);
    } finally {
      setIsUploadingEditIcon(false);
    }
  };

  const handleSaveProjectSettings = () => {
    if (!projectForm.name.trim()) return;
    startTransition(async () => {
      await updateProjectAction(project.id, {
        name: projectForm.name,
        description: projectForm.description,
        icon: projectForm.icon.trim() || null,
        coverUrl: projectForm.coverUrl.trim() || null,
        status: autoStatusInfo.status,
        startDate: projectForm.startDate || null,
        targetDate: projectForm.targetDate || null,
        isHub: true,
      });
      setProject((p) => ({
        ...p,
        name: projectForm.name,
        description: projectForm.description || null,
        icon: projectForm.icon.trim() || null,
        coverUrl: projectForm.coverUrl.trim() || null,
        status: autoStatusInfo.status,
        startDate: (projectForm.startDate || null) as any,
        targetDate: (projectForm.targetDate || null) as any,
        isHub: true,
      }));
      setIsProjectSettingsOpen(false);
    });
  };

  const handleDeleteProjectConfirmed = () => {
    startTransition(async () => {
      await deleteProjectHubAction(project.id);
      setDeletingProjectConfirm(false);
      setIsProjectSettingsOpen(false);
      router.push("/projects");
    });
  };

  // ── Phase Dialog with Smart Bi-directional Sync ───────────────────────────
  const [phaseDialog, setPhaseDialog] = useState<{ open: boolean; editing?: ProjectPhase | null }>({ open: false });
  const [phaseForm, setPhaseForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "PLANNED",
    progress: 0,
    dependsOnPhaseId: null as number | null,
  });

  const handlePhaseStatusSelect = (newStatus: string) => {
    setPhaseForm((f) => {
      let newProgress = f.progress;
      if (newStatus === "PLANNED") {
        newProgress = 0;
      } else if (newStatus === "DONE") {
        newProgress = 100;
      } else if (newStatus === "IN_PROGRESS") {
        if (f.progress === 0 || f.progress === 100) {
          newProgress = 50;
        }
      }
      return { ...f, status: newStatus, progress: newProgress };
    });
  };

  const handlePhaseProgressChange = (newProgress: number) => {
    setPhaseForm((f) => {
      let newStatus = f.status;
      if (newProgress === 0) {
        newStatus = "PLANNED";
      } else if (newProgress === 100) {
        newStatus = "DONE";
      } else {
        if (f.status !== "BLOCKED") {
          newStatus = "IN_PROGRESS";
        }
      }
      return { ...f, progress: newProgress, status: newStatus };
    });
  };

  const openAddPhase = () => {
    setPhaseForm({
      title: "",
      description: "",
      startDate: project.startDate ? String(project.startDate).split("T")[0] : "",
      endDate: project.targetDate ? String(project.targetDate).split("T")[0] : "",
      status: "PLANNED",
      progress: 0,
      dependsOnPhaseId: null,
    });
    setPhaseDialog({ open: true, editing: null });
  };

  const handleSavePhase = () => {
    if (!phaseForm.title.trim() || !phaseForm.startDate || !phaseForm.endDate) return;

    // Enforce endDate >= startDate
    let finalEndDate = phaseForm.endDate;
    if (phaseForm.startDate && phaseForm.endDate && phaseForm.endDate < phaseForm.startDate) {
      finalEndDate = phaseForm.startDate;
    }

    startTransition(async () => {
      if (phaseDialog.editing) {
        await updatePhaseAction(phaseDialog.editing.id, {
          title: phaseForm.title,
          description: phaseForm.description,
          startDate: phaseForm.startDate,
          endDate: finalEndDate,
          status: phaseForm.status,
          progress: phaseForm.progress,
          dependsOnPhaseId: phaseForm.dependsOnPhaseId,
        });
        setPhases((prev) =>
          prev.map((p) =>
            p.id === phaseDialog.editing!.id ? ({ ...p, ...phaseForm, endDate: finalEndDate } as any) : p
          )
        );
      } else {
        const res = await createPhaseAction({
          projectId: project.id,
          title: phaseForm.title,
          description: phaseForm.description,
          startDate: phaseForm.startDate,
          endDate: finalEndDate,
          status: phaseForm.status,
          progress: phaseForm.progress,
          dependsOnPhaseId: phaseForm.dependsOnPhaseId,
          orderIndex: phases.length,
        });
        const newPhase: ProjectPhase = {
          id: res.insertId || Date.now(),
          projectId: project.id,
          ...phaseForm,
          endDate: finalEndDate,
          orderIndex: phases.length,
          createdAt: new Date(),
        } as any;
        setPhases((prev) => [...prev, newPhase]);
      }
      setPhaseDialog({ open: false });
      router.refresh();
    });
  };

  const handleDeletePhaseConfirmed = () => {
    if (!deletingPhaseConfirm) return;
    const id = deletingPhaseConfirm.id;
    startTransition(async () => {
      await deletePhaseAction(id);
      setPhases((prev) => prev.filter((p) => p.id !== id));
      setDeletingPhaseConfirm(null);
    });
  };

  const handlePhaseUpdate = (
    id: number,
    data: { startDate?: string; endDate?: string; progress?: number; status?: string; dependsOnPhaseId?: number | null }
  ) => {
    let updatedStatus = data.status;
    if (data.progress !== undefined && !data.status) {
      if (data.progress === 100) {
        updatedStatus = "DONE";
      } else if (data.progress === 0) {
        updatedStatus = "PLANNED";
      } else {
        const currentPhase = phases.find((p) => p.id === id);
        if (currentPhase?.status !== "BLOCKED") {
          updatedStatus = "IN_PROGRESS";
        }
      }
    }

    const payload = {
      ...data,
      ...(updatedStatus ? { status: updatedStatus } : {}),
    };

    setPhases((prev) => prev.map((p) => (p.id === id ? ({ ...p, ...payload } as any) : p)));
    startTransition(async () => {
      await updatePhaseAction(id, payload);
    });
  };

  // ── Drive-Matching Document Upload & Management System ────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<"local_only" | "auto_sync" | "drive_only">("local_only");
  const [uploadPhaseId, setUploadPhaseId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Document Filters & Selection
  const [searchDocQuery, setSearchDocQuery] = useState("");
  const [docFilter, setDocFilter] = useState<"all" | "synced" | "unsynced">("all");
  const [docPhaseFilter, setDocPhaseFilter] = useState<string>("all");
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);

  // Edit Document Modal State
  const [editingDoc, setEditingDoc] = useState<Asset | null>(null);
  const [isEditDocModalOpen, setIsEditDocModalOpen] = useState(false);
  const [editDocForm, setEditDocForm] = useState({
    title: "",
    phaseId: null as number | null,
    docVersion: "v1.0",
    docStatus: "DRAFT",
    tags: "",
  });

  const openEditDocumentModal = (asset: Asset) => {
    setEditDocForm({
      title: asset.title,
      phaseId: asset.phaseId || null,
      docVersion: asset.docVersion || "v1.0",
      docStatus: asset.docStatus || "DRAFT",
      tags: asset.tags || "",
    });
    setEditingDoc(asset);
    setIsEditDocModalOpen(true);
  };

  const handleSaveDocEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editDocForm.title.trim()) return;

    startTransition(async () => {
      await updateDriveAssetAction(editingDoc.id, {
        title: editDocForm.title.trim(),
        phaseId: editDocForm.phaseId,
        docVersion: editDocForm.docVersion.trim() || null,
        docStatus: editDocForm.docStatus.trim() || null,
        tags: editDocForm.tags.trim(),
        projectId: project.id,
      });

      setAssetList((prev) =>
        prev.map((a) =>
          a.id === editingDoc.id
            ? {
                ...a,
                title: editDocForm.title.trim(),
                phaseId: editDocForm.phaseId,
                docVersion: editDocForm.docVersion.trim() || null,
                docStatus: editDocForm.docStatus.trim() || null,
                tags: editDocForm.tags.trim(),
              }
            : a
        )
      );

      setIsEditDocModalOpen(false);
    });
  };

  // Preview Modal
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const openAssetPreview = (asset: Asset) => {
    const ext = getFileExtension(asset.title, asset.urlOrPath);
    const isGhost = asset.syncStatus === "CLOUD_ONLY";

    setPreviewFile({
      title: asset.title,
      urlOrPath: isGhost
        ? asset.gdriveId
          ? `https://drive.google.com/file/d/${asset.gdriveId}/preview`
          : asset.urlOrPath
        : asset.urlOrPath,
      source: isGhost ? "google" : "local",
      size: asset.sizeBytes || undefined,
      extension: ext,
      googleFileId: asset.gdriveId || undefined,
      webViewLink: asset.gdriveId
        ? `https://drive.google.com/file/d/${asset.gdriveId}/preview`
        : undefined,
    });
    setIsPreviewOpen(true);
  };

  const handleOpenUploadModal = (prefillPhaseId?: number | null) => {
    setUploadFiles([]);
    setUploadMode("local_only");
    setUploadPhaseId(prefillPhaseId ?? null);
    setUploadError("");
    setIsUploadDocModalOpen(true);
  };

  const handleFilesSelected = (newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles);
    setUploadFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newUnique = filesArray.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      return [...prev, ...newUnique];
    });
    setUploadError("");
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Bulk Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadError("Please select at least one file to upload");
      return;
    }

    setIsSubmittingUpload(true);
    const filesToUpload = [...uploadFiles];
    setIsUploadDocModalOpen(false);
    setUploadFiles([]);

    localUpload.clearCompleted();

    const queuedItems: any[] = [];
    const createdAssets: Asset[] = [];

    try {
      for (let index = 0; index < filesToUpload.length; index++) {
        const file = filesToUpload[index];
        const category = detectFileType(file);

        if (uploadMode === "drive_only") {
          try {
            const created = await createDriveAssetAction({
              title: file.name,
              type: category,
              urlOrPath: `pending-gdrive-${Date.now()}-${index}`,
              tags: "",
              sizeBytes: file.size,
              syncStatus: "CLOUD_ONLY",
              projectId: project.id,
              phaseId: uploadPhaseId || null,
              docVersion: "v1.0",
              docStatus: "DRAFT",
            });

            const assetObj: Asset = {
              id: created.id || Date.now() + index,
              title: file.name,
              type: category,
              urlOrPath: `pending-gdrive-${Date.now()}-${index}`,
              thumbnailUrl: null,
              tags: "",
              sizeBytes: file.size,
              syncStatus: "CLOUD_ONLY",
              gdriveId: null,
              projectId: project.id,
              phaseId: uploadPhaseId || null,
              docVersion: "v1.0",
              docStatus: "DRAFT",
              createdAt: new Date(),
            } as any;
            createdAssets.push(assetObj);

            queuedItems.push({
              id: `asset-${created.id || Date.now()}-${Math.random()}`,
              assetId: created.id,
              name: file.name,
              size: file.size,
              file: file,
              folderId: selectedFolderId,
              folderName: selectedFolderName,
              targetSyncStatus: "CLOUD_ONLY",
            });
          } catch (err: any) {
            console.error(`Error creating Cloud Only document ${file.name}:`, err);
          }
          continue;
        }

        // Local or Auto Sync
        const itemId = `local-${Date.now()}-${index}`;
        localUpload.startItem({ id: itemId, name: file.name, size: file.size });

        try {
          const fileData: any = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/upload", true);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
            xhr.setRequestHeader("X-File-Type", file.type || "application/octet-stream");

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.round((evt.loaded / evt.total) * 100);
                localUpload.updateProgress(itemId, percent, evt.loaded);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  resolve(JSON.parse(xhr.responseText));
                } catch {
                  reject(new Error("Invalid JSON response"));
                }
              } else {
                try {
                  const res = JSON.parse(xhr.responseText);
                  reject(new Error(res.error || `Upload failed (${xhr.status})`));
                } catch {
                  reject(new Error(`Upload failed (${xhr.status})`));
                }
              }
            };

            xhr.onerror = () => reject(new Error("Network upload error"));
            xhr.send(file);
          });

          localUpload.completeItem(itemId);

          const created = await createDriveAssetAction({
            title: file.name,
            type: category,
            urlOrPath: fileData.url,
            tags: "",
            sizeBytes: fileData.size || file.size,
            syncStatus: "LOCAL_UNSYNCED",
            projectId: project.id,
            phaseId: uploadPhaseId || null,
            docVersion: "v1.0",
            docStatus: "DRAFT",
          });

          const assetObj: Asset = {
            id: created.id || Date.now() + index,
            title: file.name,
            type: category,
            urlOrPath: fileData.url,
            thumbnailUrl: null,
            tags: "",
            sizeBytes: fileData.size || file.size,
            syncStatus: "LOCAL_UNSYNCED",
            gdriveId: null,
            projectId: project.id,
            phaseId: uploadPhaseId || null,
            docVersion: "v1.0",
            docStatus: "DRAFT",
            createdAt: new Date(),
          } as any;
          createdAssets.push(assetObj);

          if (uploadMode === "auto_sync") {
            queuedItems.push({
              id: `asset-${created.id || Date.now()}-${Math.random()}`,
              assetId: created.id,
              name: file.name,
              size: fileData.size || file.size,
              localPath: fileData.url,
              file: file,
              folderId: selectedFolderId,
              folderName: selectedFolderName,
              targetSyncStatus: "SYNCED_LOCAL_KEPT",
            });
          }
        } catch (fileErr: any) {
          localUpload.errorItem(itemId, fileErr.message);
          console.error(`Error uploading file ${file.name}:`, fileErr);
        }
      }

      if (createdAssets.length > 0) {
        setAssetList((prev) => [...createdAssets, ...prev]);
      }

      if ((uploadMode === "auto_sync" || uploadMode === "drive_only") && queuedItems.length > 0) {
        if (uploadMode === "auto_sync") localUpload.clearCompleted();
        addToQueue(queuedItems);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  // Sync Single Document to Google Drive
  const handleSyncDoc = (asset: Asset) => {
    if (asset.syncStatus === "CLOUD_ONLY") return;
    if (asset.syncStatus === "SYNCED_LOCAL_KEPT" || asset.gdriveId) return;

    addToQueue([
      {
        id: `asset-${asset.id}`,
        assetId: asset.id,
        name: asset.title,
        size: asset.sizeBytes || 0,
        localPath: asset.urlOrPath,
        folderId: selectedFolderId,
        folderName: selectedFolderName,
      },
    ]);
  };

  // Sync Selected Documents in Bulk
  const handleSyncSelected = () => {
    if (selectedDocIds.length === 0) return;
    const selected = documentList.filter((a) => selectedDocIds.includes(a.id));
    const unsyncedOnly = selected.filter(
      (a) => a.syncStatus !== "CLOUD_ONLY" && a.syncStatus !== "SYNCED_LOCAL_KEPT" && !a.gdriveId
    );

    if (unsyncedOnly.length === 0) {
      setSelectedDocIds([]);
      return;
    }

    const items = unsyncedOnly.map((asset) => ({
      id: `asset-${asset.id}`,
      assetId: asset.id,
      name: asset.title,
      size: asset.sizeBytes || 0,
      localPath: asset.urlOrPath,
      folderId: selectedFolderId,
      folderName: selectedFolderName,
    }));

    addToQueue(items);
    setSelectedDocIds([]);
  };

  // Delete Document Confirmed
  const handleDeleteAssetConfirmed = () => {
    if (!deletingAssetConfirm) return;
    const id = deletingAssetConfirm.id;
    setAssetList((prev) => prev.filter((a) => a.id !== id));
    setSelectedDocIds((prev) => prev.filter((i) => i !== id));
    startTransition(async () => {
      await deleteDriveAssetAction(id);
      setDeletingAssetConfirm(null);
    });
  };

  // Filtered Project Documents (files)
  const filteredAssets = useMemo(() => {
    return documentList.filter((asset) => {
      const matchSearch =
        searchDocQuery === "" ||
        asset.title.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
        (asset.tags && asset.tags.toLowerCase().includes(searchDocQuery.toLowerCase()));

      if (!matchSearch) return false;

      const isSynced = asset.syncStatus === "SYNCED_LOCAL_KEPT" || !!asset.gdriveId;
      if (docFilter === "synced" && !isSynced) return false;
      if (docFilter === "unsynced" && isSynced) return false;

      if (docPhaseFilter !== "all") {
        if (docPhaseFilter === "none" && asset.phaseId) return false;
        if (docPhaseFilter !== "none" && asset.phaseId?.toString() !== docPhaseFilter) return false;
      }

      return true;
    });
  }, [documentList, searchDocQuery, docFilter, docPhaseFilter]);

  const syncedCount = useMemo(() => documentList.filter((a) => a.syncStatus === "SYNCED_LOCAL_KEPT" || !!a.gdriveId).length, [documentList]);
  const unsyncedCount = useMemo(() => documentList.filter((a) => a.syncStatus !== "SYNCED_LOCAL_KEPT" && !a.gdriveId).length, [documentList]);

  const isAllSelected = filteredAssets.length > 0 && filteredAssets.every((a) => selectedDocIds.includes(a.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredAssets.map((a) => a.id));
    }
  };

  const toggleSelectDoc = (id: number) => {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // ── LINKS TAB: ASSET VAULT EXACT BEHAVIOR & ACTIONS ───────────────────────
  const [searchLinkQuery, setSearchLinkQuery] = useState("");
  const [linkPhaseFilter, setLinkPhaseFilter] = useState<string>("all");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Asset | null>(null);

  const [linkForm, setLinkForm] = useState({
    title: "",
    url: "",
    thumbnailUrl: "",
    tags: "",
    phaseId: null as number | null,
  });

  const openAddLinkModal = (prefillPhaseId?: number | null) => {
    setLinkForm({
      title: "",
      url: "",
      thumbnailUrl: "",
      tags: "",
      phaseId: prefillPhaseId ?? null,
    });
    setEditingLink(null);
    setIsLinkDialogOpen(true);
  };

  const openEditLinkModal = (asset: Asset) => {
    setLinkForm({
      title: asset.title,
      url: asset.urlOrPath,
      thumbnailUrl: asset.thumbnailUrl || "",
      tags: asset.tags || "",
      phaseId: asset.phaseId || null,
    });
    setEditingLink(asset);
    setIsLinkDialogOpen(true);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.title.trim() || !linkForm.url.trim()) return;

    startTransition(async () => {
      if (editingLink) {
        const res = await updateAssetAction(editingLink.id, {
          title: linkForm.title.trim(),
          urlOrPath: linkForm.url.trim(),
          thumbnailUrl: linkForm.thumbnailUrl.trim() || undefined,
          tags: linkForm.tags.trim(),
          projectId: project.id,
          phaseId: linkForm.phaseId,
        });

        setAssetList((prev) =>
          prev.map((a) =>
            a.id === editingLink.id
              ? {
                  ...a,
                  title: linkForm.title.trim(),
                  urlOrPath: linkForm.url.trim(),
                  thumbnailUrl: res.thumbnailUrl || linkForm.thumbnailUrl.trim() || a.thumbnailUrl,
                  tags: linkForm.tags.trim(),
                  phaseId: linkForm.phaseId,
                }
              : a
          )
        );
      } else {
        const res = await createAssetAction({
          title: linkForm.title.trim(),
          urlOrPath: linkForm.url.trim(),
          thumbnailUrl: linkForm.thumbnailUrl.trim() || undefined,
          tags: linkForm.tags.trim(),
          projectId: project.id,
          phaseId: linkForm.phaseId,
        });

        const newLinkObj: Asset = {
          id: (res as any).id || Date.now(),
          title: linkForm.title.trim(),
          type: "link",
          urlOrPath: linkForm.url.trim(),
          thumbnailUrl: res.thumbnailUrl || linkForm.thumbnailUrl.trim() || null,
          tags: linkForm.tags.trim(),
          sizeBytes: null,
          syncStatus: "LOCAL_UNSYNCED",
          gdriveId: null,
          projectId: project.id,
          phaseId: linkForm.phaseId,
          docVersion: null,
          docStatus: null,
          createdAt: new Date(),
        } as any;

        setAssetList((prev) => [newLinkObj, ...prev]);
      }
      setIsLinkDialogOpen(false);
    });
  };

  const handleDeleteLinkConfirmed = () => {
    if (!deletingLinkConfirm) return;
    const id = deletingLinkConfirm.id;
    setAssetList((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await deleteAssetAction(id);
      setDeletingLinkConfirm(null);
    });
  };

  // Filtered Project Links
  const filteredLinks = useMemo(() => {
    return linkList.filter((link) => {
      const matchSearch =
        searchLinkQuery === "" ||
        link.title.toLowerCase().includes(searchLinkQuery.toLowerCase()) ||
        link.urlOrPath.toLowerCase().includes(searchLinkQuery.toLowerCase()) ||
        (link.tags && link.tags.toLowerCase().includes(searchLinkQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (linkPhaseFilter !== "all") {
        if (linkPhaseFilter === "none" && link.phaseId) return false;
        if (linkPhaseFilter !== "none" && link.phaseId?.toString() !== linkPhaseFilter) return false;
      }

      return true;
    });
  }, [linkList, searchLinkQuery, linkPhaseFilter]);

  const autoStatusInfo = useMemo(() => {
    return computeProjectAutoStatus(project, phasesWithTaskProgress, initialTasks);
  }, [project, phasesWithTaskProgress, initialTasks]);

  const cfg = STATUS_CFG[autoStatusInfo.status] ?? STATUS_CFG.PLANNING;

  const editingPhaseMeta = phaseDialog.editing
    ? phasesWithTaskProgress.find((p) => p.id === phaseDialog.editing!.id)
    : null;

  return (
    <div className="space-y-5">
      {/* Project Meta Bar */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03]">
        {/* Optional Cover Banner Background */}
        {project.coverUrl && (
          <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
            <img
              src={project.coverUrl}
              alt={project.name}
              className="w-full h-full object-cover opacity-20 blur-[2px] scale-105"
              onError={(e) => ((e.target as HTMLElement).style.display = "none")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d15] via-[#0d0d15]/80 to-transparent" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/projects"
                prefetch={false}
                className="p-2 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                title="Back to Project Hub"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <ProjectIconDisplay
                icon={project.icon}
                className="w-9 h-9 rounded-2xl"
                imageClassName="w-full h-full object-cover rounded-xl"
              />
              <h2 className="text-xl font-bold text-white font-mono">{project.name}</h2>
              <Badge className={`border text-[10px] px-2.5 py-1 flex items-center gap-1.5 font-mono ${cfg.color}`} title={autoStatusInfo.reason}>
                {cfg.icon}
                <span>{cfg.label}</span>
              </Badge>
              <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-500/10 text-[10px] font-mono">
                Project Hub
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed font-sans">{project.description}</p>
            )}
            {(project.startDate || project.targetDate) && (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {formatDate(project.startDate as string | null) ?? "—"} &rarr;{" "}
                  {formatDate(project.targetDate as string | null) ?? "TBD"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => {
                setProjectForm({
                  name: project.name,
                  description: project.description || "",
                  icon: (project as any).icon || "🎯",
                  coverUrl: (project as any).coverUrl || "",
                  status: project.status || "PLANNING",
                  startDate: project.startDate ? String(project.startDate).split("T")[0] : "",
                  targetDate: project.targetDate ? String(project.targetDate).split("T")[0] : "",
                });
                setEditIconMode("presets");
                setIsProjectSettingsOpen(true);
              }}
              variant="outline"
              className="border-white/15 text-slate-300 hover:bg-white/10 text-xs font-mono rounded-2xl h-10 px-4 gap-2 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Project Settings</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs: Roadmap -> Scoped Kanban -> Documents -> Links */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white/[0.03] border border-white/10 p-1 h-auto rounded-2xl">
          <TabsTrigger value="roadmap" className="font-mono text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl px-4 py-2 gap-2">
            <Layers className="w-3.5 h-3.5" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="kanban" className="font-mono text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl px-4 py-2 gap-2">
            <CheckSquare className="w-3.5 h-3.5" />
            Scoped Kanban
          </TabsTrigger>
          <TabsTrigger value="documents" className="font-mono text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl px-4 py-2 gap-2">
            <FileText className="w-3.5 h-3.5" />
            Documents ({documentList.length})
          </TabsTrigger>
          <TabsTrigger value="links" className="font-mono text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl px-4 py-2 gap-2">
            <Link2 className="w-3.5 h-3.5" />
            Links ({linkList.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: ROADMAP ─────────────────────────────────────────── */}
        <TabsContent value="roadmap" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-wider">Phase Roadmap</h3>
            <Button
              size="sm"
              onClick={openAddPhase}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-9 px-4 gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
              disabled={isPending}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Phase
            </Button>
          </div>

          {/* Interactive Gantt Chart with Auto-Progress & Drag / Resize */}
          <ProjectGantt
            project={project}
            phases={phasesWithTaskProgress}
            onPhaseUpdate={handlePhaseUpdate}
            onPhaseSelect={handlePhaseSelect}
          />

          {/* Phase Cards Breakdown with Interactive Accordion for Linked Tasks, Docs, Links */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Phases Breakdown &amp; Linked Assets</h4>
              <span className="text-[11px] font-mono text-slate-500">Click card or Gantt bar to expand tasks, docs, and links</span>
            </div>

            {phasesWithTaskProgress.map((phase, idx) => {
              const pal = getPaletteForTitle(phase.title, idx);
              const progress = phase.progress ?? 0;
              const dependsOnPhase = (phase as any).dependsOnPhaseId
                ? phases.find((p) => p.id === (phase as any).dependsOnPhaseId)
                : null;

              const isExpanded = expandedPhaseIds.includes(phase.id);
              const isHighlighted = highlightedPhaseId === phase.id;
              const phaseTasks = initialTasks.filter((t) => t.phaseId === phase.id);
              const phaseDocs = documentList.filter((d) => d.phaseId === phase.id);
              const phaseLinks = linkList.filter((l) => l.phaseId === phase.id);

              return (
                <div
                  key={phase.id}
                  id={`phase-card-${phase.id}`}
                  className={cn(
                    `rounded-2xl border ${pal.border} ${pal.bg} transition-all duration-300 overflow-hidden shadow-md`,
                    isHighlighted && "ring-2 ring-indigo-400 shadow-2xl shadow-indigo-500/30 scale-[1.008]"
                  )}
                >
                  {/* Clickable Header Row */}
                  <div
                    onClick={() => toggleExpandPhase(phase.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandPhase(phase.id);
                        }}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                      >
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-300 ease-in-out", isExpanded && "rotate-180")} />
                      </button>

                      <div
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: pal.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-white font-mono font-bold truncate">{phase.title}</p>
                          <Badge className={`border text-[9px] font-mono font-medium ${pal.bg} ${pal.border} ${pal.text}`}>
                            {formatStatusLabel(phase.status)}
                          </Badge>
                          {phase.isAutoCalculated && (
                            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[9px] font-mono flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                              <span>{phase.doneTaskCount}/{phase.taskCount} tasks done</span>
                            </Badge>
                          )}
                          {dependsOnPhase && (
                            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[9px] font-mono flex items-center gap-1">
                              <Link2 className="w-2.5 h-2.5" />
                              <span>Depends on: {dependsOnPhase.title}</span>
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono mt-1">
                          <span>{formatDate(phase.startDate)} &rarr; {formatDate(phase.endDate)}</span>
                          <span>•</span>
                          <span className="text-slate-300 font-semibold">{progress}% progress</span>
                          <span>•</span>
                          <span className="text-indigo-300 text-[11px]">
                            {phaseTasks.length} tasks • {phaseDocs.length} docs • {phaseLinks.length} links
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar and action buttons */}
                    <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="w-28 hidden md:block">
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${progress}%`, backgroundColor: pal.hex }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPhaseForm({
                            title: phase.title,
                            description: (phase as any).description || "",
                            startDate: String(phase.startDate).split("T")[0],
                            endDate: String(phase.endDate).split("T")[0],
                            status: phase.status,
                            progress: phase.progress ?? 0,
                            dependsOnPhaseId: (phase as any).dependsOnPhaseId ?? null,
                          });
                          setPhaseDialog({ open: true, editing: phase });
                        }}
                        className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
                        title="Edit Phase"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingPhaseConfirm(phase)}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-xl hover:bg-red-500/10 cursor-pointer"
                        disabled={isPending}
                        title="Delete Phase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Content Panel with Smooth CSS Grid Height Transition */}
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-in-out",
                      isExpanded
                        ? "grid-rows-[1fr] opacity-100 border-t border-white/10"
                        : "grid-rows-[0fr] opacity-0 border-t-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="p-4 pt-3 bg-[#0d0d15]/80 space-y-3.5 font-mono text-xs">
                        {/* Phase Description (If available) */}
                        {phase.description && (
                          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
                                Phase Objective &amp; Scope
                              </span>
                              <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                                {phase.description}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* 1. Tasks in Phase */}
                          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex items-center gap-1.5 font-bold text-white">
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Tasks ({phaseTasks.length})</span>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveTab("kanban");
                                }}
                                className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>View in Kanban</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            {phaseTasks.length === 0 ? (
                              <div className="text-center py-4 text-slate-500 text-[11px]">
                                No tasks assigned to this phase.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {phaseTasks.map((t) => (
                                  <div
                                    key={t.id}
                                    onClick={() => setActiveTab("kanban")}
                                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span
                                        className={cn(
                                          "w-2 h-2 rounded-full shrink-0",
                                          t.status === "done"
                                            ? "bg-emerald-400"
                                            : t.status === "in_progress"
                                            ? "bg-amber-400"
                                            : "bg-blue-400"
                                        )}
                                      />
                                      <span className="truncate text-white text-[11px] font-medium">{t.title}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] uppercase border-white/10 text-slate-400 shrink-0">
                                      {t.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. Documents in Phase */}
                          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex items-center gap-1.5 font-bold text-white">
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>Documents ({phaseDocs.length})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenUploadModal(phase.id)}
                                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Upload</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDocPhaseFilter(phase.id.toString());
                                    setActiveTab("documents");
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Filter Tab</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            {phaseDocs.length === 0 ? (
                              <div className="text-center py-4 text-slate-500 text-[11px]">
                                No documents assigned to this phase.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {phaseDocs.map((doc) => {
                                  const ext = getFileExtension(doc.title, doc.urlOrPath);
                                  return (
                                    <div
                                      key={doc.id}
                                      onClick={() => openAssetPreview(doc)}
                                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 cursor-pointer transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                        <span className="truncate text-white text-[11px]">{doc.title}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(doc.sizeBytes)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 3. Links in Phase */}
                          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex items-center gap-1.5 font-bold text-white">
                                <Link2 className="w-3.5 h-3.5 text-pink-400" />
                                <span>Links ({phaseLinks.length})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openAddLinkModal(phase.id)}
                                  className="text-[10px] text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Register</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setLinkPhaseFilter(phase.id.toString());
                                    setActiveTab("links");
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Filter Tab</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            {phaseLinks.length === 0 ? (
                              <div className="text-center py-4 text-slate-500 text-[11px]">
                                No links assigned to this phase.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {phaseLinks.map((link) => {
                                  const domain = getDomainFromUrl(link.urlOrPath);
                                  return (
                                    <a
                                      key={link.id}
                                      href={link.urlOrPath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Globe className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                                        <span className="truncate text-white text-[11px] font-medium">{link.title}</span>
                                      </div>
                                      <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── TAB 2: SCOPED KANBAN ────────────────────────────────────── */}
        <TabsContent value="kanban" className="space-y-4">
          <KanbanBoard
            initialTasks={initialTasks}
            initialProjects={allProjects.length > 0 ? allProjects : [project]}
            initialPhases={phases}
            initialAssets={allAssets.length > 0 ? allAssets : assetList}
            initialNotes={allNotes}
            lockedProjectId={project.id}
          />
        </TabsContent>

        {/* ── TAB 3: DOCUMENTS (WITH PHASE FILTER & EDIT MODAL) ────────── */}
        <TabsContent value="documents" className="space-y-4">
          {/* Toolbar: Filters & Upload Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-3xl bg-white/[0.03] border border-white/10">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchDocQuery}
                onChange={(e) => setSearchDocQuery(e.target.value)}
                placeholder="Search project documents..."
                className="pl-9 bg-white/[0.04] border-white/10 text-xs text-white rounded-2xl h-11 font-mono focus:border-indigo-500 placeholder:text-slate-500"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Phase Filter Dropdown */}
              {phases.length > 0 && (
                <Select
                  value={docPhaseFilter}
                  onValueChange={(val: any) => setDocPhaseFilter(val || "all")}
                >
                  <SelectTrigger className="w-48 bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3.5 font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">
                        {docPhaseFilter === "all"
                          ? "All Phases"
                          : docPhaseFilter === "none"
                          ? "No Phase"
                          : phases.find((p) => p.id.toString() === docPhaseFilter)?.title || "Phase"}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 min-w-[220px] font-mono">
                    <SelectItem value="all" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                      <div className="flex items-center gap-1.5 min-w-0 pr-4">
                        <span className="truncate">All Phases</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">({documentList.length})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="none" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                      <div className="flex items-center gap-1.5 min-w-0 pr-4">
                        <span className="truncate">No Phase</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">({documentList.filter((d) => !d.phaseId).length})</span>
                      </div>
                    </SelectItem>
                    {phases.map((p) => {
                      const count = documentList.filter((d) => d.phaseId === p.id).length;
                      return (
                        <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                          <div className="flex items-center gap-1.5 min-w-0 pr-4">
                            <span className="truncate">{p.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">({count})</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              {/* Sync Status Filter Pills */}
              <button
                type="button"
                onClick={() => setDocFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer",
                  docFilter === "all"
                    ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                    : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
                )}
              >
                All ({documentList.length})
              </button>
              <button
                type="button"
                onClick={() => setDocFilter("synced")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
                  docFilter === "synced"
                    ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30"
                    : "bg-white/5 border border-white/10 text-emerald-400 hover:bg-emerald-500/10"
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Synced ({syncedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setDocFilter("unsynced")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5",
                  docFilter === "unsynced"
                    ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30"
                    : "bg-white/5 border border-white/10 text-amber-400 hover:bg-amber-500/10"
                )}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Unsynced ({unsyncedCount})</span>
              </button>

              {/* Upload Button */}
              <Button
                size="sm"
                onClick={() => handleOpenUploadModal()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-4 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer ml-auto md:ml-2"
              >
                <UploadCloud className="w-4 h-4" />
                Upload File
              </Button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedDocIds.length > 0 && filteredAssets.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-white shadow-2xl backdrop-blur-xl font-mono text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2.5">
                <CustomCheckbox
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
                <span className="font-bold">
                  {selectedDocIds.length} of {filteredAssets.length} file(s) selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleSyncSelected}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-8 px-3 font-mono text-xs gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Sync Selected</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDocIds([])}
                  className="border-white/10 hover:bg-white/10 text-slate-300 rounded-xl h-8 px-2.5 font-mono text-xs cursor-pointer"
                >
                  Deselect
                </Button>
              </div>
            </div>
          )}

          {/* Documents Table List */}
          {filteredAssets.length === 0 ? (
            <div className="text-center py-16 rounded-3xl border border-white/10 bg-white/[0.02]">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-mono text-sm font-bold">
                {searchDocQuery ? "No matching project documents" : "No documents in this project"}
              </p>
              <p className="text-slate-600 text-xs mt-1 font-mono">
                {searchDocQuery
                  ? `No files match "${searchDocQuery}".`
                  : "Upload project specifications, contracts, and media assets to get started."}
              </p>
              {!searchDocQuery && (
                <Button
                  size="sm"
                  onClick={() => handleOpenUploadModal()}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload File
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-xl font-mono text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-300">
                  <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-3 pl-4 w-10 text-center">
                        <CustomCheckbox
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-3">Asset Title</th>
                      <th className="p-3">Phase Link</th>
                      <th className="p-3">Version &amp; Status</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Sync Status</th>
                      <th className="p-3">Added</th>
                      <th className="p-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAssets.map((asset) => {
                      const ext = getFileExtension(asset.title, asset.urlOrPath);
                      const isSelected = selectedDocIds.includes(asset.id);
                      const isSynced = asset.syncStatus === "SYNCED_LOCAL_KEPT" || !!asset.gdriveId;
                      const isGhost = asset.syncStatus === "CLOUD_ONLY";
                      const phaseObj = asset.phaseId ? phases.find((p) => p.id === asset.phaseId) : null;

                      return (
                        <tr
                          key={asset.id}
                          className={cn(
                            "hover:bg-white/[0.02] transition-colors",
                            isSelected && "bg-indigo-950/20"
                          )}
                        >
                          <td className="p-3 pl-4 text-center">
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelectDoc(asset.id)}
                            />
                          </td>
                          <td className="p-3 font-semibold text-white">
                            <div className="flex items-center gap-2.5">
                              {(() => {
                                const isImg = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(ext) || asset.type === "image";
                                const mediaUrl = asset.syncStatus === "CLOUD_ONLY" && asset.gdriveId
                                  ? `/api/drive/preview/${asset.gdriveId}`
                                  : (asset.thumbnailUrl || asset.urlOrPath);
                                return isImg ? (
                                  <div
                                    className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-black shrink-0 cursor-pointer shadow-sm"
                                    onClick={() => openAssetPreview(asset)}
                                  >
                                    <img
                                      src={mediaUrl}
                                      alt={asset.title}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  </div>
                                ) : (
                                  getRichFileIcon(ext)
                                );
                              })()}
                              <span
                                className="truncate max-w-xs sm:max-w-md cursor-pointer hover:text-indigo-300 transition-colors font-mono"
                                onClick={() => openAssetPreview(asset)}
                                title="Click to Preview"
                              >
                                {asset.title}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            {phaseObj ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-purple-500/40 text-purple-300 bg-purple-500/10 gap-1 font-mono"
                              >
                                <Layers className="w-2.5 h-2.5 text-purple-400" />
                                <span className="truncate max-w-[140px]">{phaseObj.title}</span>
                              </Badge>
                            ) : (
                              <span className="text-slate-500 text-[10px] italic">General Doc</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[9px] border-white/15 text-slate-300 bg-white/5 font-mono px-1.5 py-0"
                              >
                                {asset.docVersion || "v1.0"}
                              </Badge>
                              {asset.docStatus && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] font-mono px-1.5 py-0",
                                    asset.docStatus === "FINAL"
                                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                      : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                                  )}
                                >
                                  {asset.docStatus}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-400">{formatBytes(asset.sizeBytes)}</td>
                          <td className="p-3">
                            {isSynced ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10 gap-1 font-mono"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Synced</span>
                              </Badge>
                            ) : isGhost ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-cyan-500/40 text-cyan-400 bg-cyan-500/10 gap-1 font-mono"
                              >
                                <Cloud className="w-3 h-3" />
                                <span>Cloud Only</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/10 gap-1 font-mono"
                              >
                                <HardDrive className="w-3 h-3" />
                                <span>Local Only</span>
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{formatDate(asset.createdAt)}</td>
                          <td className="p-3 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openAssetPreview(asset)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                title="Preview"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditDocumentModal(asset)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                title="Edit Document Metadata & Phase"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                              {asset.gdriveId && (
                                <a
                                  href={`https://drive.google.com/file/d/${asset.gdriveId}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-blue-400 hover:text-blue-300 transition-colors"
                                  title="View on Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!isGhost && (
                                <a
                                  href={asset.urlOrPath}
                                  download
                                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!isGhost && !isSynced && (
                                <Button
                                  size="xs"
                                  onClick={() => handleSyncDoc(asset)}
                                  className="rounded-xl h-7 px-2.5 font-mono text-[10px] gap-1 cursor-pointer transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 font-semibold"
                                  title={`Sync to Google Drive (${selectedFolderName})`}
                                >
                                  <UploadCloud className="w-3 h-3" />
                                  <span>Sync</span>
                                </Button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeletingAssetConfirm(asset)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Delete Document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 4: LINKS (WITH PHASE FILTER & MODAL) ──────────────── */}
        <TabsContent value="links" className="space-y-4">
          {/* Toolbar: Search + Phase Filter + Register Link Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-3xl bg-white/[0.03] border border-white/10">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchLinkQuery}
                onChange={(e) => setSearchLinkQuery(e.target.value)}
                placeholder="Search bookmarks, resources, or tags..."
                className="pl-9 bg-white/[0.04] border-white/10 text-xs text-white rounded-2xl h-11 font-mono focus:border-indigo-500 placeholder:text-slate-500"
              />
            </div>

            {/* Phase Filter Dropdown */}
            {phases.length > 0 && (
              <Select
                value={linkPhaseFilter}
                onValueChange={(val: any) => setLinkPhaseFilter(val || "all")}
              >
                <SelectTrigger className="w-48 bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-3.5 font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">
                      {linkPhaseFilter === "all"
                        ? "All Phases"
                        : linkPhaseFilter === "none"
                        ? "No Phase"
                        : phases.find((p) => p.id.toString() === linkPhaseFilter)?.title || "Phase"}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 min-w-[220px] font-mono">
                  <SelectItem value="all" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                    <div className="flex items-center gap-1.5 min-w-0 pr-4">
                      <span className="truncate">All Phases</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">({linkList.length})</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="none" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                    <div className="flex items-center gap-1.5 min-w-0 pr-4">
                      <span className="truncate">No Phase</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">({linkList.filter((l) => !l.phaseId).length})</span>
                    </div>
                  </SelectItem>
                  {phases.map((p) => {
                    const count = linkList.filter((l) => l.phaseId === p.id).length;
                    return (
                      <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                        <div className="flex items-center gap-1.5 min-w-0 pr-4">
                          <span className="truncate">{p.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">({count})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {/* Register Link Button */}
            <Button
              size="sm"
              onClick={() => openAddLinkModal()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-4 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer ml-auto md:ml-2"
            >
              <Plus className="w-4 h-4" />
              Register Link
            </Button>
          </div>

          {/* Asset Vault Card Grid */}
          {filteredLinks.length === 0 ? (
            <div className="text-center py-16 rounded-3xl border border-white/10 bg-white/[0.02]">
              <Link2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-mono text-sm font-bold">
                {searchLinkQuery ? "No matching project links" : "No project links registered"}
              </p>
              <p className="text-slate-600 text-xs mt-1 font-mono">
                {searchLinkQuery
                  ? `No links match "${searchLinkQuery}".`
                  : "Save references to Figma designs, GitHub PRs, Miro boards, and external specifications."}
              </p>
              {!searchLinkQuery && (
                <Button
                  size="sm"
                  onClick={() => openAddLinkModal()}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Register Link
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLinks.map((link) => {
                const tagList = link.tags ? link.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
                const domain = getDomainFromUrl(link.urlOrPath);
                const resolvedThumbnail = link.thumbnailUrl || extractYouTubeThumbnail(link.urlOrPath);
                const phaseObj = link.phaseId ? phases.find((p) => p.id === link.phaseId) : null;

                return (
                  <div
                    key={link.id}
                    className="p-4 rounded-3xl flex flex-col justify-between relative group border border-white/10 hover:border-indigo-500/40 transition-all shadow-md overflow-hidden bg-white/[0.02] hover:bg-white/[0.04]"
                  >
                    <div>
                      {/* Thumbnail Header Area */}
                      <div className="relative w-full h-36 rounded-2xl bg-black/40 overflow-hidden mb-3.5 border border-white/10 flex items-center justify-center">
                        {resolvedThumbnail ? (
                          <img
                            src={resolvedThumbnail}
                            alt={link.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500">
                            <Bookmark className="w-8 h-8 text-indigo-400/60" />
                            <span className="text-[10px] font-mono text-slate-400">Web Bookmark</span>
                          </div>
                        )}

                        {/* Top Badge: BOOKMARK LINK */}
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <Badge className="bg-indigo-950/80 border-indigo-500/40 text-indigo-300 backdrop-blur-md text-[9px] font-mono px-2 py-0.5 uppercase tracking-wider">
                            BOOKMARK LINK
                          </Badge>
                        </div>
                      </div>

                      {/* Domain Header */}
                      <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-mono mb-1">
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">{domain}</span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-white font-mono leading-snug line-clamp-2 mb-2 group-hover:text-indigo-300 transition-colors">
                        {link.title}
                      </h4>

                      {/* URL Display Field */}
                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 text-[11px] text-slate-400 font-mono truncate mb-2.5">
                        {link.urlOrPath}
                      </div>

                      {/* Phase Badge if Linked */}
                      {phaseObj && (
                        <div className="mb-2.5">
                          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[9px] font-mono flex items-center gap-1 w-fit">
                            <Layers className="w-2.5 h-2.5 text-purple-400" />
                            <span>{phaseObj.title}</span>
                          </Badge>
                        </div>
                      )}

                      {/* Tags */}
                      {tagList.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-4">
                          {tagList.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-auto font-mono text-xs">
                      <a
                        href={link.urlOrPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Open Resource</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditLinkModal(link)}
                          className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Edit Link"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingLinkConfirm(link)}
                          className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── EDIT DOCUMENT METADATA MODAL ── */}
      <Dialog open={isEditDocModalOpen} onOpenChange={setIsEditDocModalOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-sm font-bold text-white font-mono flex items-center gap-2 uppercase tracking-wide">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>EDIT DOCUMENT DETAILS</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsEditDocModalOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleSaveDocEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 max-h-[60vh]">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Document Title *</label>
                <Input
                  autoFocus
                  required
                  value={editDocForm.title}
                  onChange={(e) => setEditDocForm((f) => ({ ...f, title: e.target.value }))}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                />
              </div>

              {/* Link to Phase */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Assign to Project Phase</span>
                </label>
                <Select
                  value={editDocForm.phaseId ? String(editDocForm.phaseId) : "none"}
                  onValueChange={(val: any) =>
                    setEditDocForm((f) => ({ ...f, phaseId: !val || val === "none" ? null : parseInt(val, 10) }))
                  }
                >
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500">
                    <span className="truncate">
                      {editDocForm.phaseId
                        ? phases.find((p) => p.id === editDocForm.phaseId)?.title || "Selected Phase"
                        : "None (General Project Doc)"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 min-w-[220px] font-mono">
                    <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                      None (General Project Doc)
                    </SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Version & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Doc Version</label>
                  <Input
                    placeholder="e.g. v1.0, v2.1"
                    value={editDocForm.docVersion}
                    onChange={(e) => setEditDocForm((f) => ({ ...f, docVersion: e.target.value }))}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Doc Status</label>
                  <Select
                    value={editDocForm.docStatus}
                    onValueChange={(val: any) => setEditDocForm((f) => ({ ...f, docStatus: val || "DRAFT" }))}
                  >
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500">
                      <span>{editDocForm.docStatus}</span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 font-mono">
                      <SelectItem value="DRAFT" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                        DRAFT
                      </SelectItem>
                      <SelectItem value="FINAL" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                        FINAL
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Tags (Comma-separated)</label>
                <Input
                  placeholder="e.g. legal, spec, contract"
                  value={editDocForm.tags}
                  onChange={(e) => setEditDocForm((f) => ({ ...f, tags: e.target.value }))}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDocModalOpen(false)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !editDocForm.title.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-2xl h-11 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── REGISTER / EDIT LINK MODAL (EXACT ASSET VAULT DESIGN) ── */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-sm font-bold text-white font-mono flex items-center gap-2 uppercase tracking-wide">
              <Link2 className="w-4 h-4 text-indigo-400" />
              <span>{editingLink ? "EDIT PROJECT LINK" : "REGISTER NEW PROJECT LINK"}</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsLinkDialogOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleSaveLink} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 max-h-[60vh]">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Link Title *</label>
                <Input
                  autoFocus
                  required
                  placeholder="e.g. Figma UI System & Design Tokens"
                  value={linkForm.title}
                  onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Target Website / Resource URL *</label>
                <Input
                  required
                  placeholder="e.g. https://www.figma.com/file/..."
                  value={linkForm.url}
                  onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                />
                <p className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400 inline shrink-0" />
                  <span>Auto-scrapes website OpenGraph &amp; YouTube thumbnails!</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Custom Thumbnail URL (Optional)</label>
                <Input
                  placeholder="https://images.unsplash.com/..."
                  value={linkForm.thumbnailUrl}
                  onChange={(e) => setLinkForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Tags (Comma-separated)</label>
                <Input
                  placeholder="e.g. figma, ui, design, wireframe"
                  value={linkForm.tags}
                  onChange={(e) => setLinkForm((f) => ({ ...f, tags: e.target.value }))}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                />
              </div>

              {/* Link to Phase Selector */}
              {phases.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Link to Project Phase (Optional)</span>
                  </label>
                  <Select
                    value={linkForm.phaseId ? String(linkForm.phaseId) : "none"}
                    onValueChange={(val: any) =>
                      setLinkForm((f) => ({ ...f, phaseId: !val || val === "none" ? null : parseInt(val, 10) }))
                    }
                  >
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500">
                      <span className="truncate">
                        {linkForm.phaseId
                          ? phases.find((p) => p.id === linkForm.phaseId)?.title || "Selected Phase"
                          : "None (General Project Link)"}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 min-w-[220px] font-mono">
                      <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                        None (General Project Link)
                      </SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLinkDialogOpen(false)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !linkForm.title.trim() || !linkForm.url.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-2xl h-11 shadow-lg shadow-indigo-600/30 cursor-pointer transition-all"
              >
                {isPending ? "Saving..." : editingLink ? "Save Changes" : "Save Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── STANDARD GLASSMORPHIC DELETE LINK MODAL ── */}
      {deletingLinkConfirm && (
        <Dialog open={!!deletingLinkConfirm} onOpenChange={() => setDeletingLinkConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE PROJECT LINK</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingLinkConfirm.title}&quot;</span> from this project?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This link will be permanently removed from this project and the Asset Vault. This cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingLinkConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={handleDeleteLinkConfirmed}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Link"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Project Settings Dialog ── */}
      <Dialog open={isProjectSettingsOpen} onOpenChange={setIsProjectSettingsOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-2xl max-h-[88vh] p-7 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-4 mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-mono text-white tracking-wide uppercase">
                  Project Settings
                </DialogTitle>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Update project metadata, visuals, and schedule parameters
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsProjectSettingsOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2 space-y-5 max-h-[64vh] pt-2">
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
                    onClick={() => setEditIconMode("presets")}
                    className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer ${
                      editIconMode === "presets"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Emoji Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIconMode("upload")}
                    className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      editIconMode === "upload"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <UploadCloud className="w-3 h-3" />
                    Upload Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIconMode("drive")}
                    className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer ${
                      editIconMode === "drive"
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
                ref={editIconInputRef}
                onChange={handleEditIconUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3.5 items-start">
                <div className="space-y-1.5 flex flex-col items-center">
                  <ProjectIconDisplay
                    icon={projectForm.icon}
                    className="w-16 h-16 rounded-2xl text-2xl border-white/20"
                    imageClassName="w-full h-full object-contain p-1 rounded-xl"
                  />
                  {isImageIcon(projectForm.icon) && (
                    <button
                      type="button"
                      onClick={() => setProjectForm((f) => ({ ...f, icon: "🎯" }))}
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
                      value={projectForm.name}
                      onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
                      className="bg-white/[0.04] border-white/15 text-sm text-white font-mono rounded-2xl h-11 px-4 focus:border-indigo-500"
                    />
                  </div>

                  {editIconMode === "presets" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {["🎯", "🚀", "💻", "⚡", "📱", "🎨", "🌐", "💼", "📊", "💡", "🛠️", "🔥"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setProjectForm((f) => ({ ...f, icon: emoji }))}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                              projectForm.icon === emoji
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

                  {editIconMode === "upload" && (
                    <button
                      type="button"
                      onClick={() => editIconInputRef.current?.click()}
                      disabled={isUploadingEditIcon}
                      className="w-full py-2.5 px-3 border border-dashed border-white/20 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-indigo-500/5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-mono text-slate-300"
                    >
                      {isUploadingEditIcon ? (
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

                  {editIconMode === "drive" && (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {allAssets.filter(isAssetImage).length === 0 ? (
                        <span className="text-[10px] font-mono text-slate-500">No image assets found.</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {allAssets
                            .filter(isAssetImage)
                            .map((asset: any) => {
                              const assetUrl = resolveAssetMediaUrl(asset);
                              return (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => setProjectForm((f) => ({ ...f, icon: assetUrl }))}
                                  className={`w-7 h-7 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                    projectForm.icon === assetUrl ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-white/10"
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
                  onClick={() => setEditCoverSourceTab("upload")}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                    editCoverSourceTab === "upload"
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Upload Local
                </button>
                <button
                  type="button"
                  onClick={() => setEditCoverSourceTab("drive")}
                  className={`py-1.5 rounded-xl transition-all font-bold cursor-pointer ${
                    editCoverSourceTab === "drive"
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  From Drive / Assets ({allAssets.filter(isAssetImage).length})
                </button>
                <button
                  type="button"
                  onClick={() => setEditCoverSourceTab("url")}
                  className={`py-1.5 rounded-xl transition-all font-bold cursor-pointer ${
                    editCoverSourceTab === "url"
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Direct URL
                </button>
              </div>

              {/* Upload Local Dropzone */}
              {editCoverSourceTab === "upload" && (
                <div>
                  <input
                    type="file"
                    ref={coverInputRef}
                    onChange={handleEditCoverUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingEditCover}
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full py-5 px-4 rounded-2xl border border-dashed border-white/20 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-white/[0.04] group-hover:bg-indigo-500/20 border border-white/10 group-hover:border-indigo-500/30 flex items-center justify-center transition-colors">
                      {isUploadingEditCover ? (
                        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white block">
                        {isUploadingEditCover ? "Uploading & Saving..." : "Click to browse and upload image from your computer"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        File will be saved to local media storage and indexed in Drive Vault
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {editCoverSourceTab === "drive" && (
                <div className="space-y-2">
                  {allAssets.filter(isAssetImage).length === 0 ? (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-500 font-mono">
                      No image assets found in Drive / Asset Vault. You can upload a local image or paste a URL.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-1">
                      {allAssets
                        .filter(isAssetImage)
                        .map((asset: any) => {
                          const assetUrl = resolveAssetMediaUrl(asset);
                          const isSelected = projectForm.coverUrl === assetUrl;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => setProjectForm((f) => ({ ...f, coverUrl: assetUrl }))}
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

              {editCoverSourceTab === "url" && (
                <div className="space-y-2">
                  <Input
                    placeholder="https://images.unsplash.com/... or image URL"
                    value={projectForm.coverUrl}
                    onChange={(e) => setProjectForm((f) => ({ ...f, coverUrl: e.target.value }))}
                    className="bg-white/[0.04] border-white/15 text-xs text-white font-mono rounded-2xl h-11 px-4 focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Live Preview Box with Remove Action */}
              {projectForm.coverUrl && (
                <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-indigo-500/30 group mt-2">
                  <img
                    src={projectForm.coverUrl}
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
                      onClick={() => setProjectForm((f) => ({ ...f, coverUrl: "" }))}
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
                value={projectForm.description}
                onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
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
                  value={projectForm.startDate}
                  onChange={(val) => setProjectForm((f) => ({ ...f, startDate: val }))}
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
                  value={projectForm.targetDate}
                  onChange={(val) => setProjectForm((f) => ({ ...f, targetDate: val }))}
                  placeholder="Select target date..."
                  accentColor="purple"
                />
              </div>
            </div>

            {/* Danger Zone: Delete Project Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDeletingProjectConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Delete This Project</span>
              </button>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t border-white/10 mt-3 flex items-center">
            <Button
              onClick={handleSaveProjectSettings}
              disabled={isPending || !projectForm.name.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-xs font-bold rounded-2xl h-12 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <span>Save Changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Phase Dialog ── */}
      <Dialog open={phaseDialog.open} onOpenChange={(v) => setPhaseDialog({ open: v })}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl max-h-[85vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                <Layers className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm font-bold font-mono text-white tracking-wide uppercase">
                {phaseDialog.editing ? "Edit Phase" : "Add Phase"}
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => setPhaseDialog({ open: false })}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 max-h-[60vh] pt-3">
            {/* Auto-Sync Indicator if tasks exist */}
            {editingPhaseMeta && editingPhaseMeta.isAutoCalculated && (
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Auto-Synced with Scoped Kanban</span>
                </div>
                <p className="text-[10px] text-slate-300">
                  This phase currently has {editingPhaseMeta.taskCount} task(s) ({editingPhaseMeta.doneTaskCount} Done • {editingPhaseMeta.progress}%). Status &amp; Progress sync automatically when tasks move on the board.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Phase Title *</label>
              <Input
                required
                autoFocus
                value={phaseForm.title}
                onChange={(e) => setPhaseForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Phase 1: Legalities & Foundations"
                className="bg-white/[0.04] border-white/15 text-xs text-white font-mono rounded-2xl h-11 px-4 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300">Phase Objective / Description</label>
                <span className="text-[10px] font-mono text-slate-500">Optional</span>
              </div>
              <textarea
                value={phaseForm.description}
                onChange={(e) => setPhaseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Key outcomes, deliverables, or scope details for this phase..."
                rows={3}
                className="w-full bg-white/[0.04] border border-white/15 text-xs text-white font-mono rounded-2xl p-3 focus:outline-none focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-500 min-h-[85px] leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>START DATE *</span>
                </label>
                <GlassDatePicker
                  value={phaseForm.startDate}
                  onChange={(val) => {
                    setPhaseForm((f) => {
                      let newEnd = f.endDate;
                      if (val && f.endDate && val > f.endDate) {
                        newEnd = val;
                      }
                      return { ...f, startDate: val, endDate: newEnd };
                    });
                  }}
                  placeholder="Select start..."
                  accentColor="indigo"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>END DATE *</span>
                </label>
                <GlassDatePicker
                  value={phaseForm.endDate}
                  onChange={(val) => setPhaseForm((f) => ({ ...f, endDate: val }))}
                  minDate={phaseForm.startDate || undefined}
                  placeholder="Select end..."
                  accentColor="purple"
                />
              </div>
            </div>

            {/* Predecessor / Dependency Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>DEPENDS ON (PREDECESSOR)</span>
              </label>
              <Select
                value={phaseForm.dependsOnPhaseId ? String(phaseForm.dependsOnPhaseId) : "none"}
                onValueChange={(val: any) =>
                  setPhaseForm((f) => ({ ...f, dependsOnPhaseId: !val || val === "none" ? null : parseInt(val, 10) }))
                }
              >
                <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500">
                  <div className="flex items-center gap-2 truncate">
                    {phaseForm.dependsOnPhaseId ? (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">
                          {phases.find((p) => p.id === phaseForm.dependsOnPhaseId)?.title ?? "Selected Phase"}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">None (Independent Phase)</span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl z-[100] min-w-[220px] font-mono">
                  <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                    <span className="text-slate-400">None (Independent Phase)</span>
                  </SelectItem>
                  {phases
                    .filter((p) => (phaseDialog.editing ? p.id !== phaseDialog.editing.id : true))
                    .map((p, idx) => {
                      const pal = getPaletteForTitle(p.title, idx);
                      return (
                        <SelectItem
                          key={p.id}
                          value={String(p.id)}
                          className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pal.hex }} />
                            <span className="truncate">{p.title}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* Progress Slider (Smart Bi-directional Sync or Locked by Tasks) */}
            <div className={cn("space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10", editingPhaseMeta?.isAutoCalculated && "opacity-75 bg-white/[0.01]")}>
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300 font-medium">COMPLETION PROGRESS</span>
                  {editingPhaseMeta?.isAutoCalculated && (
                    <span className="text-[9px] text-indigo-400 font-mono flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <span className="text-indigo-400 font-bold">{phaseForm.progress}%</span>
              </div>
              <input
                type="range"
                disabled={Boolean(editingPhaseMeta?.isAutoCalculated)}
                min="0"
                max="100"
                step="5"
                value={phaseForm.progress}
                onChange={(e) => handlePhaseProgressChange(parseInt(e.target.value, 10) || 0)}
                className={cn(
                  "w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500",
                  editingPhaseMeta?.isAutoCalculated && "cursor-not-allowed opacity-50"
                )}
              />
            </div>

            {/* Phase Status Select (Smart Bi-directional Sync or Locked by Tasks) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300">Phase Status</label>
                {editingPhaseMeta?.isAutoCalculated && (
                  <span className="text-[9px] text-indigo-400 font-mono flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>
              <Select
                disabled={Boolean(editingPhaseMeta?.isAutoCalculated)}
                value={phaseForm.status}
                onValueChange={(val: any) => handlePhaseStatusSelect(val || "PLANNED")}
              >
                <SelectTrigger
                  disabled={Boolean(editingPhaseMeta?.isAutoCalculated)}
                  className={cn(
                    "w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500",
                    editingPhaseMeta?.isAutoCalculated && "opacity-75 cursor-not-allowed bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {PHASE_STATUS_CONFIG[phaseForm.status]?.icon}
                    <span>{PHASE_STATUS_CONFIG[phaseForm.status]?.label ?? phaseForm.status}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl z-[100] min-w-[200px] font-mono">
                  <SelectItem value="PLANNED" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>Planned (0%)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="IN_PROGRESS" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>In Progress (50%)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="DONE" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-2">
                      <Flag className="w-3.5 h-3.5 text-purple-400" />
                      <span>Done (100%)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="BLOCKED" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>Blocked</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t border-white/10 mt-3">
            <Button
              variant="ghost"
              onClick={() => setPhaseDialog({ open: false })}
              className="font-mono text-xs text-slate-400 hover:text-white rounded-2xl h-10 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePhase}
              disabled={isPending || !phaseForm.title || !phaseForm.startDate || !phaseForm.endDate}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {phaseDialog.editing ? "Save Changes" : "Add Phase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EXACT DRIVE-MATCHING UPLOAD MODAL ── */}
      <Dialog open={isUploadDocModalOpen} onOpenChange={setIsUploadDocModalOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-sm font-bold text-white font-mono flex items-center gap-2 uppercase tracking-wide">
              <UploadCloud className="w-4 h-4 text-indigo-400" /> UPLOAD FILE TO DRIVE &amp; STORAGE
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsUploadDocModalOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 max-h-[60vh]">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center relative overflow-hidden",
                  isDragging
                    ? "border-indigo-400 bg-indigo-500/20 scale-[1.02]"
                    : uploadFiles.length > 0
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(e.target.files);
                    }
                  }}
                  className="hidden"
                />

                <div className="space-y-2 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                    <UploadCloud className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white font-mono">
                      Click to select files or drag &amp; drop here (Bulk supported)
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-sans">
                      Auto-categorizes PDF, Docs, Sheets, Images, Videos, Audio &amp; Archives
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected Files Queue Preview */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase">
                    <span>Selected Files ({uploadFiles.length})</span>
                    <button
                      type="button"
                      onClick={() => setUploadFiles([])}
                      className="text-indigo-400 hover:underline text-[10px] font-normal cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {uploadFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-white truncate max-w-[200px]">{file.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">({formatBytes(file.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeUploadFile(idx);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Storage Destination (3 exact options matching Drive) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-300 uppercase">
                  Storage Destination
                </label>
                <div className="flex flex-col gap-2">
                  {/* Local Only */}
                  <div
                    onClick={() => setUploadMode("local_only")}
                    className={cn(
                      "p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors",
                      uploadMode === "local_only" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center",
                          uploadMode === "local_only" ? "border-emerald-500 bg-emerald-500/20" : "border-white/20"
                        )}
                      >
                        {uploadMode === "local_only" && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-bold", uploadMode === "local_only" ? "text-emerald-400" : "text-slate-300")}>
                          Local Storage Only
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">Save to local server disk</span>
                      </div>
                    </div>
                    <HardDrive className={cn("w-4 h-4", uploadMode === "local_only" ? "text-emerald-400" : "text-slate-500")} />
                  </div>

                  {/* Auto Sync */}
                  <div
                    onClick={() => setUploadMode("auto_sync")}
                    className={cn(
                      "p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors",
                      uploadMode === "auto_sync" ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center",
                          uploadMode === "auto_sync" ? "border-indigo-500 bg-indigo-500/20" : "border-white/20"
                        )}
                      >
                        {uploadMode === "auto_sync" && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-bold", uploadMode === "auto_sync" ? "text-white" : "text-slate-300")}>
                          Auto Sync (Local + Drive)
                        </span>
                        <span className={cn("text-[10px] font-sans", uploadMode === "auto_sync" ? "text-indigo-300" : "text-slate-400")}>
                          Save locally &amp; sync to {selectedFolderName}
                        </span>
                      </div>
                    </div>
                    <RefreshCw className={cn("w-4 h-4", uploadMode === "auto_sync" ? "text-indigo-400" : "text-slate-500")} />
                  </div>

                  {/* Cloud Only */}
                  <div
                    onClick={() => setUploadMode("drive_only")}
                    className={cn(
                      "p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors",
                      uploadMode === "drive_only" ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center",
                          uploadMode === "drive_only" ? "border-cyan-500 bg-cyan-500/20" : "border-white/20"
                        )}
                      >
                        {uploadMode === "drive_only" && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-bold", uploadMode === "drive_only" ? "text-cyan-400" : "text-slate-300")}>
                          Cloud Only (Google Drive)
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">Directly upload to Drive, bypass local</span>
                      </div>
                    </div>
                    <Cloud className={cn("w-4 h-4", uploadMode === "drive_only" ? "text-cyan-400" : "text-slate-500")} />
                  </div>
                </div>
              </div>

              {/* Optional Phase Link */}
              {phases.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Link to Project Phase (Optional)</span>
                  </label>
                  <Select
                    value={uploadPhaseId ? String(uploadPhaseId) : "none"}
                    onValueChange={(val: any) => setUploadPhaseId(!val || val === "none" ? null : parseInt(val, 10))}
                  >
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500">
                      <span className="truncate">
                        {uploadPhaseId ? phases.find((p) => p.id === uploadPhaseId)?.title || "Selected Phase" : "None (General Project Doc)"}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 min-w-[220px] font-mono">
                      <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                        None (General Project Doc)
                      </SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer hover:bg-white/10">
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                  {uploadError}
                </div>
              )}
            </div>

            {/* Exactly matching Drive footer buttons */}
            <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadDocModalOpen(false)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingUpload || uploadFiles.length === 0}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-2xl h-11 shadow-lg shadow-indigo-600/30 cursor-pointer transition-all"
              >
                {isSubmittingUpload
                  ? "Uploading..."
                  : uploadFiles.length > 1
                  ? `Save & Upload (${uploadFiles.length} Files)`
                  : "Save & Upload File"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── RICH FULL-FEATURED FILE PREVIEW MODAL (IDENTICAL TO DRIVE) ── */}
      <FilePreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* ── STANDARD GLASSMORPHIC DELETE PHASE MODAL ── */}
      {deletingPhaseConfirm && (
        <Dialog open={!!deletingPhaseConfirm} onOpenChange={() => setDeletingPhaseConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE PROJECT PHASE</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingPhaseConfirm.title}&quot;</span> from this roadmap?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Tasks associated with this phase will remain unassigned. This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingPhaseConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={handleDeletePhaseConfirmed}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Phase"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── STANDARD GLASSMORPHIC DELETE DOCUMENT MODAL ── */}
      {deletingAssetConfirm && (
        <Dialog open={!!deletingAssetConfirm} onOpenChange={() => setDeletingAssetConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE PROJECT DOCUMENT</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingAssetConfirm.title}&quot;</span> from this project?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This document will be permanently removed. This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingAssetConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={handleDeleteAssetConfirmed}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Document"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── STANDARD GLASSMORPHIC DELETE PROJECT MODAL ── */}
      {deletingProjectConfirm && (
        <Dialog open={deletingProjectConfirm} onOpenChange={setDeletingProjectConfirm}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE STRATEGIC PROJECT</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{project.name}&quot;</span>?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">All phases will be deleted. Scoped tasks and drive files will be unlinked. This cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingProjectConfirm(false)}
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
