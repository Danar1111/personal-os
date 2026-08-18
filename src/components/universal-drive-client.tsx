"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import {
  HardDrive,
  Cloud,
  UploadCloud,
  Download,
  ExternalLink,
  Search,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  File,
  Image as ImageIcon,
  Film,
  Music,
  Presentation,
  Grid,
  List as ListIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Folder,
  Eye,
  ChevronDown,
  X,
  Trash2,
  Check,
  ShieldCheck,
  CloudOff,
  Layers,
  Filter,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Asset } from "@/db/schema";
import { FilePreviewModal, PreviewableFile } from "@/components/file-preview-modal";
import {
  saveSyncFolderAction,
  deleteLocalCopiesAction,
  deleteFromDriveAndDbAction,
  getDriveAssets,
  createDriveAssetAction,
} from "@/app/drive/actions";
import { useUploadStore } from "@/lib/store/useUploadStore";
import { cn } from "@/lib/utils";

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  path?: string;
}

interface UniversalDriveClientProps {
  initialAssets: Asset[];
  initialSyncFolder?: { folderId: string; folderName: string };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error: any = new Error(errorData.error || "Failed to fetch Drive files");
    error.status = res.status;
    throw error;
  }
  return res.json();
};

function formatBytes(bytes: number | string | undefined | null): string {
  if (!bytes) return "—";
  const num = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num === 0) return "—";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateVal?: string | Date | null): string {
  if (!dateVal) return "—";
  try {
    const date = new Date(dateVal);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateVal);
  }
}

