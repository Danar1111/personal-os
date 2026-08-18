"use client";

import React, { useState, useTransition, useRef } from "react";
import { Asset } from "@/db/schema";
import {
  createDriveAssetAction,
  updateDriveAssetAction,
  deleteDriveAssetAction,
} from "@/app/drive/actions";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Download,
  UploadCloud,
  HardDrive,
  Grid,
  List as ListIcon,
  AlertTriangle,
  X,
  File,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useLocalUploadStore } from "@/lib/store/useLocalUploadStore";

interface LocalDriveProps {
  initialAssets: Asset[];
}

import { useSearchParams } from "next/navigation";

export function LocalDrive({ initialAssets }: LocalDriveProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [driveVisibleLimit, setDriveVisibleLimit] = useState<number>(6);
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // File Upload Modal State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customTags, setCustomTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const localUpload = useLocalUploadStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Modal State
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<"pdf" | "image" | "video">("pdf");
  const [editUrlOrPath, setEditUrlOrPath] = useState("");
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [editTags, setEditTags] = useState("");

  // Custom Glassmorphic Delete Confirmation Modal State (Popup Verif)
  const [deletingFileConfirm, setDeletingFileConfirm] = useState<Asset | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!customTitle) {
      setCustomTitle(file.name);
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const openEditModal = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAsset(asset);
    setEditTitle(asset.title);
    setEditType((asset.type as any) || "pdf");
    setEditUrlOrPath(asset.urlOrPath);
    setEditThumbnailUrl(asset.thumbnailUrl || "");
    setEditTags(asset.tags || "");
  };

  // Filter assets
  const filteredAssets = initialAssets.filter((asset) => {
    const matchesSearch =
      asset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.urlOrPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.tags.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pdf" && asset.type === "pdf") ||
      (activeTab === "image" && asset.type === "image") ||
      (activeTab === "video" && asset.type === "video");

    return matchesSearch && matchesTab;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-4 h-4 text-purple-400" />;
      case "video":
        return <Video className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-rose-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "image":
        return (
          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px] font-mono">
            IMAGE
          </Badge>
        );
      case "video":
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px] font-mono">
            VIDEO
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-[10px] font-mono">
            DOCUMENT (PDF)
          </Badge>
        );
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);

    // Capture values before closing modal
    const file = selectedFile;
    const title = customTitle.trim() || file.name;
    const tags = customTags;
    const itemId = `local-${Date.now()}`;

    // Close modal immediately — progress shown in global bottom-right widget
    setIsUploadDialogOpen(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCustomTitle("");
    setCustomTags("");

    localUpload.startItem({ id: itemId, name: file.name, size: file.size });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload", true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      xhr.setRequestHeader("X-File-Type", file.type || "application/octet-stream");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          localUpload.updateProgress(itemId, percent, event.loaded);
        }
      };

      const result: any = await new Promise((resolve, reject) => {
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

      startTransition(async () => {
        await createDriveAssetAction({
          title,
          type: result.type || "pdf",
          urlOrPath: result.url,
          thumbnailUrl: result.type === "image" ? result.url : undefined,
          tags,
          sizeBytes: result.size || file.size,
        });
        setIsUploading(false);
      });
    } catch (err: any) {
      localUpload.errorItem(itemId, err.message);
      console.error("Upload error:", err);
      alert(`Upload error: ${err.message || "Failed to upload file"}`);
      setIsUploading(false);
    }
  };

  const handleUpdateDriveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !editTitle.trim() || !editUrlOrPath.trim()) return;

    startTransition(async () => {
      await updateDriveAssetAction(editingAsset.id, {
        title: editTitle,
        type: editType,
        urlOrPath: editUrlOrPath,
        thumbnailUrl: editThumbnailUrl,
        tags: editTags,
      });
      setEditingAsset(null);
    });
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10 shadow-lg">
        {/* Search & Type Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search local files, paths, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl shrink-0 font-mono text-xs">
            {[
              { id: "all", label: "All Files" },
              { id: "pdf", label: "PDF Documents" },
              { id: "image", label: "Images" },
              { id: "video", label: "Videos" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                  activeTab === tab.id
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle & Upload Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-xl text-slate-400 transition-colors cursor-pointer",
                viewMode === "grid" && "bg-indigo-600/30 text-indigo-300"
              )}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-xl text-slate-400 transition-colors cursor-pointer",
                viewMode === "list" && "bg-indigo-600/30 text-indigo-300"
              )}
              title="Table View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Professional Upload File Modal */}
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "sm" }), "bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-4 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer")}>
              <UploadCloud className="w-4 h-4" /> Upload File
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
              <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
                <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-400" /> UPLOAD FILE TO LOCAL DRIVE
                </DialogTitle>
                <button
                  onClick={() => setIsUploadDialogOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </DialogHeader>

              <form onSubmit={handleFileUpload} className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center relative overflow-hidden",
                    isDragging
                      ? "border-indigo-400 bg-indigo-500/20 scale-[1.02]"
                      : selectedFile
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="space-y-2 w-full flex flex-col items-center">
                      {previewUrl ? (
                        <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/20 shadow-md mb-1">
                          <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mb-1">
                          <File className="w-6 h-6" />
                        </div>
                      )}

                      <div className="text-center w-full px-2">
                        <p className="text-xs font-bold text-white truncate max-w-[280px] mx-auto">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "Document"}
                        </p>
                      </div>

                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/20 text-[10px] font-mono gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready to Upload
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                        <UploadCloud className="w-6 h-6 animate-bounce" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white font-mono">
                          Drag &amp; Drop file here, or <span className="text-indigo-400 underline">browse</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Supports PDF, Images, Videos, &amp; local media documents
                        </p>
                      </div>
                    </div>
                  )}
                </div>




                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Display Title (Optional)</label>
                  <Input
                    placeholder="e.g. System Architecture Diagram"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Tags (Comma-separated)</label>
                  <Input
                    placeholder="e.g. pdf, spec, system"
                    value={customTags}
                    onChange={(e) => setCustomTags(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={!selectedFile || isUploading || isPending}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    {isUploading ? "Uploading file..." : "Upload & Save Record"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid or Table Explorer View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.length === 0 ? (
            <div className="col-span-full py-16 glass-panel rounded-3xl border border-white/10 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
              No files in Local Drive matching filter
            </div>
          ) : (
            filteredAssets.slice(0, driveVisibleLimit).map((asset) => {
              const tagList = asset.tags ? asset.tags.split(",").map((t) => t.trim()) : [];
              return (
                <div
                  key={asset.id}
                  className="glass-panel p-4 rounded-3xl flex flex-col justify-between relative group border border-white/10 hover:border-indigo-500/40 transition-all shadow-md overflow-hidden"
                >
                  {/* File Preview Header */}
                  <div className="relative w-full h-36 rounded-2xl bg-black/40 overflow-hidden mb-3.5 border border-white/10 flex items-center justify-center">
                    {asset.type === "image" && asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400 font-mono text-xs">
                        {getTypeIcon(asset.type)}
                        <span className="uppercase text-[10px] text-slate-500">{asset.type} FILE</span>
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5">
                      {getTypeBadge(asset.type)}
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="space-y-2 flex-1">
                    <h3 className="text-sm font-bold text-white font-sans group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {asset.title}
                    </h3>

                    <p className="text-[11px] font-mono text-slate-400 truncate bg-white/[0.03] border border-white/10 p-2 rounded-xl">
                      {asset.urlOrPath}
                    </p>

                    {tagList.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        {tagList.map((tag, i) => (
                          <span key={i} className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Controls */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                    <a
                      href={asset.urlOrPath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download / Open
                    </a>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isPending}
                        onClick={(e) => openEditModal(asset, e)}
                        className="w-8 h-8 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer"
                        title="Edit file details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingFileConfirm(asset);
                        }}
                        className="w-8 h-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Table Explorer View */
        <div className="glass-panel p-4 rounded-3xl border border-white/10 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="pb-3 px-3">Type</th>
                <th className="pb-3 px-3">Title</th>
                <th className="pb-3 px-3">Local Path</th>
                <th className="pb-3 px-3">Tags</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAssets.slice(0, driveVisibleLimit).map((asset) => (
                <tr key={asset.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="py-3 px-3 flex items-center gap-2">
                    {getTypeIcon(asset.type)}
                    <span className="uppercase text-[10px] text-slate-300 font-semibold">{asset.type}</span>
                  </td>
                  <td className="py-3 px-3 font-sans font-semibold text-white">{asset.title}</td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">{asset.urlOrPath}</td>
                  <td className="py-3 px-3 text-slate-400 text-[10px]">{asset.tags || "-"}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={asset.urlOrPath}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => openEditModal(asset, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingFileConfirm(asset);
                        }}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show More / Show Less Expander Button */}
      {filteredAssets.length > 6 && (
        <div className="flex justify-center pt-2">
          {driveVisibleLimit < filteredAssets.length ? (
            <Button
              onClick={() => setDriveVisibleLimit(filteredAssets.length)}
              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-mono text-xs rounded-2xl h-10 px-6 gap-2 shadow-lg cursor-pointer transition-all"
            >
              Show More (+{filteredAssets.length - driveVisibleLimit} more files)
            </Button>
          ) : (
            <Button
              onClick={() => setDriveVisibleLimit(6)}
              variant="outline"
              className="border-white/15 text-slate-400 hover:text-white font-mono text-xs rounded-2xl h-10 px-6 cursor-pointer"
            >
              Show Less
            </Button>
          )}
        </div>
      )}

      {/* Edit File Modal Dialog */}
      {editingAsset && (
        <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" /> EDIT FILE DETAILS
              </DialogTitle>
              <button
                onClick={() => setEditingAsset(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <form onSubmit={handleUpdateDriveAsset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">File Title</label>
                <Input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">File Type</label>
                <Select value={editType} onValueChange={(val: any) => setEditType(val)}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                    <SelectValue placeholder="Select file type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[180px]">
                    <SelectItem value="pdf" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Document (PDF)</SelectItem>
                    <SelectItem value="image" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Image Asset</SelectItem>
                    <SelectItem value="video" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Video Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">File Path / URL</label>
                <Input
                  required
                  value={editUrlOrPath}
                  onChange={(e) => setEditUrlOrPath(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Thumbnail URL</label>
                <Input
                  value={editThumbnailUrl}
                  onChange={(e) => setEditThumbnailUrl(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Tags</label>
                <Input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                  {isPending ? "Saving..." : "Update File Details"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC DELETE FILE CONFIRMATION DIALOG (Popup Verif) */}
      {deletingFileConfirm && (
        <Dialog open={!!deletingFileConfirm} onOpenChange={() => setDeletingFileConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE DRIVE FILE</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingFileConfirm.title}&quot;</span> from your Local Storage Drive?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">If stored in /public/uploads, the file will be unlinked from disk.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingFileConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingFileConfirm.id;
                  startTransition(async () => {
                    await deleteDriveAssetAction(id);
                    setDeletingFileConfirm(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete File"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
