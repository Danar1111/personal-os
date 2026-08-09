"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Folder, Note } from "@/db/schema";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  Trash2,
  FileText,
  Code,
  Lightbulb,
  BookOpen,
  Layers,
  Sparkles,
  MoreVertical,
  Plus,
  Scissors,
  Copy as CopyIcon,
  Clipboard,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface FolderNode {
  folder: Folder;
  subfolders: FolderNode[];
  notes: Note[];
}

interface FolderTreeProps {
  folders: Folder[];
  notes: Note[];
  activeNoteId: number | null;
  searchQuery: string;
  sortBy?: "updated-desc" | "updated-asc" | "title-asc" | "title-desc";
  isDirty?: boolean;
  clipboardNote?: { action: "cut" | "copy"; note: Note } | null;
  onSelectNote: (note: Note) => void;
  onCreateFolder: (parentId?: number | null) => void;
  onCreateNoteInFolder?: (folderId: number) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDeleteNote?: (note: Note) => void;
  onMoveNoteToFolder?: (noteId: number, targetFolderId: number | null) => void;
  onMoveFolderToFolder?: (folderId: number, targetParentId: number | null) => void;
  onCutNote?: (note: Note) => void;
  onCopyNote?: (note: Note) => void;
  onPasteNoteToFolder?: (targetFolderId: number | null) => void;
  onUnsavedActionAlert?: (actionName: string) => void;
}

