"use client";

import React, { useState, useTransition } from "react";
import { Asset } from "@/db/schema";
import {
  createAssetAction,
  updateAssetAction,
  deleteAssetAction,
} from "@/app/inventory/actions";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  Link2,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Tag,
  Globe,
  Sparkles,
  FolderArchive,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

interface DigitalInventoryProps {
  initialAssets: Asset[];
}

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

import { useSearchParams } from "next/navigation";

export function DigitalInventory({ initialAssets }: DigitalInventoryProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [assetVisibleLimit, setAssetVisibleLimit] = useState<number>(6);
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Create Modal State
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"link" | "pdf" | "image" | "video">("link");
  const [newUrlOrPath, setNewUrlOrPath] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState("");
  const [newTags, setNewTags] = useState("");

  // Edit Modal State
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<"link" | "pdf" | "image" | "video">("link");
  const [editUrlOrPath, setEditUrlOrPath] = useState("");
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [editTags, setEditTags] = useState("");

  // Custom Glassmorphic Delete Confirmation Modal State (Popup Verif)
  const [deletingAssetConfirm, setDeletingAssetConfirm] = useState<Asset | null>(null);

  const openEditModal = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAsset(asset);
    setEditTitle(asset.title);
    setEditType((asset.type as any) || "link");
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
      (activeTab === "link" && asset.type === "link") ||
      (activeTab === "doc" && asset.type === "pdf") ||
      (activeTab === "media" && (asset.type === "image" || asset.type === "video"));

    return matchesSearch && matchesTab;
  });

  const getDomainFromUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace("www.", "");
    } catch {
      return urlStr.replace(/^https?:\/\//, "").split("/")[0] || "external";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-3.5 h-3.5 text-rose-400" />;
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      case "video":
        return <Video className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Link2 className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "pdf":
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-[10px] font-mono">
            DOCUMENT / PDF
          </Badge>
        );
      case "image":
        return (
          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px] font-mono">
            IMAGE ASSET
          </Badge>
        );
      case "video":
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px] font-mono">
            VIDEO RESOURCE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px] font-mono">
            BOOKMARK LINK
          </Badge>
        );
    }
  };

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrlOrPath.trim()) return;

    startTransition(async () => {
      await createAssetAction({
        title: newTitle,
        urlOrPath: newUrlOrPath,
        thumbnailUrl: newThumbnailUrl,
        tags: newTags,
      });
      setNewTitle("");
      setNewType("link");
      setNewUrlOrPath("");
      setNewThumbnailUrl("");
      setNewTags("");
      setIsAssetDialogOpen(false);
    });
  };

  const handleUpdateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !editTitle.trim() || !editUrlOrPath.trim()) return;

    startTransition(async () => {
      await updateAssetAction(editingAsset.id, {
        title: editTitle,
        urlOrPath: editUrlOrPath,
        thumbnailUrl: editThumbnailUrl,
        tags: editTags,
      });
      setEditingAsset(null);
    });
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10 shadow-lg">
        {/* Search & Tabs */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search bookmarks or tags..."
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
              { id: "all", label: "All Assets" },
              { id: "link", label: "Web Links" },
              { id: "doc", label: "Documents" },
              { id: "media", label: "Media" },
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

        {/* Add Asset Button */}
        <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
          <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "sm" }), "bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-4 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer shrink-0")}>
            <Plus className="w-4 h-4" /> Register Asset
          </DialogTrigger>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
            <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-indigo-400" /> REGISTER NEW ASSET
              </DialogTitle>
              <button
                onClick={() => setIsAssetDialogOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>
            <form onSubmit={handleCreateAsset} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
              <div className="overflow-y-auto flex-1 pr-1.5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Asset Title *</label>
                  <Input
                    autoFocus
                    required
                    placeholder="e.g. Next.js 16 App Router Specs"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Asset Type *</label>
                  <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[180px]">
                      <SelectItem value="link" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Link Bookmark</SelectItem>
                      <SelectItem value="pdf" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Document / PDF</SelectItem>
                      <SelectItem value="image" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Image Asset</SelectItem>
                      <SelectItem value="video" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Video Resource</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Target Website / Resource URL *</label>
                  <Input
                    required
                    placeholder="e.g. https://youtu.be/..."
                    value={newUrlOrPath}
                    onChange={(e) => setNewUrlOrPath(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
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
                    value={newThumbnailUrl}
                    onChange={(e) => setNewThumbnailUrl(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Tags (Comma-separated)</label>
                  <Input
                    placeholder="e.g. docs, video, nextjs"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>
              </div>

              <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3">
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                  {isPending ? "Registering..." : "Save Asset"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Asset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full py-16 glass-panel rounded-3xl border border-white/10 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
            No assets found in vault
          </div>
        ) : (
          filteredAssets.slice(0, assetVisibleLimit).map((asset) => {
            const tagList = asset.tags ? asset.tags.split(",").map((t) => t.trim()) : [];
            const domain = asset.type === "link" ? getDomainFromUrl(asset.urlOrPath) : null;

            // Auto-resolve YouTube thumbnail if missing
            const resolvedThumbnail = asset.thumbnailUrl || extractYouTubeThumbnail(asset.urlOrPath);

            return (
              <div
                key={asset.id}
                className="glass-panel p-4 rounded-3xl flex flex-col justify-between relative group border border-white/10 hover:border-indigo-500/40 transition-all shadow-md overflow-hidden"
              >
                {/* Thumbnail Header Area */}
                <div className="relative w-full h-36 rounded-2xl bg-black/40 overflow-hidden mb-3.5 border border-white/10 flex items-center justify-center">
                  {resolvedThumbnail ? (
                    <img
                      src={resolvedThumbnail}
                      alt={asset.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500 font-mono text-xs">
                      {getTypeIcon(asset.type)}
                      <span className="uppercase text-[10px]">PREVIEW</span>
                    </div>
                  )}

                  {/* Translucent Type Overlay Pill */}
                  <div className="absolute top-2.5 left-2.5">
                    {getTypeBadge(asset.type)}
                  </div>
                </div>

                {/* Card Main Info */}
                <div className="space-y-2 flex-1">
                  {/* Domain indicator */}
                  {domain && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-400">
                      <Globe className="w-3 h-3" />
                      <span>{domain}</span>
                    </div>
                  )}

                  <h3 className="text-sm font-bold text-white font-sans group-hover:text-indigo-300 transition-colors line-clamp-2">
                    {asset.title}
                  </h3>

                  {/* URL Display */}
                  <p className="text-[11px] font-mono text-slate-400 truncate bg-white/[0.03] border border-white/10 p-2 rounded-xl">
                    {asset.urlOrPath}
                  </p>

                  {/* Tag Chips */}
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
                    <span>Open Resource</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isPending}
                      onClick={(e) => openEditModal(asset, e)}
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer"
                      title="Edit asset"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingAssetConfirm(asset);
                      }}
                      className="w-8 h-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      title="Delete asset"
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

      {/* Show More / Show Less Expander Button */}
      {filteredAssets.length > 6 && (
        <div className="flex justify-center pt-2">
          {assetVisibleLimit < filteredAssets.length ? (
            <Button
              onClick={() => setAssetVisibleLimit(filteredAssets.length)}
              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-mono text-xs rounded-2xl h-10 px-6 gap-2 shadow-lg cursor-pointer transition-all"
            >
              Show More (+{filteredAssets.length - assetVisibleLimit} more bookmarks)
            </Button>
          ) : (
            <Button
              onClick={() => setAssetVisibleLimit(6)}
              variant="outline"
              className="border-white/15 text-slate-400 hover:text-white font-mono text-xs rounded-2xl h-10 px-6 cursor-pointer"
            >
              Show Less
            </Button>
          )}
        </div>
      )}

      {/* Edit Bookmark Modal Dialog */}
      {editingAsset && (
        <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md max-h-[88vh] p-6 shadow-2xl backdrop-blur-2xl flex flex-col font-mono">
            <DialogHeader className="shrink-0 flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" /> EDIT ASSET
              </DialogTitle>
              <button
                onClick={() => setEditingAsset(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>
            <form onSubmit={handleUpdateAsset} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
              <div className="overflow-y-auto flex-1 pr-1.5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Asset Title</label>
                  <Input
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Asset Type</label>
                  <Select value={editType} onValueChange={(val: any) => setEditType(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[180px]">
                      <SelectItem value="link" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Link Bookmark</SelectItem>
                      <SelectItem value="pdf" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Document / PDF</SelectItem>
                      <SelectItem value="image" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Image Asset</SelectItem>
                      <SelectItem value="video" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Video Resource</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Website / Resource URL</label>
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
              </div>

              <DialogFooter className="shrink-0 pt-3 border-t border-white/10 mt-3">
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                  {isPending ? "Saving..." : "Update Asset"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC DELETE ASSET CONFIRMATION DIALOG (Popup Verif) */}
      {deletingAssetConfirm && (
        <Dialog open={!!deletingAssetConfirm} onOpenChange={() => setDeletingAssetConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE ASSET BOOKMARK</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingAssetConfirm.title}&quot;</span> from your asset vault?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingAssetConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingAssetConfirm.id;
                  startTransition(async () => {
                    await deleteAssetAction(id);
                    setDeletingAssetConfirm(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Asset"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
