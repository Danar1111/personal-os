import { create } from "zustand";
import { uploadFileToDrive } from "@/lib/drive-upload";

export interface UploadItem {
  id: string;
  assetId?: number;
  name: string;
  size: number;
  file?: File | Blob;
  localPath?: string;
  folderId?: string;
  folderName?: string;
  progress: number; // 0 - 100
  status: "queued" | "uploading" | "completed" | "error";
  error?: string;
  gdriveId?: string;
}

interface UploadStore {
  queue: UploadItem[];
  isUploading: boolean;
  overallProgress: number;
  isMinimized: boolean;
  addToQueue: (items: Array<Omit<UploadItem, "progress" | "status">>) => void;
  startUpload: () => Promise<void>;
  updateProgress: (id: string, progress: number) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  toggleMinimize: () => void;
  setIsMinimized: (min: boolean) => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  queue: [],
  isUploading: false,
  overallProgress: 0,
  isMinimized: false,

  addToQueue: (newItems) => {
    const prepared: UploadItem[] = newItems.map((item) => ({
      ...item,
      progress: 0,
      status: "queued",
    }));

    set((state) => {
      // Avoid duplicate file/asset additions
      const filtered = prepared.filter(
        (p) => !state.queue.some((q) => q.id === p.id && q.status !== "completed" && q.status !== "error")
      );
      return {
        queue: [...state.queue, ...filtered],
        isMinimized: false,
      };
    });

    // Auto-trigger queue processing if not already running
    setTimeout(() => {
      if (!get().isUploading) {
        get().startUpload();
      }
    }, 50);
  },

  updateProgress: (id: string, progress: number) => {
    set((state) => {
      const updatedQueue: UploadItem[] = state.queue.map((item) =>
        item.id === id
          ? {
              ...item,
              progress,
              status: progress >= 100 ? ("completed" as const) : ("uploading" as const),
            }
          : item
      );

      const totalItems = updatedQueue.length;
      const totalProgress =
        totalItems === 0
          ? 0
          : Math.round(
              updatedQueue.reduce((acc, curr) => acc + (curr.progress || 0), 0) / totalItems
            );

      return {
        queue: updatedQueue,
        overallProgress: totalProgress,
      };
    });
  },

  removeFromQueue: (id: string) => {
    set((state) => {
      const remaining = state.queue.filter((item) => item.id !== id);
      const totalItems = remaining.length;
      const totalProgress =
        totalItems === 0
          ? 0
          : Math.round(
              remaining.reduce((acc, curr) => acc + (curr.progress || 0), 0) / totalItems
            );
      return {
        queue: remaining,
        overallProgress: totalProgress,
      };
    });
  },

  clearCompleted: () => {
    set((state) => ({
      queue: state.queue.filter((item) => item.status !== "completed"),
    }));
  },

  toggleMinimize: () => {
    set((state) => ({ isMinimized: !state.isMinimized }));
  },

  setIsMinimized: (min: boolean) => {
    set({ isMinimized: min });
  },

  startUpload: async () => {
    const { queue, isUploading } = get();
    if (isUploading) return;

    const queuedItems = queue.filter((item) => item.status === "queued");
    if (queuedItems.length === 0) return;

    set({ isUploading: true });

    try {
      // 1. Fetch fresh Google OAuth Access Token
      const tokenRes = await fetch("/api/drive/token");
      if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Google Drive is not connected. Connect in Settings.");
      }
      const { accessToken } = await tokenRes.json();

      // 2. Process queue sequentially to prevent Google API rate limits & optimize progress accuracy
      for (const item of get().queue) {
        if (item.status !== "queued") continue;

        set((state) => ({
          queue: state.queue.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 0 } : q)),
        }));

        try {
          let fileBlob: Blob | File | null = item.file || null;

          // If item was added from a local path, fetch its binary blob directly from client browser
          if (!fileBlob && item.localPath) {
            const blobRes = await fetch(item.localPath);
            if (!blobRes.ok) {
              throw new Error(`Failed to load physical file from "${item.localPath}"`);
            }
            fileBlob = await blobRes.blob();
          }

          if (!fileBlob) {
            throw new Error("No file binary or URL found to upload.");
          }

          // Execute client-side direct resumable upload with live XHR progress
          const driveResult = await uploadFileToDrive({
            file: fileBlob,
            fileName: item.name,
            accessToken,
            folderId: item.folderId && item.folderId !== "root" ? item.folderId : undefined,
            onProgress: (pct) => {
              get().updateProgress(item.id, pct);
            },
          });

          // Update MySQL assets table row if assetId exists
          if (item.assetId) {
            await fetch("/api/drive/asset-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assetId: item.assetId,
                gdriveId: driveResult.id,
                syncStatus: "SYNCED_LOCAL_KEPT",
              }),
            });
          }

          set((state) => ({
            queue: state.queue.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: "completed",
                    progress: 100,
                    gdriveId: driveResult.id,
                  }
                : q
            ),
          }));
        } catch (err: any) {
          console.error(`[Upload Error for ${item.name}]:`, err);
          set((state) => ({
            queue: state.queue.map((q) =>
              q.id === item.id ? { ...q, status: "error", error: err.message || "Upload failed" } : q
            ),
          }));
        }
      }
    } catch (err: any) {
      console.error("[Upload Queue Error]:", err);
    } finally {
      set({ isUploading: false });
    }
  },
}));