export function FolderTree({
  folders,
  notes,
  activeNoteId,
  searchQuery,
  sortBy = "updated-desc",
  isDirty,
  clipboardNote,
  onSelectNote,
  onCreateFolder,
  onCreateNoteInFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteNote,
  onMoveNoteToFolder,
  onMoveFolderToFolder,
  onCutNote,
  onCopyNote,
  onPasteNoteToFolder,
  onUnsavedActionAlert,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [dragOverFolderId, setDragOverFolderId] = useState<number | "root" | null>(null);

  // Build full folder tree structure from flat arrays & apply sorting
  const { rootNodes, unassignedNotes, folderParentMap, noteFolderMap } = useMemo(() => {
    const nodeMap: Record<number, FolderNode> = {};
    const folderParentMap: Record<number, number | null> = {};
    const noteFolderMap: Record<number, number | null> = {};

    folders.forEach((f) => {
      nodeMap[f.id] = {
        folder: f,
        subfolders: [],
        notes: [],
      };
      folderParentMap[f.id] = f.parentId || null;
    });

    const rawUnassignedNotes: Note[] = [];
    notes.forEach((n) => {
      noteFolderMap[n.id] = n.folderId || null;
      if (n.folderId && nodeMap[n.folderId]) {
        nodeMap[n.folderId].notes.push(n);
      } else {
        rawUnassignedNotes.push(n);
      }
    });

    const rawRootNodes: FolderNode[] = [];
    folders.forEach((f) => {
      const parentId = f.parentId;
      if (parentId && nodeMap[parentId]) {
        nodeMap[parentId].subfolders.push(nodeMap[f.id]);
      } else {
        rawRootNodes.push(nodeMap[f.id]);
      }
    });

    const sortNotes = (noteList: Note[]) => {
      return [...noteList].sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (sortBy === "updated-desc") return timeB - timeA || b.id - a.id;
        if (sortBy === "updated-asc") return timeA - timeB || a.id - b.id;
        if (sortBy === "title-asc") return a.title.localeCompare(b.title) || b.id - a.id;
        if (sortBy === "title-desc") return b.title.localeCompare(a.title) || b.id - a.id;
        return 0;
      });
    };

    const sortFolderNodes = (nodeList: FolderNode[]): FolderNode[] => {
      return [...nodeList].sort((a, b) => {
        if (sortBy === "title-asc") return a.folder.name.localeCompare(b.folder.name);
        if (sortBy === "title-desc") return b.folder.name.localeCompare(a.folder.name);

        const getLatestNoteTime = (fn: FolderNode): number => {
          let maxTime = fn.folder.createdAt ? new Date(fn.folder.createdAt).getTime() : 0;
          fn.notes.forEach((n) => {
            const t = n.updatedAt ? new Date(n.updatedAt).getTime() : 0;
            if (t > maxTime) maxTime = t;
          });
          fn.subfolders.forEach((sub) => {
            const t = getLatestNoteTime(sub);
            if (t > maxTime) maxTime = t;
          });
          return maxTime;
        };

        const timeA = getLatestNoteTime(a);
        const timeB = getLatestNoteTime(b);

        if (sortBy === "updated-desc") return timeB - timeA || a.folder.name.localeCompare(b.folder.name);
        if (sortBy === "updated-asc") return timeA - timeB || a.folder.name.localeCompare(b.folder.name);
        return a.folder.name.localeCompare(b.folder.name);
      });
    };

    Object.values(nodeMap).forEach((node) => {
      node.notes = sortNotes(node.notes);
      node.subfolders = sortFolderNodes(node.subfolders);
    });

    const unassignedNotes = sortNotes(rawUnassignedNotes);
    const rootNodes = sortFolderNodes(rawRootNodes);

    return { rootNodes, unassignedNotes, folderParentMap, noteFolderMap };
  }, [folders, notes, sortBy]);

  // Auto-expand parent folders of active note whenever activeNoteId changes (preserve other open folders)
  useEffect(() => {
    if (!activeNoteId) return;
    const parentFolderId = noteFolderMap[activeNoteId];
    if (!parentFolderId) return;

    const newExpanded: Record<number, boolean> = {};
    let currId: number | null = parentFolderId;
    while (currId && folderParentMap[currId] !== undefined) {
      newExpanded[currId] = true;
      currId = folderParentMap[currId] || null;
    }

    setExpandedFolders((prev) => ({ ...prev, ...newExpanded }));
  }, [activeNoteId, noteFolderMap, folderParentMap]);

  // Auto-expand all matching folders when search query is entered
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const q = searchQuery.toLowerCase();
    const autoExpand: Record<number, boolean> = {};

    const checkAndExpand = (node: FolderNode): boolean => {
      const folderMatches = node.folder.name.toLowerCase().includes(q);
      const noteMatches = node.notes.some(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.tags.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );

      let subfolderMatches = false;
      node.subfolders.forEach((sub) => {
        if (checkAndExpand(sub)) {
          subfolderMatches = true;
        }
      });

      const shouldExpand = folderMatches || noteMatches || subfolderMatches;
      if (shouldExpand) {
        autoExpand[node.folder.id] = true;
      }
      return shouldExpand;
    };

    rootNodes.forEach(checkAndExpand);
    setExpandedFolders((prev) => ({ ...prev, ...autoExpand }));
  }, [searchQuery, rootNodes]);

  const toggleFolder = (folderId: number) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "architecture":
        return <Layers className="w-3 h-3 text-emerald-400 shrink-0" />;
      case "snippet":
        return <Code className="w-3 h-3 text-indigo-400 shrink-0" />;
      case "journal":
        return <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />;
      default:
        return <Lightbulb className="w-3 h-3 text-purple-400 shrink-0" />;
    }
  };

  // Recursive helper to calculate total notes inside a folder including all nested subfolders
  const getDeepNoteCount = (fn: FolderNode): number => {
    let count = fn.notes.length;
    for (const sub of fn.subfolders) {
      count += getDeepNoteCount(sub);
    }
    return count;
  };

  const filterNode = (node: FolderNode, q: string): boolean => {
    if (!q) return true;
    const folderMatches = node.folder.name.toLowerCase().includes(q);
    const noteMatches = node.notes.some(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
    const subMatches = node.subfolders.some((sub) => filterNode(sub, q));
    return folderMatches || noteMatches || subMatches;
  };

  const filterNotes = (noteList: Note[], q: string): Note[] => {
    if (!q) return noteList;
    return noteList.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  };

  // Recursive Tree Item Component
  const FolderItem = ({ node, level = 0 }: { node: FolderNode; level?: number }) => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !filterNode(node, q)) return null;

    const isExpanded = !!expandedFolders[node.folder.id];
    const visibleNotes = filterNotes(node.notes, q);
    const visibleSubfolders = node.subfolders.filter((sub) => filterNode(sub, q));
    const isTargetDrag = dragOverFolderId === node.folder.id;

    return (
      <div className="space-y-1 select-none">
        {/* Folder Header Row */}
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("application/json", JSON.stringify({ folderId: node.folder.id }));
          }}
          onClick={() => toggleFolder(node.folder.id)}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (dragOverFolderId !== node.folder.id) {
              setDragOverFolderId(node.folder.id);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverFolderId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverFolderId(null);
            try {
              const dataStr = e.dataTransfer.getData("application/json");
              if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data.noteId) {
                  onMoveNoteToFolder?.(data.noteId, node.folder.id);
                } else if (data.folderId && data.folderId !== node.folder.id) {
                  onMoveFolderToFolder?.(data.folderId, node.folder.id);
                }
              }
            } catch (err) {}
          }}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          className={cn(
            "group py-1.5 pr-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors duration-150 border border-transparent",
            isExpanded ? "text-slate-200" : "text-slate-400",
            isTargetDrag ? "bg-indigo-600/25 border-indigo-500/40 text-indigo-200" : "hover:bg-white/5"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            <span className="p-0.5 text-slate-500 hover:text-slate-300">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </span>

            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            ) : (
              <FolderIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}

            <span className="truncate font-mono font-medium">{node.folder.name}</span>

            <span className="text-[10px] text-slate-500 font-bold ml-1">
              ({getDeepNoteCount(node)})
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Folder Actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={4}
                className="bg-[#141420]/95 border border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl w-44 font-mono text-xs z-50 space-y-1"
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNoteInFolder?.(node.folder.id);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>New Note</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(node.folder.id);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>New Subfolder</span>
                </DropdownMenuItem>

                {clipboardNote && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onPasteNoteToFolder?.(node.folder.id);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 cursor-pointer transition-colors"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Paste ({clipboardNote.action === "cut" ? "Move" : "Duplicate"})</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameFolder?.(node.folder);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Rename Folder</span>
                </DropdownMenuItem>

                <div className="my-1 border-t border-white/10" />

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(node.folder);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Delete Folder</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Collapsible Children (Subfolders & Notes) */}
        {isExpanded && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              if (dragOverFolderId !== node.folder.id) {
                setDragOverFolderId(node.folder.id);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverFolderId(null);
              try {
                const dataStr = e.dataTransfer.getData("application/json");
                if (dataStr) {
                  const data = JSON.parse(dataStr);
                  if (data.noteId) {
                    onMoveNoteToFolder?.(data.noteId, node.folder.id);
                  }
                }
              } catch (err) {}
            }}
            className={cn(
              "space-y-1 relative before:absolute before:left-3 before:top-0 before:bottom-0 before:w-px before:bg-white/10 rounded-xl transition-colors duration-150 border border-transparent",
              isTargetDrag && "bg-indigo-600/10 border-indigo-500/30"
            )}
          >
            {/* Subfolders */}
            {visibleSubfolders.map((subNode) => (
              <FolderItem key={subNode.folder.id} node={subNode} level={level + 1} />
            ))}

            {/* Notes inside folder */}
            {visibleNotes.map((note) => {
              const isActive = note.id === activeNoteId;
              const isCut = clipboardNote?.action === "cut" && clipboardNote.note.id === note.id;

              return (
                <div
                  key={note.id}
                  draggable
                  onDragStart={(e) => {
                    if (isDirty && note.id === activeNoteId) {
                      e.preventDefault();
                      onUnsavedActionAlert?.("moving this note to another folder");
                      return;
                    }
                    e.dataTransfer.setData("application/json", JSON.stringify({ noteId: note.id }));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onSelectNote(note)}
                  style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }}
                  className={cn(
                    "group py-1.5 pr-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all font-mono border border-transparent",
                    isActive
                      ? "bg-indigo-600/30 text-indigo-300 font-bold border-indigo-500/40 ring-1 ring-indigo-400/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                    isCut && "opacity-40 italic border-dashed border-amber-500/40"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getCategoryIcon(note.category)}
                    <span className="truncate">{note.title}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isActive && (
                      <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                    )}

                    {/* Note Item Dropdown Actions Menu */}
                    <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Note Actions"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="bottom"
                          sideOffset={4}
                          className="bg-[#141420]/95 border border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl w-40 font-mono text-xs z-50 space-y-1"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onCutNote?.(note);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 cursor-pointer transition-colors"
                          >
                            <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Cut</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyNote?.(note);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 cursor-pointer transition-colors"
                          >
                            <CopyIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>Duplicate</span>
                          </DropdownMenuItem>

                          {onDeleteNote && (
                            <>
                              <div className="my-1 border-t border-white/10" />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteNote(note);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span>Delete Note</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const filteredUnassigned = filterNotes(unassignedNotes, searchQuery.trim().toLowerCase());

  return (
    <div className="space-y-1 font-mono text-xs overflow-y-auto pr-1 scrollbar-thin flex-1">
      {rootNodes.length === 0 && unassignedNotes.length === 0 ? (
        <div className="p-4 text-center text-slate-500 italic text-xs">
          Vault is empty. Create a folder or note to begin.
        </div>
      ) : (
        <>
          {rootNodes.map((node) => (
            <FolderItem key={node.folder.id} node={node} level={0} />
          ))}

          {/* Root Unassigned Notes Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverFolderId !== "root") setDragOverFolderId("root");
            }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverFolderId(null);
              try {
                const dataStr = e.dataTransfer.getData("application/json");
                if (dataStr) {
                  const data = JSON.parse(dataStr);
                  if (data.noteId) {
                    onMoveNoteToFolder?.(data.noteId, null);
                  } else if (data.folderId) {
                    onMoveFolderToFolder?.(data.folderId, null);
                  }
                }
              } catch (err) {}
            }}
            className={cn(
              "pt-2 border-t border-white/10 mt-2 space-y-1 rounded-xl p-1 transition-all",
              dragOverFolderId === "root" && "bg-indigo-600/20 border border-indigo-500/40 ring-1 ring-indigo-400"
            )}
          >
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                Unassigned Notes
              </span>
              {clipboardNote && (
                <button
                  onClick={() => onPasteNoteToFolder?.(null)}
                  className="text-[10px] text-amber-400 hover:underline font-bold"
                >
                  Paste Here
                </button>
              )}
            </div>

            {filteredUnassigned.length === 0 ? (
              <div className="p-2 text-slate-600 text-[10px] italic">
                Drag notes here to remove from folders
              </div>
            ) : (
              filteredUnassigned.map((note) => {
                const isActive = note.id === activeNoteId;
                const isCut = clipboardNote?.action === "cut" && clipboardNote.note.id === note.id;

                return (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(e) => {
                      if (isDirty && note.id === activeNoteId) {
                        e.preventDefault();
                        onUnsavedActionAlert?.("moving this note to another folder");
                        return;
                      }
                      e.dataTransfer.setData("application/json", JSON.stringify({ noteId: note.id }));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onSelectNote(note)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all font-mono group border border-transparent",
                      isActive
                        ? "bg-indigo-600/30 text-indigo-300 font-bold border-indigo-500/40 ring-1 ring-indigo-400/40 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                      isCut && "opacity-40 italic border-dashed border-amber-500/40"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getCategoryIcon(note.category)}
                      <span className="truncate">{note.title}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isActive && (
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                      )}

                      {/* Note Actions Menu */}
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Note Actions"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            side="bottom"
                            sideOffset={4}
                            className="bg-[#141420]/95 border border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl w-40 font-mono text-xs z-50 space-y-1"
                          >
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onCutNote?.(note);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 cursor-pointer transition-colors"
                            >
                              <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Cut</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopyNote?.(note);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 cursor-pointer transition-colors"
                            >
                              <CopyIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>Duplicate</span>
                            </DropdownMenuItem>

                            {onDeleteNote && (
                              <>
                                <div className="my-1 border-t border-white/10" />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteNote(note);
                                  }}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>Delete Note</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
