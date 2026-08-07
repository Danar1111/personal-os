"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Task, Project, Asset, Note } from "@/db/schema";
import {
  createTaskAction,
  updateTaskStatusAction,
  updateTaskFullAction,
  deleteTaskAction,
  createProjectAction,
  deleteProjectAction,
} from "@/app/tasks/actions";
import {
  Plus,
  Trash2,
  MoveRight,
  MoveLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderPlus,
  Folder,
  Search,
  Filter,
  Layers,
  GripVertical,
  Edit3,
  FileText,
  Brain,
  HardDrive,
  Globe,
  AlertTriangle,
  ExternalLink,
  Eye,
  X,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ReferenceItem {
  id: string;
  type: "asset" | "drive" | "note" | "link";
  value: string;
}

interface KanbanBoardProps {
  initialTasks: Task[];
  initialProjects: Project[];
  initialAssets?: Asset[];
  initialNotes?: Note[];
}

import { useSearchParams } from "next/navigation";

export function KanbanBoard({
  initialTasks,
  initialProjects,
  initialAssets = [],
  initialNotes = [],
}: KanbanBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Drag & Drop state
  const [activeDraggingId, setActiveDraggingId] = useState<number | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<"todo" | "in_progress" | "done" | null>(null);

  // Pagination limits per column
  const [columnLimits, setColumnLimits] = useState({
    todo: 8,
    in_progress: 8,
    done: 8,
  });

  // Create Task Modal State
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newProjectId, setNewProjectId] = useState<string>("none");
  const [newReferences, setNewReferences] = useState<ReferenceItem[]>([]);

  // Manage Projects & Create Project Modal State
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isManageProjectsOpen, setIsManageProjectsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Task Detail View Modal State (ReadOnly / Action View)
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Task Edit Modal State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editProjectId, setEditProjectId] = useState<string>("none");
  const [editReferences, setEditReferences] = useState<ReferenceItem[]>([]);

  // Cool Custom Delete Confirmation Modal States
  const [deletingTaskConfirm, setDeletingTaskConfirm] = useState<Task | null>(null);
  const [deletingProjectConfirm, setDeletingProjectConfirm] = useState<Project | null>(null);

  // Fast project & reference lookup maps
  const projectMap = new Map(initialProjects.map((p) => [p.id, p.name]));
  const assetMap = new Map(initialAssets.map((a) => [a.id, a]));
  const noteMap = new Map(initialNotes.map((n) => [n.id, n]));

  // Separate Drive assets from Asset Vault links
  const driveAssetList = initialAssets.filter(
    (a) => a.type !== "link" || a.urlOrPath.startsWith("/uploads") || a.urlOrPath.includes("drive")
  );
  const vaultAssetList = initialAssets.filter(
    (a) => a.type === "link" && !a.urlOrPath.startsWith("/uploads")
  );
  const displayVaultAssets = vaultAssetList.length > 0 ? vaultAssetList : initialAssets;
  const displayDriveAssets = driveAssetList.length > 0 ? driveAssetList : initialAssets;

  const getProjectName = (id?: number | null) => {
    if (!id) return null;
    return projectMap.get(id) || `Project #${id}`;
  };

  // Helper to parse multiple reference items from description
  const parseReferences = (descText?: string | null) => {
    if (!descText) return { cleanDesc: "", references: [] };

    const normalizedText = descText.replace(/\[REF:FILE:/g, "[REF:LINK:");
    const matches = Array.from(normalizedText.matchAll(/\[REF:(ASSET|DRIVE|NOTE|LINK):(.*?)\]/g));
    const cleanDesc = normalizedText.replace(/\[REF:(ASSET|DRIVE|NOTE|LINK):.*?\]/g, "").trim();

    const references: ReferenceItem[] = matches.map((m, index) => ({
      id: `ref-${index}-${Date.now()}`,
      type: m[1].toLowerCase() as "asset" | "drive" | "note" | "link",
      value: m[2],
    }));

    return { cleanDesc, references };
  };

  // Format description text with embedded reference markers
  const formatDescriptionWithRefs = (cleanDesc: string, refs: ReferenceItem[]) => {
    let full = cleanDesc.trim();
    refs.forEach((ref) => {
      if (ref.value.trim()) {
        full += `\n[REF:${ref.type.toUpperCase()}:${ref.value.trim()}]`;
      }
    });
    return full;
  };

  // Helper to resolve reference status & title
  const checkReferenceStatus = (ref: ReferenceItem) => {
    if (ref.type === "asset") {
      const assetId = parseInt(ref.value, 10);
      const asset = assetMap.get(assetId);
      if (!asset) {
        return { isMissing: true, label: `Asset Vault Item #${ref.value} Deleted`, link: null };
      }
      return { isMissing: false, label: asset.title, link: asset.urlOrPath };
    }

    if (ref.type === "drive") {
      const driveId = parseInt(ref.value, 10);
      const file = assetMap.get(driveId);
      if (!file) {
        return { isMissing: true, label: `Drive File #${ref.value} Removed`, link: null };
      }
      return { isMissing: false, label: file.title, link: file.urlOrPath };
    }

    if (ref.type === "note") {
      const noteId = parseInt(ref.value, 10);
      const note = noteMap.get(noteId);
      if (!note) {
        return { isMissing: true, label: `Brain Note #${ref.value} Deleted`, link: null };
      }
      return { isMissing: false, label: note.title, link: `/vault?note=${note.id}` };
    }

    if (ref.type === "link") {
      return { isMissing: false, label: ref.value, link: ref.value };
    }

    return { isMissing: false, label: ref.value, link: null };
  };

  // Filter tasks based on search & project filter
  const filteredTasks = initialTasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProject =
      selectedProjectFilter === "all" ||
      (selectedProjectFilter === "unassigned" && !task.projectId) ||
      task.projectId?.toString() === selectedProjectFilter;

    return matchesSearch && matchesProject;
  });

  const todoTasks = filteredTasks.filter((t) => t.status === "todo");
  const inProgressTasks = filteredTasks.filter((t) => t.status === "in_progress");
  const doneTasks = filteredTasks.filter((t) => t.status === "done");

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const fullDesc = formatDescriptionWithRefs(newDescription, newReferences);

    startTransition(async () => {
      await createTaskAction({
        title: newTitle,
        description: fullDesc,
        status: newStatus,
        priority: newPriority,
        projectId: newProjectId !== "none" ? parseInt(newProjectId, 10) : null,
      });
      setNewTitle("");
      setNewDescription("");
      setNewReferences([]);
      setIsTaskDialogOpen(false);
    });
  };

  const handleOpenEditModal = (task: Task) => {
    setViewingTask(null);
    setEditingTask(task);
    setEditTitle(task.title);

    const { cleanDesc, references } = parseReferences(task.description);
    setEditDescription(cleanDesc);
    setEditStatus((task.status as any) || "todo");
    setEditPriority((task.priority as any) || "medium");
    setEditProjectId(task.projectId ? task.projectId.toString() : "none");
    setEditReferences(references);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    const fullDesc = formatDescriptionWithRefs(editDescription, editReferences);

    startTransition(async () => {
      await updateTaskFullAction(editingTask.id, {
        title: editTitle,
        description: fullDesc,
        status: editStatus,
        priority: editPriority,
        projectId: editProjectId !== "none" ? parseInt(editProjectId, 10) : null,
      });
      setEditingTask(null);
    });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    startTransition(async () => {
      await createProjectAction(newProjectName);
      setNewProjectName("");
      setIsProjectDialogOpen(false);
    });
  };

  const handleStatusChange = (taskId: number, newStatus: "todo" | "in_progress" | "done") => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-[10px] font-mono px-2 py-0.5">
            HIGH
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px] font-mono px-2 py-0.5">
            MEDIUM
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-slate-500/40 text-slate-400 bg-slate-500/10 text-[10px] font-mono px-2 py-0.5">
            LOW
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10">
        {/* Search & Project Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter tasks by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Project Filter Select */}
          <Select
            value={selectedProjectFilter}
            onValueChange={(val: any) => setSelectedProjectFilter(val || "all")}
          >
            <SelectTrigger className="w-64 bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  {selectedProjectFilter === "all"
                    ? "All Projects"
                    : selectedProjectFilter === "unassigned"
                    ? "Unassigned Projects"
                    : getProjectName(parseInt(selectedProjectFilter, 10)) || "Project"}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl z-[100] min-w-[280px]">
              <SelectItem value="all" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                All Projects
              </SelectItem>
              <SelectItem value="unassigned" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                Unassigned
              </SelectItem>
              {initialProjects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id.toString()} className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Manage Projects Button */}
          <Button
            onClick={() => setIsManageProjectsOpen(true)}
            variant="outline"
            className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs font-mono rounded-2xl h-11 px-4 gap-1.5 cursor-pointer"
          >
            <Folder className="w-4 h-4 text-purple-400" />
            Manage Projects ({initialProjects.length})
          </Button>

          {/* New Project Button */}
          <Button
            onClick={() => setIsProjectDialogOpen(true)}
            variant="outline"
            className="border-white/15 text-slate-200 hover:bg-white/10 text-xs font-mono rounded-2xl h-11 px-4 gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            New Project
          </Button>

          {/* New Task Button */}
          <Button
            onClick={() => setIsTaskDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Task
          </Button>
        </div>
      </div>

      {/* Manage Projects Modal Dialog */}
      <Dialog open={isManageProjectsOpen} onOpenChange={setIsManageProjectsOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                <Folder className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm font-bold font-mono text-white tracking-wide uppercase">
                MANAGED PROJECTS ({initialProjects.length})
              </DialogTitle>
            </div>
            <button
              onClick={() => setIsManageProjectsOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {initialProjects.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-500 border border-dashed border-white/10 rounded-2xl">
                No projects found in database.
              </div>
            ) : (
              initialProjects.map((proj) => {
                const taskCount = initialTasks.filter((t) => t.projectId === proj.id).length;

                return (
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 hover:border-purple-500/40 transition-all font-mono text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 shrink-0">
                        <Folder className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white truncate text-xs">{proj.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{taskCount} linked task{taskCount !== 1 ? "s" : ""}</p>
                      </div>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingProjectConfirm(proj)}
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                      title="Delete Project & Tasks"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-white/10 flex justify-between items-center">
            <Button
              onClick={() => {
                setIsManageProjectsOpen(false);
                setIsProjectDialogOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-10 px-4 gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" /> + New Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" /> CREATE NEW PROJECT
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Project Name *</label>
              <Input
                required
                placeholder="e.g., Personal OS Core"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                {isPending ? "Creating..." : "Save Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> NEW OMNI-KANBAN TASK
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Task Title *</label>
              <Input
                required
                placeholder="e.g., Build Server Actions for CRUD"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Description</label>
              <Textarea
                placeholder="Provide additional details or sub-tasks..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl min-h-[90px] p-3.5 font-sans"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex-1 min-w-[120px] space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Status</label>
                <Select value={newStatus} onValueChange={(val: any) => setNewStatus(val || "todo")}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[160px]">
                    <SelectItem value="todo" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Todo</SelectItem>
                    <SelectItem value="in_progress" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">In Progress</SelectItem>
                    <SelectItem value="done" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[120px] space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Priority</label>
                <Select value={newPriority} onValueChange={(val: any) => setNewPriority(val || "medium")}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[160px]">
                    <SelectItem value="low" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Low</SelectItem>
                    <SelectItem value="medium" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Medium</SelectItem>
                    <SelectItem value="high" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[140px] space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Project</label>
                <Select value={newProjectId} onValueChange={(val: any) => setNewProjectId(val || "none")}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                    <span className="truncate">
                      {newProjectId === "none" ? "None" : getProjectName(parseInt(newProjectId, 10)) || "Project"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[200px]">
                    <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">None</SelectItem>
                    {initialProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multiple Linked References Section */}
            <ReferenceManager
              references={newReferences}
              onChange={setNewReferences}
              vaultAssets={displayVaultAssets}
              driveAssets={displayDriveAssets}
              notes={initialNotes}
              assetMap={assetMap}
              noteMap={noteMap}
            />

            <DialogFooter className="pt-3">
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                {isPending ? "Creating..." : "Save Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3-Column Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLUMN 1: TODO */}
        <KanbanColumn
          columnStatus="todo"
          title="TODO"
          icon={<AlertCircle className="w-4 h-4 text-indigo-400" />}
          count={todoTasks.length}
          tasks={todoTasks}
          limit={columnLimits.todo}
          onLoadMore={() => setColumnLimits((prev) => ({ ...prev, todo: prev.todo + 8 }))}
          projectMap={projectMap}
          getPriorityBadge={getPriorityBadge}
          onStatusChange={handleStatusChange}
          onDeleteTask={(t) => setDeletingTaskConfirm(t)}
          onViewTask={(t) => setViewingTask(t)}
          onEditTask={handleOpenEditModal}
          parseReferences={parseReferences}
          checkReferenceStatus={checkReferenceStatus}
          isPending={isPending}
          activeDraggingId={activeDraggingId}
          setActiveDraggingId={setActiveDraggingId}
          activeDropColumn={activeDropColumn}
          setActiveDropColumn={setActiveDropColumn}
          nextStatus="in_progress"
        />

        {/* COLUMN 2: IN PROGRESS */}
        <KanbanColumn
          columnStatus="in_progress"
          title="IN PROGRESS"
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          count={inProgressTasks.length}
          tasks={inProgressTasks}
          limit={columnLimits.in_progress}
          onLoadMore={() => setColumnLimits((prev) => ({ ...prev, in_progress: prev.in_progress + 8 }))}
          projectMap={projectMap}
          getPriorityBadge={getPriorityBadge}
          onStatusChange={handleStatusChange}
          onDeleteTask={(t) => setDeletingTaskConfirm(t)}
          onViewTask={(t) => setViewingTask(t)}
          onEditTask={handleOpenEditModal}
          parseReferences={parseReferences}
          checkReferenceStatus={checkReferenceStatus}
          isPending={isPending}
          activeDraggingId={activeDraggingId}
          setActiveDraggingId={setActiveDraggingId}
          activeDropColumn={activeDropColumn}
          setActiveDropColumn={setActiveDropColumn}
          prevStatus="todo"
          nextStatus="done"
        />

        {/* COLUMN 3: COMPLETED */}
        <KanbanColumn
          columnStatus="done"
          title="COMPLETED"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          count={doneTasks.length}
          tasks={doneTasks}
          limit={columnLimits.done}
          onLoadMore={() => setColumnLimits((prev) => ({ ...prev, done: prev.done + 8 }))}
          projectMap={projectMap}
          getPriorityBadge={getPriorityBadge}
          onStatusChange={handleStatusChange}
          onDeleteTask={(t) => setDeletingTaskConfirm(t)}
          onViewTask={(t) => setViewingTask(t)}
          onEditTask={handleOpenEditModal}
          parseReferences={parseReferences}
          checkReferenceStatus={checkReferenceStatus}
          isPending={isPending}
          activeDraggingId={activeDraggingId}
          setActiveDraggingId={setActiveDraggingId}
          activeDropColumn={activeDropColumn}
          setActiveDropColumn={setActiveDropColumn}
          prevStatus="in_progress"
        />
      </div>

      {/* TASK DETAIL VIEW MODAL (Triggered on Card Click) */}
      {viewingTask && (
        <Dialog open={!!viewingTask} onOpenChange={() => setViewingTask(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Eye className="w-4 h-4" />
                </div>
                <DialogTitle className="text-sm font-bold font-mono text-white tracking-wide uppercase">
                  TASK DETAIL VIEW
                </DialogTitle>
              </div>

              <button
                onClick={() => setViewingTask(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            {/* Task Info Body */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white font-sans">{viewingTask.title}</h3>
                {getPriorityBadge(viewingTask.priority)}
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Status: <strong className="text-white uppercase">{viewingTask.status}</strong></span>
                {viewingTask.projectId && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-300">Project: {getProjectName(viewingTask.projectId)}</span>
                  </>
                )}
              </div>

              {/* Clean Description */}
              {(() => {
                const { cleanDesc, references } = parseReferences(viewingTask.description);
                return (
                  <>
                    {cleanDesc ? (
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                        {cleanDesc}
                      </div>
                    ) : (
                      <p className="text-xs italic text-slate-500 font-mono">No description provided for this task.</p>
                    )}

                    {/* Attached References List */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <h4 className="text-xs font-mono text-purple-300 font-semibold flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-purple-400" /> ATTACHED DOCUMENTS &amp; REFERENCES ({references.length})
                      </h4>

                      {references.length === 0 ? (
                        <p className="text-xs font-mono text-slate-500">No external documents or brain notes attached.</p>
                      ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {references.map((ref) => {
                            const status = checkReferenceStatus(ref);
                            return (
                              <div key={ref.id}>
                                {status.isMissing ? (
                                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>Warning: {status.label}</span>
                                  </div>
                                ) : (
                                  <a
                                    href={status.link || "#"}
                                    target={status.link?.startsWith("http") ? "_blank" : "_self"}
                                    rel="noopener noreferrer"
                                    className="p-3 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs font-mono flex items-center justify-between transition-all group"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {ref.type === "note" ? (
                                        <Brain className="w-4 h-4 text-purple-400 shrink-0" />
                                      ) : ref.type === "drive" ? (
                                        <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
                                      ) : ref.type === "asset" ? (
                                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                                      ) : (
                                        <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                                      )}
                                      <span className="truncate font-semibold text-white group-hover:text-purple-300">
                                        {status.label}
                                      </span>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-2" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer Actions */}
            <DialogFooter className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setDeletingTaskConfirm(viewingTask)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono text-xs rounded-2xl h-11 px-4"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleOpenEditModal(viewingTask)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 shadow-lg shadow-indigo-600/30"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Task
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* TASK EDIT MODAL DIALOG */}
      {editingTask && (
        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" /> EDIT TASK &amp; REFERENCES
              </DialogTitle>
              <button
                onClick={() => setEditingTask(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Task Title *</label>
                <Input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl min-h-[90px] p-3.5 font-sans"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex-1 min-w-[120px] space-y-1">
                  <label className="text-[11px] font-mono text-slate-300">Status</label>
                  <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val || "todo")}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[160px]">
                      <SelectItem value="todo" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Todo</SelectItem>
                      <SelectItem value="in_progress" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">In Progress</SelectItem>
                      <SelectItem value="done" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[120px] space-y-1">
                  <label className="text-[11px] font-mono text-slate-300">Priority</label>
                  <Select value={editPriority} onValueChange={(val: any) => setEditPriority(val || "medium")}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[160px]">
                      <SelectItem value="low" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Low</SelectItem>
                      <SelectItem value="medium" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Medium</SelectItem>
                      <SelectItem value="high" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[140px] space-y-1">
                  <label className="text-[11px] font-mono text-slate-300">Project</label>
                  <Select value={editProjectId} onValueChange={(val: any) => setEditProjectId(val || "none")}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                      <span className="truncate">
                        {editProjectId === "none" ? "None" : getProjectName(parseInt(editProjectId, 10)) || "Project"}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[200px]">
                      <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">None</SelectItem>
                      {initialProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multiple Linked References Editor */}
              <ReferenceManager
                references={editReferences}
                onChange={setEditReferences}
                vaultAssets={displayVaultAssets}
                driveAssets={displayDriveAssets}
                notes={initialNotes}
                assetMap={assetMap}
                noteMap={noteMap}
              />

              <DialogFooter className="pt-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeletingTaskConfirm(editingTask)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono text-xs rounded-2xl h-11 px-4"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Task
                </Button>
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-6 shadow-lg shadow-indigo-600/30">
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC TASK DELETE CONFIRMATION DIALOG */}
      {deletingTaskConfirm && (
        <Dialog open={!!deletingTaskConfirm} onOpenChange={() => setDeletingTaskConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE TASK CONFIRMATION</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to permanently delete task <span className="text-rose-300 font-bold">&quot;{deletingTaskConfirm.title}&quot;</span>?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingTaskConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingTaskConfirm.id;
                  startTransition(async () => {
                    await deleteTaskAction(id);
                    setDeletingTaskConfirm(null);
                    if (editingTask?.id === id) setEditingTask(null);
                    if (viewingTask?.id === id) setViewingTask(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC PROJECT DELETE CONFIRMATION DIALOG */}
      {deletingProjectConfirm && (
        <Dialog open={!!deletingProjectConfirm} onOpenChange={() => setDeletingProjectConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE PROJECT &amp; TASKS</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete project <span className="text-rose-300 font-bold">&quot;{deletingProjectConfirm.name}&quot;</span>?
              </p>
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono mt-3 leading-relaxed">
                ⚠️ WARNING: Deleting this project will ALSO permanently remove all tasks assigned to this project!
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingProjectConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingProjectConfirm.id;
                  startTransition(async () => {
                    await deleteProjectAction(id);
                    setDeletingProjectConfirm(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Delete Project & Tasks"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Sub-component for managing multiple dynamic reference rows with search popups
interface ReferenceManagerProps {
  references: ReferenceItem[];
  onChange: (refs: ReferenceItem[]) => void;
  vaultAssets: Asset[];
  driveAssets: Asset[];
  notes: Note[];
  assetMap: Map<number, Asset>;
  noteMap: Map<number, Note>;
}

function ReferenceManager({
  references,
  onChange,
  vaultAssets,
  driveAssets,
  notes,
  assetMap,
  noteMap,
}: ReferenceManagerProps) {
  const addReferenceRow = () => {
    const newRef: ReferenceItem = {
      id: `ref-${Date.now()}-${Math.random()}`,
      type: "asset",
      value: "",
    };
    onChange([...references, newRef]);
  };

  const updateReferenceRow = (id: string, key: "type" | "value", val: string) => {
    onChange(
      references.map((r) => {
        if (r.id === id) {
          if (key === "type") return { ...r, type: val as any, value: "" };
          return { ...r, value: val };
        }
        return r;
      })
    );
  };

  const removeReferenceRow = (id: string) => {
    onChange(references.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3 pt-3 border-t border-white/10">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-purple-300 font-semibold flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-purple-400" /> Linked Documents &amp; Brain References
        </label>
        <Button
          type="button"
          onClick={addReferenceRow}
          variant="outline"
          className="text-[11px] font-mono border-purple-500/30 text-purple-300 hover:bg-purple-500/10 rounded-xl h-8 px-3 gap-1"
        >
          <Plus className="w-3 h-3" /> Add Reference Link
        </Button>
      </div>

      {references.length === 0 ? (
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs font-mono text-slate-500">
          No external assets, drive files, or brain notes linked to this task.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1.5 scrollbar-thin">
          {references.map((ref) => (
            <div key={ref.id} className="flex items-center gap-2 bg-white/[0.02] p-2.5 rounded-2xl border border-white/10">
              {/* Type Select (4 Options: Asset Vault, Drive Storage, Second Brain, External Link) */}
              <Select
                value={ref.type}
                onValueChange={(val: any) => updateReferenceRow(ref.id, "type", val)}
              >
                <SelectTrigger className="w-44 bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[190px]">
                  <SelectItem value="asset" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Asset Vault</SelectItem>
                  <SelectItem value="drive" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Drive Storage</SelectItem>
                  <SelectItem value="note" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Second Brain Note</SelectItem>
                  <SelectItem value="link" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">External Link</SelectItem>
                </SelectContent>
              </Select>

              {/* Item Value Selector with Inline Search popup for Asset, Drive, and Note */}
              <div className="flex-1 min-w-0">
                {ref.type === "asset" && (
                  <SearchableSelect
                    placeholder="Search Asset Vault..."
                    value={ref.value}
                    onChange={(val) => updateReferenceRow(ref.id, "value", val)}
                    items={vaultAssets.map((a) => ({ id: a.id.toString(), label: a.title, sublabel: a.urlOrPath }))}
                  />
                )}

                {ref.type === "drive" && (
                  <SearchableSelect
                    placeholder="Search Drive Files..."
                    value={ref.value}
                    onChange={(val) => updateReferenceRow(ref.id, "value", val)}
                    items={driveAssets.map((d) => ({ id: d.id.toString(), label: d.title, sublabel: d.urlOrPath }))}
                  />
                )}

                {ref.type === "note" && (
                  <SearchableSelect
                    placeholder="Search Second Brain Notes..."
                    value={ref.value}
                    onChange={(val) => updateReferenceRow(ref.id, "value", val)}
                    items={notes.map((n) => ({ id: n.id.toString(), label: n.title, sublabel: n.category }))}
                  />
                )}

                {ref.type === "link" && (
                  <Input
                    placeholder="e.g. https://github.com/..."
                    value={ref.value}
                    onChange={(e) => updateReferenceRow(ref.id, "value", e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono"
                  />
                )}
              </div>

              {/* Remove Row Button */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeReferenceRow(ref.id)}
                className="w-9 h-9 p-0 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reusable Searchable Select Component with React Portal for front-layer rendering
function SearchableSelect({
  placeholder,
  value,
  onChange,
  items,
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  items: Array<{ id: string; label: string; sublabel?: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  // Close on outside click or window resize/scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        portalRef.current &&
        !portalRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  const selectedItem = items.find((i) => i.id === value);
  const filteredItems = items.filter(
    (i) =>
      i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.sublabel && i.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono flex items-center justify-between text-left transition-all cursor-pointer"
      >
        <span className="truncate pr-2">
          {selectedItem ? selectedItem.label : <span className="text-slate-500">{placeholder}</span>}
        </span>
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: "260px",
              zIndex: 99999,
            }}
            className="bg-[#141420] border border-white/20 text-slate-100 rounded-2xl p-2.5 shadow-2xl space-y-2 font-mono text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Bar inside Option Popup */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                placeholder="Type to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-white/[0.06] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-xl h-9 font-mono"
              />
            </div>

            {/* Filtered Options List */}
            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {filteredItems.length === 0 ? (
                <div className="p-3 text-center text-xs font-mono text-slate-500">
                  No items match &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-mono cursor-pointer transition-colors flex flex-col gap-0.5",
                      item.id === value
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-200 hover:bg-indigo-600/30 hover:text-white"
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-[10px] text-slate-400 truncate opacity-80">{item.sublabel}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// Sub-component for individual Kanban column
interface KanbanColumnProps {
  columnStatus: "todo" | "in_progress" | "done";
  title: string;
  icon: React.ReactNode;
  count: number;
  tasks: Task[];
  limit: number;
  onLoadMore: () => void;
  projectMap: Map<number, string>;
  getPriorityBadge: (priority: string) => React.ReactNode;
  onStatusChange: (taskId: number, status: "todo" | "in_progress" | "done") => void;
  onDeleteTask: (task: Task) => void;
  onViewTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  parseReferences: (descText?: string | null) => { cleanDesc: string; references: ReferenceItem[] };
  checkReferenceStatus: (ref: ReferenceItem) => { isMissing: boolean; label: string; link: string | null };
  isPending: boolean;
  activeDraggingId: number | null;
  setActiveDraggingId: (id: number | null) => void;
  activeDropColumn: "todo" | "in_progress" | "done" | null;
  setActiveDropColumn: (col: "todo" | "in_progress" | "done" | null) => void;
  prevStatus?: "todo" | "in_progress" | "done";
  nextStatus?: "todo" | "in_progress" | "done";
}

function KanbanColumn({
  columnStatus,
  title,
  icon,
  count,
  tasks,
  limit,
  onLoadMore,
  projectMap,
  getPriorityBadge,
  onStatusChange,
  onDeleteTask,
  onViewTask,
  onEditTask,
  parseReferences,
  checkReferenceStatus,
  isPending,
  activeDraggingId,
  setActiveDraggingId,
  activeDropColumn,
  setActiveDropColumn,
  prevStatus,
  nextStatus,
}: KanbanColumnProps) {
  const isTargetColumn = activeDropColumn === columnStatus;
  const visibleTasks = tasks.slice(0, limit);
  const hasMore = tasks.length > limit;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (activeDropColumn !== columnStatus) {
      setActiveDropColumn(columnStatus);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setActiveDropColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setActiveDropColumn(null);
    const taskIdStr = e.dataTransfer.getData("text/plain");
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr, 10);
    if (!isNaN(taskId)) {
      onStatusChange(taskId, columnStatus);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "glass-panel p-4 rounded-3xl flex flex-col h-[calc(100vh-230px)] min-h-[520px] transition-all duration-200 border border-white/10",
        isTargetColumn && "border-indigo-500/60 bg-indigo-950/20 ring-2 ring-indigo-500/30"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 shrink-0">
        <div className="flex items-center gap-2 font-mono font-bold text-xs text-white">
          {icon}
          <span>{title}</span>
        </div>
        <Badge variant="outline" className="border-white/10 text-slate-300 font-mono text-[11px] px-2 py-0.5">
          {count}
        </Badge>
      </div>

      {/* Drop Highlight Zone */}
      {isTargetColumn && (
        <div className="p-3 mb-3 border-2 border-dashed border-indigo-400/50 bg-indigo-500/10 rounded-2xl text-center text-xs font-mono text-indigo-300 animate-pulse shrink-0">
          Drop task to move to {title}
        </div>
      )}

      {/* Task Cards Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {tasks.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl text-slate-500 font-mono text-xs">
            No tasks in {title.toLowerCase()}
          </div>
        ) : (
          <>
            {visibleTasks.map((task) => {
              const projectName = task.projectId ? projectMap.get(task.projectId) : null;
              const isDraggingThis = activeDraggingId === task.id;
              const { cleanDesc, references } = parseReferences(task.description);

              return (
                <div
                  key={task.id}
                  draggable={!isPending}
                  onClick={() => onViewTask(task)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", task.id.toString());
                    setActiveDraggingId(task.id);
                  }}
                  onDragEnd={() => {
                    setActiveDraggingId(null);
                    setActiveDropColumn(null);
                  }}
                  className={cn(
                    "glass-panel glass-panel-hover p-4 rounded-2xl space-y-3 relative group transition-all duration-200 cursor-pointer select-none border border-white/10 hover:border-indigo-500/50 shadow-lg",
                    isDraggingThis && "opacity-40 border-indigo-500 border-dashed scale-[0.98]"
                  )}
                >
                  {/* Header: Drag Grip, Priority, Project, Edit & Delete Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      {getPriorityBadge(task.priority)}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {projectName && (
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5 inline" /> {projectName}
                        </span>
                      )}

                      {/* Separate Edit Button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(task);
                        }}
                        className="w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                        title="Edit Task"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Body: Title & Description */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white leading-snug font-sans group-hover:text-indigo-300 transition-colors">
                      {task.title}
                    </h4>
                    {cleanDesc && (
                      <p className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                        {cleanDesc}
                      </p>
                    )}
                  </div>

                  {/* Multiple Reference Attachment Badges */}
                  {references.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {references.map((ref) => {
                        const status = checkReferenceStatus(ref);
                        return (
                          <React.Fragment key={ref.id}>
                            {status.isMissing ? (
                              <div className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-xl border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Ref Missing</span>
                              </div>
                            ) : (
                              <a
                                href={status.link || "#"}
                                onClick={(e) => e.stopPropagation()}
                                target={status.link?.startsWith("http") ? "_blank" : "_self"}
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 px-2.5 py-0.5 rounded-xl border border-purple-500/30 transition-colors max-w-full"
                              >
                                {ref.type === "note" ? (
                                  <Brain className="w-3 h-3 text-purple-400 shrink-0" />
                                ) : ref.type === "drive" ? (
                                  <HardDrive className="w-3 h-3 text-indigo-400 shrink-0" />
                                ) : ref.type === "asset" ? (
                                  <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
                                ) : (
                                  <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[150px]">{status.label}</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                              </a>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer Controls: Move Status & Delete */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {prevStatus && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(task.id, prevStatus);
                          }}
                          className="w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                          title={`Move to ${prevStatus}`}
                        >
                          <MoveLeft className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {nextStatus && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(task.id, nextStatus);
                          }}
                          className="w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                          title={`Move to ${nextStatus}`}
                        >
                          <MoveRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(task);
                      }}
                      className="w-7 h-7 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 transition-opacity"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {hasMore && (
              <Button
                onClick={onLoadMore}
                variant="outline"
                className="w-full text-xs font-mono border-white/15 text-indigo-300 hover:text-white hover:bg-indigo-500/10 rounded-2xl h-10 my-2"
              >
                Load More Tasks ({tasks.length - limit} remaining)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