/**
 * Custom Dark-Mode Styled Checkbox
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

/**
 * Returns customized, distinct, color-coded file icons matching the file type
 * Supports Google Drive official iconLink image icons
 */
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

  // 2. Spreadsheets (Excel, CSV, Sheets)
  if (
    ["csv", "xlsx", "xls"].includes(lowerExt) ||
    lowerMime.includes("spreadsheet") ||
    lowerMime.includes("sheet")
  ) {
    return (
      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
        <FileSpreadsheet className="w-4 h-4" />
      </div>
    );
  }

  // 3. Presentations (PowerPoint, Slides)
  if (["pptx", "ppt", "key"].includes(lowerExt) || lowerMime.includes("presentation")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
        <Presentation className="w-4 h-4" />
      </div>
    );
  }

  // 4. Documents (Word, Docs)
  if (
    ["doc", "docx", "rtf", "odt"].includes(lowerExt) ||
    lowerMime.includes("document") ||
    lowerMime.includes("word")
  ) {
    return (
      <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  }

  // 5. Code & Jupyter Notebooks
  if (["ipynb", "colab"].includes(lowerExt) || lowerMime.includes("colaboratory")) {
    return (
      <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-sm shrink-0">
        <FileCode className="w-4 h-4" />
      </div>
    );
  }

  if (
    ["ts", "tsx", "js", "jsx", "json", "py", "html", "css", "sql", "sh"].includes(lowerExt) ||
    lowerMime.includes("javascript") ||
    lowerMime.includes("json") ||
    lowerMime.includes("code")
  ) {
    return (
      <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-sm shrink-0">
        <FileCode className="w-4 h-4" />
      </div>
    );
  }

  // 6. Images
  if (
    ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(lowerExt) ||
    lowerMime.startsWith("image/")
  ) {
    return (
      <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-sm shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  // 7. Audio
  if (
    ["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(lowerExt) ||
    lowerMime.startsWith("audio/")
  ) {
    return (
      <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
        <Music className="w-4 h-4" />
      </div>
    );
  }

  // 8. Video
  if (
    ["mp4", "webm", "mkv", "mov", "avi"].includes(lowerExt) ||
    lowerMime.startsWith("video/")
  ) {
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

function getFileExtension(title: string, urlOrPath: string): string {
  const name = title || urlOrPath || "";
  const match = name.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
  return match ? match[1].toLowerCase() : "file";
}

export function UniversalDriveClient({
  initialAssets,
  initialSyncFolder = { folderId: "root", folderName: "Root (My Drive)" },
}: UniversalDriveClientProps) {
  const [activeTab, setActiveTab] = useState("local");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Local Assets State
  const [assetsList, setAssetsList] = useState<Asset[]>(initialAssets);
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload Modal State (Bulk Upload & Auto-Category)
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTags, setUploadTags] = useState("");
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [autoSyncToDrive, setAutoSyncToDrive] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Custom Glassmorphic Delete Confirmation Modal State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    mode: "drive_and_db" | "local_copies_only";
    targetIds: number[];
    singleTitle?: string;
  }>({
    isOpen: false,
    mode: "drive_and_db",
    targetIds: [],
  });

  // Preview Modal state
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Destination Folder State
  const [selectedFolderId, setSelectedFolderId] = useState<string>(initialSyncFolder.folderId);
  const [selectedFolderName, setSelectedFolderName] = useState<string>(initialSyncFolder.folderName);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const folderPickerRef = useRef<HTMLDivElement>(null);

  // Upload Store
  const { addToQueue, queue } = useUploadStore();

  // Close folder picker on click outside
  useEffect(() => {
    if (!folderPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setFolderPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [folderPickerOpen]);

  // Debounce search query for Google Drive API search (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce folder search query (300ms)
  const [debouncedFolderQuery, setDebouncedFolderQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFolderQuery(folderSearchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [folderSearchQuery]);

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  // Google Drive Files SWR — dynamically queries the API when searching!
  const driveApiUrl = debouncedQuery
    ? `/api/drive/list?q=${encodeURIComponent(debouncedQuery)}`
    : "/api/drive/list";

  const {
    data: googleData,
    error: googleError,
    isLoading: isGoogleLoading,
    mutate: refreshGoogleDrive,
  } = useSWR<{ files: GoogleDriveFile[] }>(driveApiUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    keepPreviousData: true,
  });

  // Google Drive Folders SWR
  const folderApiUrl = debouncedFolderQuery
    ? `/api/drive/folders?q=${encodeURIComponent(debouncedFolderQuery)}`
    : "/api/drive/folders";

  const { data: folderData, mutate: refreshFolders, isLoading: isFolderLoading } = useSWR<{
    folders: GoogleDriveFolder[];
  }>(folderApiUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const googleFolders = useMemo(() => {
    return folderData?.folders || [];
  }, [folderData]);

  // Update selected folder name if folders list loads
  useEffect(() => {
    if (googleFolders.length > 0 && selectedFolderId !== "root") {
      const match = googleFolders.find((f) => f.id === selectedFolderId);
      if (match && match.name !== selectedFolderName) {
        setSelectedFolderName(match.name);
      }
    }
  }, [googleFolders, selectedFolderId, selectedFolderName]);

  // Handle folder change with DB persistence
  const handleSelectFolder = async (folder: GoogleDriveFolder) => {
    setSelectedFolderId(folder.id);
    setSelectedFolderName(folder.name);
    setFolderPickerOpen(false);

    try {
      await saveSyncFolderAction(folder.id, folder.name);
      triggerFeedback(`✓ Target folder saved to database: ${folder.name}`);
    } catch (err) {
      console.error("Failed to persist sync folder:", err);
    }
  };

  // Filter Local Assets based on search
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assetsList;
    const q = searchQuery.toLowerCase();
    return assetsList.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.urlOrPath.toLowerCase().includes(q) ||
        (a.tags && a.tags.toLowerCase().includes(q))
    );
  }, [assetsList, searchQuery]);

  // Synced vs Unsynced assets for quick selection
  const syncedAssets = useMemo(
    () =>
      filteredAssets.filter(
        (a) => a.syncStatus === "SYNCED_LOCAL_KEPT" || a.syncStatus === "CLOUD_ONLY"
      ),
    [filteredAssets]
  );

  const unsyncedAssets = useMemo(
    () =>
      filteredAssets.filter(
        (a) => a.syncStatus === "LOCAL_UNSYNCED" || !a.syncStatus
      ),
    [filteredAssets]
  );

  // Filter Google Drive files based on search
  const googleFiles = googleData?.files || [];
  const filteredGoogleFiles = useMemo(() => {
    if (!searchQuery.trim()) return googleFiles;
    const q = searchQuery.toLowerCase();
    return googleFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [googleFiles, searchQuery]);

  // Initial sync & fetch to ensure auto-reconciliation with Google Drive is loaded
  useEffect(() => {
    getDriveAssets()
      .then((fresh) => {
        if (fresh && fresh.length > 0) {
          setAssetsList(fresh);
        }
      })
      .catch((err) => console.warn("Failed to fetch latest drive assets:", err));
  }, []);

  // Listen for upload completions from useUploadStore to instantly update local assets state in real time!
  useEffect(() => {
    const completedWithAsset = queue.filter(
      (q) => q.status === "completed" && q.assetId && q.gdriveId
    );

    if (completedWithAsset.length > 0) {
      setAssetsList((prevList) => {
        let changed = false;
        const updatedList = prevList.map((asset) => {
          const match = completedWithAsset.find((q) => q.assetId === asset.id);
          if (
            match &&
            (asset.syncStatus !== "SYNCED_LOCAL_KEPT" || asset.gdriveId !== match.gdriveId)
          ) {
            changed = true;
            return {
              ...asset,
              syncStatus: "SYNCED_LOCAL_KEPT",
              gdriveId: match.gdriveId || null,
            };
          }
          return asset;
        });
        return changed ? updatedList : prevList;
      });

      refreshGoogleDrive();
    }
  }, [queue, refreshGoogleDrive]);

  const isGoogleUnauthorized = googleError?.status === 401;

  // Selection handlers
  const isAllSelected =
    filteredAssets.length > 0 &&
    filteredAssets.every((a) => selectedAssetIds.includes(a.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(filteredAssets.map((a) => a.id));
    }
  };

  const handleSelectAll = () => {
    setSelectedAssetIds(filteredAssets.map((a) => a.id));
  };

  const handleSelectSynced = () => {
    setSelectedAssetIds(syncedAssets.map((a) => a.id));
  };

  const handleSelectUnsynced = () => {
    setSelectedAssetIds(unsyncedAssets.map((a) => a.id));
  };

  const toggleSelectAsset = (id: number) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Sync Single Asset via Resumable Client Upload Queue
  const handleSyncAsset = (asset: Asset) => {
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
    triggerFeedback(`✓ Queued "${asset.title}" for Google Drive upload`);
  };

  // Sync Selected Assets in Bulk
  const handleSyncSelected = () => {
    if (selectedAssetIds.length === 0) return;
    const selected = assetsList.filter((a) => selectedAssetIds.includes(a.id));
    const items = selected.map((asset) => ({
      id: `asset-${asset.id}`,
      assetId: asset.id,
      name: asset.title,
      size: asset.sizeBytes || 0,
      localPath: asset.urlOrPath,
      folderId: selectedFolderId,
      folderName: selectedFolderName,
    }));

    addToQueue(items);
    triggerFeedback(`✓ Queued ${items.length} file(s) for direct Google Drive sync`);
    setSelectedAssetIds([]);
  };

  // Helper to detect file type category from mime/extension
  const detectFileType = (file: File): "pdf" | "image" | "video" => {
    const name = file.name.toLowerCase();
    const ext = name.split(".").pop() || "";
    if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(ext)) {
      return "image";
    }
    if (file.type.startsWith("video/") || ["mp4", "webm", "mkv", "mov", "avi", "wmv", "flv"].includes(ext)) {
      return "video";
    }
    return "pdf";
  };

  // Handle selecting multiple files in upload modal
  const handleFilesSelect = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    setUploadFiles((prev) => {
      // Append new files avoiding duplicates by name and size
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newUnique = filesArray.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      return [...prev, ...newUnique];
    });
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Bulk Upload Form (Local upload + optional direct Google Drive sync)
  const handleFormUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      triggerFeedback("⚠️ Please select at least one file to upload");
      return;
    }

    setIsSubmittingUpload(true);
    let successCount = 0;
    const queuedItems: any[] = [];

    try {
      for (const file of uploadFiles) {
        try {
          const formData = new FormData();
          formData.append("file", file, file.name);

          let res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          // Fallback: If FormData body parsing fails in environment, send direct binary stream with headers
          if (!res.ok) {
            res = await fetch("/api/upload", {
              method: "POST",
              headers: {
                "Content-Type": file.type || "application/octet-stream",
                "X-File-Name": encodeURIComponent(file.name),
                "X-File-Type": file.type || "application/octet-stream",
              },
              body: file,
            });
          }

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Failed to upload "${file.name}"`);
          }

          const fileData = await res.json();
          const category = detectFileType(file);

          const created = await createDriveAssetAction({
            title: file.name,
            type: category,
            urlOrPath: fileData.url,
            tags: uploadTags.trim(),
            sizeBytes: fileData.size,
            syncStatus: "LOCAL_UNSYNCED",
          });

          successCount++;

          if (autoSyncToDrive) {
            queuedItems.push({
              id: `asset-${created.id || Date.now()}-${Math.random()}`,
              assetId: created.id,
              name: file.name,
              size: fileData.size,
              localPath: fileData.url,
              file: file,
              folderId: selectedFolderId,
              folderName: selectedFolderName,
            });
          }
        } catch (fileErr: any) {
          console.error(`Error uploading file ${file.name}:`, fileErr);
        }
      }

      if (autoSyncToDrive && queuedItems.length > 0) {
        addToQueue(queuedItems);
        triggerFeedback(`✓ ${successCount} file(s) saved locally & queued for Google Drive sync!`);
      } else {
        triggerFeedback(`✓ ${successCount} file(s) saved to Local Storage!`);
      }

      // Reset modal state
      setIsUploadOpen(false);
      setUploadFiles([]);
      setUploadTags("");

      const updated = await getDriveAssets();
      setAssetsList(updated);
    } catch (err: any) {
      console.error(err);
      triggerFeedback(`⚠️ Upload failed: ${err.message}`);
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  // Open Delete Confirmation Dialogs
  const requestDeleteFromDriveAndDb = (assetIdsToDelete?: number[], title?: string) => {
    const targetIds = assetIdsToDelete || selectedAssetIds;
    if (targetIds.length === 0) return;

    setDeleteConfirmState({
      isOpen: true,
      mode: "drive_and_db",
      targetIds,
      singleTitle:
        title ||
        (targetIds.length === 1
          ? assetsList.find((a) => a.id === targetIds[0])?.title
          : undefined),
    });
  };

  const requestDeleteLocalCopies = () => {
    if (selectedAssetIds.length === 0) return;

    setDeleteConfirmState({
      isOpen: true,
      mode: "local_copies_only",
      targetIds: selectedAssetIds,
      singleTitle:
        selectedAssetIds.length === 1
          ? assetsList.find((a) => a.id === selectedAssetIds[0])?.title
          : undefined,
    });
  };

  // Execute Confirmed Delete Operation
  const handleConfirmDelete = async () => {
    const { mode, targetIds } = deleteConfirmState;
    if (targetIds.length === 0) {
      setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    setIsDeleting(true);
    setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));

    try {
      if (mode === "drive_and_db") {
        const res = await deleteFromDriveAndDbAction(targetIds);
        if (res.errors && res.errors.length > 0) {
          triggerFeedback(
            `✓ Deleted ${res.deletedCount} file(s) (Warnings: ${res.errors.join("; ")})`
          );
        } else {
          triggerFeedback(
            `✓ Successfully deleted ${res.deletedCount} file(s) from Drive & Storage.`
          );
        }
        setSelectedAssetIds((prev) => prev.filter((id) => !targetIds.includes(id)));
        const updated = await getDriveAssets();
        setAssetsList(updated);
        refreshGoogleDrive();
      } else {
        const res = await deleteLocalCopiesAction(targetIds);
        triggerFeedback(`✓ Freed disk space. ${res.modifiedCount} file(s) updated.`);
        setSelectedAssetIds([]);
        const updated = await getDriveAssets();
        setAssetsList(updated);
      }
    } catch (err: any) {
      triggerFeedback(`⚠️ Operation failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Refresh assets and cloud files
  const handleRefreshAll = async () => {
    try {
      const updated = await getDriveAssets();
      setAssetsList(updated);
      refreshGoogleDrive();
      refreshFolders();
      triggerFeedback("✓ Refreshed storage lists");
    } catch (err) {
      console.error(err);
    }
  };

  // Preview Asset
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

  // Preview Google Drive File
  const openGoogleDrivePreview = (file: GoogleDriveFile) => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() || "cloud" : "cloud";
    setPreviewFile({
      title: file.name,
      urlOrPath: file.webViewLink || "",
      source: "google",
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size, 10) : undefined,
      googleFileId: file.id,
      webViewLink: file.webViewLink,
      extension: ext,
    });
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback Notification */}
      {feedback && (
        <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-xs font-mono flex items-center justify-between shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs Layout */}
      <Tabs defaultValue="local" className="space-y-4" onValueChange={setActiveTab}>
        {/* COMPACT COMMAND BAR (Tabs + Search + Target Folder + Controls) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 px-4 rounded-3xl bg-white/[0.02] border border-white/10 shadow-xl backdrop-blur-xl">
          {/* Left: Tab Triggers */}
          <TabsList className="bg-white/[0.03] border-white/10 p-1 rounded-2xl shrink-0">
            <TabsTrigger
              value="local"
              className="rounded-xl px-4 py-2 text-xs font-mono font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg cursor-pointer flex items-center gap-2 transition-all"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Local Storage</span>
              <Badge
                variant="outline"
                className="ml-1 text-[10px] px-1.5 py-0 border-white/10 text-slate-300"
              >
                {assetsList.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="google"
              className="rounded-xl px-4 py-2 text-xs font-mono font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg cursor-pointer flex items-center gap-2 transition-all"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Google Drive</span>
              {googleFiles.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 text-[10px] px-1.5 py-0 border-white/10 text-slate-300"
                >
                  {googleFiles.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Middle: Live Search Bar */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "local"
                  ? "Search local assets..."
                  : "Search Google Drive API..."
              }
              className="pl-9 pr-8 bg-white/[0.04] border-white/10 text-xs text-white placeholder:text-slate-500 rounded-2xl h-9 font-mono focus-visible:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Destination Folder Picker & View Controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Searchable Google Drive Destination Folder Dropdown */}
            <div className="relative" ref={folderPickerRef}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setFolderPickerOpen(!folderPickerOpen)}
                className="bg-white/[0.04] border-white/15 hover:bg-white/10 text-slate-300 rounded-2xl h-9 px-3 font-mono text-xs gap-1.5 max-w-[220px] cursor-pointer truncate shadow-sm"
                title={`Target Sync Folder: ${selectedFolderName}`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate max-w-[140px] text-slate-200">
                  {selectedFolderName}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3 h-3 text-slate-500 shrink-0 transition-transform",
                    folderPickerOpen && "rotate-180"
                  )}
                />
              </Button>

              {folderPickerOpen && (
                <div className="absolute right-0 top-11 w-88 p-2.5 bg-[#12121c] border border-white/15 text-white rounded-2xl shadow-2xl font-mono text-xs z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span>Sync Target Folder:</span>
                      <Badge
                        variant="outline"
                        className="text-[9px] border-white/10 text-blue-400 bg-blue-500/10"
                      >
                        MySQL Persisted
                      </Badge>
                    </div>
                    {/* Search inside folders */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        autoFocus
                        value={folderSearchQuery}
                        onChange={(e) => setFolderSearchQuery(e.target.value)}
                        placeholder="Search folder name or path..."
                        className="pl-8 bg-white/[0.05] border-white/10 text-xs text-white placeholder:text-slate-500 rounded-xl h-8 font-mono"
                      />
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 mt-1.5 scrollbar-thin pr-1">
                    {isFolderLoading ? (
                      <div className="p-3 text-center text-slate-500 text-xs">
                        Loading folders & paths...
                      </div>
                    ) : googleFolders.length === 0 ? (
                      <div className="p-3 text-center text-slate-500 text-xs italic">
                        No folders match &quot;{folderSearchQuery}&quot;
                      </div>
                    ) : (
                      googleFolders.map((f) => {
                        const isSelected = f.id === selectedFolderId;
                        return (
                          <div
                            key={f.id}
                            onClick={() => handleSelectFolder(f)}
                            className={cn(
                              "p-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors group",
                              isSelected
                                ? "bg-blue-600/30 text-white font-bold border border-blue-500/40"
                                : "hover:bg-white/[0.06] text-slate-300"
                            )}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 pr-2">
                              <Folder
                                className={cn(
                                  "w-3.5 h-3.5 shrink-0 mt-0.5",
                                  isSelected ? "text-blue-400" : "text-amber-400"
                                )}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-xs font-semibold text-white group-hover:text-blue-300">
                                  {f.name}
                                </span>
                                {f.path && (
                                  <span className="truncate text-[10px] text-slate-400 font-mono">
                                    {f.path}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Professional Upload File Button */}
            <Button
              size="sm"
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-9 px-3.5 font-mono text-xs gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer font-bold transition-all"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </Button>

            {/* Grid / List View Toggle */}
            <div className="flex items-center bg-white/[0.04] border border-white/15 p-0.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-xl text-xs transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                )}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-xl text-xs transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                )}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="bg-white/[0.04] border-white/15 hover:bg-white/10 text-slate-300 rounded-2xl h-9 px-2.5 font-mono text-xs gap-1.5 cursor-pointer shadow-sm"
              title="Refresh Files"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            </Button>
          </div>
        </div>

        {/* TAB 1: LOCAL STORAGE CONTENT (DRIVEN BY `assets` TABLE) */}
        <TabsContent value="local" className="space-y-4 pt-1">
          {/* QUICK SELECTION & FILTER BAR */}
          <div className="flex items-center justify-between gap-2 p-2.5 px-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs font-mono flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold mr-1">
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <span>Select:</span>
              </div>

              {/* Select All */}
              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  "px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer",
                  isAllSelected
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/40"
                    : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                All ({filteredAssets.length})
              </button>

              {/* Select Synced */}
              <button
                type="button"
                onClick={handleSelectSynced}
                className={cn(
                  "px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  syncedAssets.length > 0 &&
                    syncedAssets.every((a) => selectedAssetIds.includes(a.id)) &&
                    selectedAssetIds.length === syncedAssets.length
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-600/40"
                    : "bg-white/[0.03] border-white/10 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/30"
                )}
                title="Select all files synced to Google Drive"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Synced ({syncedAssets.length})</span>
              </button>

              {/* Select Unsynced */}
              <button
                type="button"
                onClick={handleSelectUnsynced}
                className={cn(
                  "px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  unsyncedAssets.length > 0 &&
                    unsyncedAssets.every((a) => selectedAssetIds.includes(a.id)) &&
                    selectedAssetIds.length === unsyncedAssets.length
                    ? "bg-amber-600 border-amber-500 text-white shadow-sm shadow-amber-600/40"
                    : "bg-white/[0.03] border-white/10 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/30"
                )}
                title="Select all local files not yet synced to Google Drive"
              >
                <HardDrive className="w-3 h-3" />
                <span>Unsynced ({unsyncedAssets.length})</span>
              </button>
            </div>

            {selectedAssetIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAssetIds([])}
                className="px-2.5 py-1 rounded-xl text-slate-400 hover:text-white text-[11px] transition-all cursor-pointer ml-auto"
              >
                Clear Selection ({selectedAssetIds.length})
              </button>
            )}
          </div>

          {/* BULK ACTION BAR (Visible when items are selected) */}
          {selectedAssetIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-white shadow-2xl backdrop-blur-xl font-mono text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2.5">
                <CustomCheckbox
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
                <span className="font-bold">
                  {selectedAssetIds.length} of {filteredAssets.length} file(s) selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Sync Selected */}
                <Button
                  size="sm"
                  onClick={handleSyncSelected}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-8 px-3 font-mono text-xs gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer"
                  title="Queue selected files for upload to Google Drive"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Sync Selected</span>
                </Button>

                {/* 2. Free Disk Space (Delete Local Copy Only, Keeps Cloud Ghost Record) */}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={requestDeleteLocalCopies}
                  className="border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl h-8 px-3 font-mono text-xs gap-1.5 cursor-pointer"
                  title="Unlink local physical files to free disk space (preserves Google Drive Ghost records in DB)"
                >
                  <CloudOff className="w-3.5 h-3.5" />
                  <span>Free Disk (Keep Cloud)</span>
                </Button>

                {/* 3. Delete from Google Drive, Local Disk & DB */}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() => requestDeleteFromDriveAndDb()}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 px-3 font-mono text-xs gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer"
                  title="Permanently delete selected files from Google Drive, local disk, and MySQL database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete from Drive & DB</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedAssetIds([])}
                  className="border-white/10 hover:bg-white/10 text-slate-300 rounded-xl h-8 px-2.5 font-mono text-xs cursor-pointer"
                >
                  Deselect
                </Button>
              </div>
            </div>
          )}

          {filteredAssets.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-white/[0.02] border border-white/10 space-y-3 my-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto shadow-xl">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-mono font-bold text-white uppercase">
                  {searchQuery ? "No matching assets" : "No Assets in Storage"}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {searchQuery
                    ? `No assets match "${searchQuery}".`
                    : "Files uploaded via Knowledge Vault or Drive will appear here."}
                </p>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => {
                const ext = getFileExtension(asset.title, asset.urlOrPath);
                const isSelected = selectedAssetIds.includes(asset.id);
                const isSynced = asset.syncStatus === "SYNCED_LOCAL_KEPT";
                const isGhost = asset.syncStatus === "CLOUD_ONLY";

                return (
                  <div
                    key={asset.id}
                    className={cn(
                      "p-4 rounded-2xl bg-white/[0.03] border transition-all group flex flex-col justify-between space-y-3 shadow-lg relative",
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/20 shadow-indigo-500/20"
                        : "border-white/10 hover:border-indigo-500/40 hover:shadow-indigo-500/10"
                    )}
                  >
                    {/* Top Row: Custom Checkbox, Rich Icon, Sync Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <CustomCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelectAsset(asset.id)}
                        />
                        {getRichFileIcon(ext)}
                      </div>

                      {/* Visual Sync Status Indicator */}
                      {isSynced ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/10 gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Synced</span>
                        </Badge>
                      ) : isGhost ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-cyan-500/40 text-cyan-400 bg-cyan-500/10 gap-1"
                        >
                          <Cloud className="w-2.5 h-2.5" />
                          <span>Cloud Only</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-amber-500/40 text-amber-400 bg-amber-500/10 gap-1"
                        >
                          <HardDrive className="w-2.5 h-2.5" />
                          <span>Local Only</span>
                        </Badge>
                      )}
                    </div>

                    {/* Middle: Title & Metadata */}
                    <div className="space-y-1 min-w-0">
                      <h4
                        className="text-xs font-semibold text-white truncate font-mono cursor-pointer hover:text-indigo-300 transition-colors"
                        title={asset.title}
                        onClick={() => openAssetPreview(asset)}
                      >
                        {asset.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <span>{formatBytes(asset.sizeBytes)}</span>
                        <span>•</span>
                        <span>{formatDate(asset.createdAt)}</span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10 text-xs font-mono">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAssetPreview(asset)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Preview File"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        </button>
                        {!isGhost && (
                          <a
                            href={asset.urlOrPath}
                            download
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                            title="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {asset.gdriveId && (
                          <a
                            href={`https://drive.google.com/file/d/${asset.gdriveId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-blue-400 hover:text-blue-300 transition-colors"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteFromDriveAndDb([asset.id], asset.title)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors cursor-pointer"
                          title={
                            asset.gdriveId
                              ? "Delete from Google Drive & Local Storage"
                              : "Delete local asset from database"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Sync / Free Space Trigger */}
                      {!isGhost ? (
                        isSynced ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] font-mono gap-1 py-1 px-2 font-semibold"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Synced</span>
                          </Badge>
                        ) : (
                          <Button
                            size="xs"
                            onClick={() => handleSyncAsset(asset)}
                            className="rounded-xl h-7 px-2.5 font-mono text-[10px] gap-1 cursor-pointer transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 font-semibold"
                            title={`Sync to Google Drive (${selectedFolderName})`}
                          >
                            <UploadCloud className="w-3 h-3" />
                            <span>Sync</span>
                          </Button>
                        )
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-cyan-500/40 text-cyan-300 bg-cyan-500/10 text-[10px] font-mono gap-1 py-1 px-2"
                        >
                          <Cloud className="w-3 h-3 text-cyan-400" />
                          <span>Cloud Ghost</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-xl font-mono text-xs">
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
                      <th className="p-3">Type</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Sync Status</th>
                      <th className="p-3">Added</th>
                      <th className="p-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAssets.map((asset) => {
                      const ext = getFileExtension(asset.title, asset.urlOrPath);
                      const isSelected = selectedAssetIds.includes(asset.id);
                      const isSynced = asset.syncStatus === "SYNCED_LOCAL_KEPT";
                      const isGhost = asset.syncStatus === "CLOUD_ONLY";

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
                              onChange={() => toggleSelectAsset(asset.id)}
                            />
                          </td>
                          <td className="p-3 font-semibold text-white">
                            <div className="flex items-center gap-2.5">
                              {getRichFileIcon(ext)}
                              <span
                                className="truncate max-w-xs sm:max-w-md cursor-pointer hover:text-indigo-300"
                                onClick={() => openAssetPreview(asset)}
                              >
                                {asset.title}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase border-white/10 text-slate-400"
                            >
                              {ext}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-400">{formatBytes(asset.sizeBytes)}</td>
                          <td className="p-3">
                            {isSynced ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10 gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Synced</span>
                              </Badge>
                            ) : isGhost ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-cyan-500/40 text-cyan-400 bg-cyan-500/10 gap-1"
                              >
                                <Cloud className="w-3 h-3" />
                                <span>Cloud Only</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/10 gap-1"
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
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                                title="Preview"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              </button>
                              {asset.gdriveId && (
                                <a
                                  href={`https://drive.google.com/file/d/${asset.gdriveId}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-blue-400 hover:text-blue-300"
                                  title="View on Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!isGhost &&
                                (isSynced ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] font-mono gap-1 py-0.5 px-2 font-semibold"
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Synced</span>
                                  </Badge>
                                ) : (
                                  <Button
                                    size="xs"
                                    onClick={() => handleSyncAsset(asset)}
                                    className="rounded-xl h-7 px-2.5 font-mono text-[10px] gap-1 cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30"
                                    title={`Sync to Google Drive (${selectedFolderName})`}
                                  >
                                    <UploadCloud className="w-3 h-3" />
                                    <span>Sync</span>
                                  </Button>
                                ))}
                              <button
                                type="button"
                                onClick={() => requestDeleteFromDriveAndDb([asset.id], asset.title)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors cursor-pointer"
                                title={
                                  asset.gdriveId
                                    ? "Delete from Google Drive & Local Storage"
                                    : "Delete local asset from database"
                                }
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

        {/* TAB 2: GOOGLE DRIVE CONTENT */}
        <TabsContent value="google" className="space-y-4 pt-1">
          {/* Loading State */}
          {isGoogleLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 animate-pulse"
                >
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 rounded-xl bg-white/10" />
                    <div className="w-12 h-4 rounded bg-white/10" />
                  </div>
                  <div className="w-3/4 h-4 rounded bg-white/10" />
                  <div className="w-1/2 h-3 rounded bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {/* 401 Not Connected State */}
          {!isGoogleLoading && isGoogleUnauthorized && (
            <div className="p-10 md:p-14 text-center rounded-3xl bg-white/[0.02] border border-white/10 space-y-5 my-4 backdrop-blur-xl shadow-2xl max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto shadow-2xl shadow-blue-500/20">
                <Cloud className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-tight">
                  Google Drive Not Connected
                </h3>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Authenticate via Google OAuth 2.0 to access your real-time cloud files, synchronize assets, and view Google Drive documents.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3 font-mono text-xs">
                <a
                  href="/api/google/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer text-xs"
                >
                  <Cloud className="w-4 h-4" /> Connect Google Drive
                </a>
                <a
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 transition-all border border-white/10 text-xs"
                >
                  Settings Vault
                </a>
              </div>
            </div>
          )}

          {/* Non-401 Error State */}
          {!isGoogleLoading && !isGoogleUnauthorized && googleError && (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>Failed to load Google Drive files: {googleError.message}</span>
            </div>
          )}

          {/* Connected Empty State */}
          {!isGoogleLoading && !googleError && filteredGoogleFiles.length === 0 && (
            <div className="p-10 text-center rounded-3xl bg-white/[0.02] border border-white/10 space-y-3 my-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto shadow-xl">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-mono font-bold text-white uppercase">
                  {searchQuery ? "No matching cloud files" : "Google Drive is Empty"}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {searchQuery
                    ? `No cloud files match "${searchQuery}".`
                    : "Files in your Google Drive will be listed here automatically."}
                </p>
              </div>
            </div>
          )}

          {/* Connected Grid View */}
          {!isGoogleLoading && !googleError && filteredGoogleFiles.length > 0 && viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGoogleFiles.map((file) => {
                const ext = file.name.includes(".")
                  ? file.name.split(".").pop() || "cloud"
                  : "cloud";

                return (
                  <div
                    key={file.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-blue-500/40 transition-all group flex flex-col justify-between space-y-3 shadow-lg hover:shadow-blue-500/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="shrink-0">
                        {getRichFileIcon(ext, file.mimeType, file.iconLink)}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-mono border-blue-500/30 text-blue-400 bg-blue-500/10 flex items-center gap-1"
                      >
                        <Cloud className="w-2.5 h-2.5" />
                        <span>Cloud</span>
                      </Badge>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h4
                        className="text-xs font-semibold text-white truncate font-mono cursor-pointer hover:text-blue-300 transition-colors"
                        title={file.name}
                        onClick={() => openGoogleDrivePreview(file)}
                      >
                        {file.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.modifiedTime)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => openGoogleDrivePreview(file)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Preview File"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                      </button>

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-mono"
                        >
                          <span>Open in Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Connected List View */}
          {!isGoogleLoading && !googleError && filteredGoogleFiles.length > 0 && viewMode === "list" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs text-slate-300">
                  <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-3 pl-4">File Name</th>
                      <th className="p-3">MIME / Type</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Modified</th>
                      <th className="p-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredGoogleFiles.map((file) => {
                      const ext = file.name.includes(".")
                        ? file.name.split(".").pop() || "cloud"
                        : "cloud";

                      return (
                        <tr key={file.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 pl-4 font-semibold text-white flex items-center gap-2.5">
                            {getRichFileIcon(ext, file.mimeType, file.iconLink)}
                            <span
                              className="truncate max-w-xs sm:max-w-md cursor-pointer hover:text-blue-300"
                              onClick={() => openGoogleDrivePreview(file)}
                            >
                              {file.name}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 max-w-[140px] truncate">
                            {file.mimeType.split(".").pop() || file.mimeType}
                          </td>
                          <td className="p-3 text-slate-400">{formatBytes(file.size)}</td>
                          <td className="p-3 text-slate-400">{formatDate(file.modifiedTime)}</td>
                          <td className="p-3 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openGoogleDrivePreview(file)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                                title="Preview"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-400" />
                              </button>
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-mono"
                                >
                                  <span>Open</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
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
      </Tabs>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* GLASSMORPHIC UPLOAD FILE MODAL */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#12121e]/95 border border-white/15 text-slate-100 rounded-3xl max-w-lg p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono"
        >
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span>UPLOAD FILE TO DRIVE & STORAGE</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleFormUploadSubmit} className="space-y-4">
            {/* Drag and drop Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesSelect(e.dataTransfer.files);
                }
              }}
              className={cn(
                "border-2 border-dashed rounded-3xl p-5 text-center cursor-pointer transition-all group relative overflow-hidden",
                isDragging
                  ? "border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
                  : uploadFiles.length > 0
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/15 hover:border-indigo-400/50 bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              <input
                type="file"
                id="universal-file-upload"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelect(e.target.files);
                    e.target.value = ""; // Reset input so same files can be re-selected if removed
                  }
                }}
              />
              <label
                htmlFor="universal-file-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2 w-full"
              >
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shadow-lg">
                  {uploadFiles.length > 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <UploadCloud className="w-5 h-5 text-indigo-400" />
                  )}
                </div>

                <div className="space-y-0.5 text-center">
                  <p className="text-xs font-bold text-white">
                    {uploadFiles.length > 0
                      ? `${uploadFiles.length} file(s) selected (Click or drop more to add)`
                      : "Click to select files or drag & drop here (Bulk supported)"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Auto-categorizes PDF, Docs, Sheets, Images, Videos, Audio & Archives
                  </p>
                </div>
              </label>
            </div>

            {/* Selected Files List with Auto-Detected Category Badges */}
            {uploadFiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                  <span>Selected Files Queue ({uploadFiles.length}):</span>
                  <button
                    type="button"
                    onClick={() => setUploadFiles([])}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {uploadFiles.map((file, idx) => {
                    const cat = detectFileType(file);
                    const ext = file.name.split(".").pop() || "";
                    const isImg = cat === "image";

                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        className="p-2 px-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2.5 text-xs font-mono group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getRichFileIcon(ext, file.type)}
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-semibold text-white max-w-[220px] sm:max-w-[260px]">
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{formatBytes(file.size)}</span>
                              <span>•</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] px-1.5 py-0 uppercase font-mono",
                                  cat === "image"
                                    ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                                    : cat === "video"
                                    ? "border-amber-500/30 text-amber-300 bg-amber-500/10"
                                    : "border-blue-500/30 text-blue-300 bg-blue-500/10"
                                )}
                              >
                                {cat === "image" ? "Image" : cat === "video" ? "Video" : "Document"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeUploadFile(idx)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove file from queue"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Tags for the batch */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase">
                Tags (Optional, comma separated)
              </label>
              <Input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="e.g., project, report, personal"
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-10 px-3.5 font-mono"
              />
            </div>

            {/* Auto Google Drive Sync Checkbox */}
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CustomCheckbox
                  checked={autoSyncToDrive}
                  onChange={() => setAutoSyncToDrive(!autoSyncToDrive)}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">
                    Direct Cloud Sync to Google Drive
                  </span>
                  <span className="text-[10px] text-indigo-300">
                    Target folder: {selectedFolderName}
                  </span>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-indigo-500/30 text-indigo-300 bg-indigo-500/20 text-[9px]"
              >
                Auto-Sync
              </Badge>
            </div>

            <DialogFooter className="pt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadOpen(false)}
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

      {/* GLASSMORPHIC DELETE CONFIRMATION DIALOG (Popup Verif) */}
      <Dialog
        open={deleteConfirmState.isOpen}
        onOpenChange={(open) =>
          setDeleteConfirmState((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4",
            deleteConfirmState.mode === "drive_and_db"
              ? "bg-[#14121c]/95 border border-rose-500/30 text-slate-100"
              : "bg-[#14141c]/95 border border-amber-500/30 text-slate-100"
          )}
        >
          <div
            className={cn(
              "mx-auto w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl",
              deleteConfirmState.mode === "drive_and_db"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            )}
          >
            <AlertTriangle className="w-7 h-7 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold text-white tracking-wide uppercase font-mono">
              {deleteConfirmState.mode === "drive_and_db"
                ? "DELETE FROM DRIVE & DATABASE"
                : "FREE DISK SPACE (KEEP CLOUD)"}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed font-sans px-2">
              {deleteConfirmState.mode === "drive_and_db" ? (
                <>
                  Are you sure you want to permanently delete{" "}
                  <span className="text-rose-300 font-bold">
                    {deleteConfirmState.singleTitle
                      ? `"${deleteConfirmState.singleTitle}"`
                      : `${deleteConfirmState.targetIds.length} file(s)`}
                  </span>
                  ?
                </>
              ) : (
                <>
                  Are you sure you want to delete local copies for{" "}
                  <span className="text-amber-300 font-bold">
                    {deleteConfirmState.singleTitle
                      ? `"${deleteConfirmState.singleTitle}"`
                      : `${deleteConfirmState.targetIds.length} file(s)`}
                  </span>{" "}
                  from physical disk?
                </>
              )}
            </p>

            <div
              className={cn(
                "p-3 rounded-2xl text-[11px] text-left font-mono space-y-1 mt-2 border",
                deleteConfirmState.mode === "drive_and_db"
                  ? "bg-rose-950/30 border-rose-500/20 text-rose-200"
                  : "bg-amber-950/30 border-amber-500/20 text-amber-200"
              )}
            >
              {deleteConfirmState.mode === "drive_and_db" ? (
                <>
                  <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                    <span>⚠️ Permanent Destruction:</span>
                  </div>
                  <ul className="list-disc list-inside text-[10px] space-y-0.5 text-rose-300/80">
                    <li>Deleted from Google Drive API</li>
                    <li>Unlinked from /public/uploads</li>
                    <li>Removed from MySQL Database</li>
                  </ul>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <span>💡 Non-Destructive Ghosting:</span>
                  </div>
                  <p className="text-[10px] text-amber-300/80 leading-tight">
                    Files will be removed from local disk (/public/uploads) to free storage, while your cloud records remain safely indexed in Google Drive.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
              }
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className={cn(
                "flex-1 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-xl cursor-pointer transition-all",
                deleteConfirmState.mode === "drive_and_db"
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/40"
                  : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/40"
              )}
            >
              {isDeleting
                ? "Processing..."
                : deleteConfirmState.mode === "drive_and_db"
                ? "Delete Permanently"
                : "Free Local Disk"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
