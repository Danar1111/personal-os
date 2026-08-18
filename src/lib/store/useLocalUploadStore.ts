import { create } from "zustand";

export interface LocalUploadItem {
  id: string;
  name: string;
  size: number;
  percent: number;
  loadedBytes: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

interface LocalUploadStore {
  items: LocalUploadItem[];
  isMinimized: boolean;
  startItem: (item: Omit<LocalUploadItem, "percent" | "loadedBytes" | "status">) => void;
  updateProgress: (id: string, percent: number, loadedBytes: number) => void;
  completeItem: (id: string) => void;
  errorItem: (id: string, error: string) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  toggleMinimize: () => void;
}

export const useLocalUploadStore = create<LocalUploadStore>((set) => ({
  items: [],
  isMinimized: false,

  startItem: (item) => {
    set((state) => ({
      items: [
        ...state.items.filter((i) => i.id !== item.id),
        { ...item, percent: 0, loadedBytes: 0, status: "uploading" },
      ],
      isMinimized: false,
    }));
  },

  updateProgress: (id, percent, loadedBytes) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, percent, loadedBytes } : i
      ),
    }));
  },

  completeItem: (id) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, percent: 100, loadedBytes: i.size, status: "completed" } : i
      ),
    }));
  },

  errorItem: (id, error) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: "error", error } : i
      ),
    }));
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },

  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((i) => i.status !== "completed"),
    }));
  },

  toggleMinimize: () => {
    set((state) => ({ isMinimized: !state.isMinimized }));
  },
}));
