"use client";

import React from "react";
import { useUploadStore } from "@/lib/store/useUploadStore";
import { useLocalUploadStore } from "@/lib/store/useLocalUploadStore";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Cloud,
  HardDrive,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Local Upload Progress Widget ──────────────────────────────────────────────
function LocalUploadWidget() {
  const { items, isMinimized, toggleMinimize, removeItem, clearCompleted } =
    useLocalUploadStore();

  if (items.length === 0) return null;

  const activeItem = items.find((i) => i.status === "uploading");
  const completedCount = items.filter((i) => i.status === "completed").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const totalCount = items.length;
  const overallPercent =
    totalCount === 0
      ? 0
      : Math.round(items.reduce((acc, i) => acc + i.percent, 0) / totalCount);

  return (
    <div className="font-mono text-xs animate-in fade-in slide-in-from-bottom-4 duration-200">
      {isMinimized ? (
        <button
          type="button"
          onClick={toggleMinimize}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#12121e]/95 border border-amber-500/40 text-white shadow-2xl backdrop-blur-2xl hover:border-amber-400 transition-all cursor-pointer group"
        >
          {activeItem ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
          ) : errorCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <span>Local Upload:</span>
            <span className="text-amber-300">{overallPercent}%</span>
            <span className="text-[10px] text-slate-400">
              ({completedCount}/{totalCount})
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 ml-1" />
        </button>
      ) : (
        <div className="w-84 sm:w-96 rounded-3xl bg-[#0f0f1a]/95 border border-white/15 text-white shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs truncate">Local Storage Upload</span>
                <span className="text-[10px] text-slate-400">
                  {completedCount} of {totalCount} completed ({overallPercent}%)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMinimize}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {completedCount === totalCount && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active file progress */}
          {activeItem && (
            <div className="p-4 space-y-2.5 bg-white/[0.01]">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold truncate text-white max-w-[180px]">
                    {activeItem.name}
                  </span>
                </div>
                <span className="font-bold text-amber-300 shrink-0">
                  {activeItem.percent}%
                </span>
              </div>

              <Progress
                value={activeItem.percent}
                className="h-2 bg-white/10 [&>div]:bg-amber-500"
              />

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{formatBytes(activeItem.loadedBytes)} / {formatBytes(activeItem.size)}</span>
                <span>Saving to disk...</span>
              </div>
            </div>
          )}

          {/* Queue list */}
          <div className="max-h-44 overflow-y-auto divide-y divide-white/5 p-2 pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-2 rounded-xl flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : item.status === "uploading" ? (
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate font-medium text-slate-200">
                      {item.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {formatBytes(item.size)} • Local Storage
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1.5 py-0 uppercase",
                      item.status === "completed"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : item.status === "uploading"
                        ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                        : "border-rose-500/40 text-rose-400 bg-rose-500/10"
                    )}
                  >
                    {item.status === "uploading" ? `${item.percent}%` : item.status}
                  </Badge>

                  {item.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-2 px-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[10px] text-slate-400">
            <span>Direct Binary Stream → Disk</span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-amber-400 hover:underline cursor-pointer"
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drive Sync Progress Widget ─────────────────────────────────────────────────
function DriveUploadWidget() {
  const {
    queue,
    isUploading,
    overallProgress,
    isMinimized,
    toggleMinimize,
    removeFromQueue,
    clearCompleted,
  } = useUploadStore();

  if (queue.length === 0) return null;

  const currentItem =
    queue.find((q) => q.status === "uploading") ||
    queue.find((q) => q.status === "queued");
  const completedCount = queue.filter((q) => q.status === "completed").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const totalCount = queue.length;

  return (
    <div className="font-mono text-xs animate-in fade-in slide-in-from-bottom-4 duration-200">
      {isMinimized ? (
        <button
          type="button"
          onClick={toggleMinimize}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#12121e]/95 border border-indigo-500/40 text-white shadow-2xl backdrop-blur-2xl hover:border-indigo-400 transition-all cursor-pointer group"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          ) : errorCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <span>Drive Sync:</span>
            <span className="text-indigo-300">{overallProgress}%</span>
            <span className="text-[10px] text-slate-400">
              ({completedCount}/{totalCount})
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 ml-1" />
        </button>
      ) : (
        <div className="w-84 sm:w-96 rounded-3xl bg-[#0f0f1a]/95 border border-white/15 text-white shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col">
          <div className="p-3.5 px-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs truncate">Google Drive Sync</span>
                <span className="text-[10px] text-slate-400">
                  {completedCount} of {totalCount} completed ({overallProgress}%)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMinimize}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {completedCount === totalCount && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {currentItem && (
            <div className="p-4 space-y-2.5 bg-white/[0.01]">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold truncate text-white max-w-[180px]">
                    {currentItem.name}
                  </span>
                </div>
                <span className="font-bold text-indigo-300 shrink-0">
                  {currentItem.progress}%
                </span>
              </div>
              <Progress value={currentItem.progress} className="h-2 bg-white/10" />
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{formatBytes(currentItem.size)}</span>
                <span>
                  {currentItem.status === "uploading"
                    ? "Resumable Streaming..."
                    : currentItem.status === "completed"
                    ? "✓ Synced"
                    : currentItem.status === "error"
                    ? "⚠️ Failed"
                    : "Queued"}
                </span>
              </div>
            </div>
          )}

          <div className="max-h-44 overflow-y-auto divide-y divide-white/5 p-2 pr-1 scrollbar-thin">
            {queue.map((item) => (
              <div
                key={item.id}
                className="p-2 rounded-xl flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : item.status === "uploading" ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  ) : item.status === "error" ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate font-medium text-slate-200">
                      {item.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {formatBytes(item.size)} • {item.folderName || "Root"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1.5 py-0 uppercase",
                      item.status === "completed"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : item.status === "uploading"
                        ? "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
                        : item.status === "error"
                        ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                        : "border-white/10 text-slate-400"
                    )}
                  >
                    {item.status === "uploading" ? `${item.progress}%` : item.status}
                  </Badge>
                  {item.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => removeFromQueue(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 px-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[10px] text-slate-400">
            <span>Direct Client-to-Drive API v3</span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-indigo-400 hover:underline cursor-pointer"
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Combined Widget ─────────────────────────────────────────────────────────────
export function GlobalUploadProgress() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
      <LocalUploadWidget />
      <DriveUploadWidget />
    </div>
  );
}
