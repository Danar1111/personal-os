"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Note, Folder, Asset } from "@/db/schema";
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  createFolderAction,
  renameFolderAction,
  moveFolderAction,
  deleteFolderAction,
} from "@/app/vault/actions";
import {
  Plus,
  Trash2,
  Save,
  Search,
  FileText,
  Code,
  Lightbulb,
  BookOpen,
  Layers,
  Edit3,
  Eye,
  Tag,
  Clock,
  FolderPlus,
  Folder as FolderIcon,
  Link as LinkIcon,
  Check,
  Sparkles,
  AlertTriangle,
  X,
  Maximize2,
  Minimize2,
  Copy,
  ArrowLeft,
  ChevronRight,
  SlidersHorizontal,
  Paperclip,
  ExternalLink,
  HardDrive,
  Video,
  Image as ImageIcon,
  Music,
  RotateCcw,
  RotateCw,
} from "lucide-react";

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(cleanUrl);
}

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogv|mov)$/.test(cleanUrl);
}

function isAudioUrl(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac)$/.test(cleanUrl);
}
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FolderTree } from "@/components/vault/FolderTree";

function CodeBlockWithCopy({ language, code, style }: { language: string; code: string; style?: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy code:", e);
    }
  };

  return (
    <div className="relative group my-3.5 rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-[#0d0c12]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.04] border-b border-white/10 font-mono text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 text-indigo-300 font-semibold lowercase">
          <Code className="w-3.5 h-3.5 text-indigo-400" />
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer border border-white/10"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300 text-[10px] font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span className="text-[10px]">Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Syntax Highlight */}
      <SyntaxHighlighter
        style={style || (vscDarkPlus as any)}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, padding: "12px 16px", background: "transparent" }}
        className="text-xs font-mono scrollbar-thin"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}


interface SecondBrainVaultProps {
  initialNotes: Note[];
  initialFolders: Folder[];
  initialAssets?: Asset[];
}

export function SecondBrainVault({ initialNotes, initialFolders, initialAssets = [] }: SecondBrainVaultProps) {



  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const searchParams = useSearchParams();

  // Navigation History Stack State (array of Note IDs) — empty on first load
  const [history, setHistory] = useState<number[]>([]);

  const currentActiveNoteId = history.length > 0 ? history[history.length - 1] : null;
  const activeNote = initialNotes.find((n) => n.id === currentActiveNoteId) || null;

  // Handle URL deep-linking (e.g., /vault?noteId=123 or /vault?search=query)
  useEffect(() => {
    const noteIdParam = searchParams.get("noteId");
    const queryParam = searchParams.get("search") || searchParams.get("q");

    if (noteIdParam) {
      const foundNote = initialNotes.find((n) => n.id.toString() === noteIdParam);
      if (foundNote) {
        if (currentActiveNoteId !== foundNote.id) {
          setHistory([foundNote.id]);
        }
      }
    } else if (queryParam) {
      const foundNote = initialNotes.find((n) => n.title.toLowerCase().includes(queryParam.toLowerCase()));
      if (foundNote) {
        if (currentActiveNoteId !== foundNote.id) {
          setHistory([foundNote.id]);
        }
      } else {
        setSearchQuery(queryParam);
      }
    }
  }, [searchParams, initialNotes]);

  // Clipboard State for Cut / Copy
  const [clipboardNote, setClipboardNote] = useState<{
    action: "cut" | "copy";
    note: Note;
  } | null>(null);

  // Editor State
  const [editorTitle, setEditorTitle] = useState(activeNote?.title || "");
  const [editorContent, setEditorContent] = useState(activeNote?.content || "");
  const [editorCategory, setEditorCategory] = useState<
    "snippet" | "idea" | "architecture" | "journal"
  >(activeNote?.category as any || "idea");
  const [editorTags, setEditorTags] = useState(activeNote?.tags || "");
  const [editorFolderId, setEditorFolderId] = useState<string>(
    activeNote?.folderId ? activeNote.folderId.toString() : "none"
  );
  const [viewMode, setViewMode] = useState<"edit" | "preview">("preview");
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Full Read Mode State & Reader Navigation Stack
  const [isFullReadModalOpen, setIsFullReadModalOpen] = useState(false);
  const [fullReadHistory, setFullReadHistory] = useState<number[]>([]);
  const [isCopiedNotice, setIsCopiedNotice] = useState(false);

  const handleOpenFullReadModal = () => {
    if (activeNote) {
      setFullReadHistory([activeNote.id]);
    } else {
      setFullReadHistory([]);
    }
    setIsFullReadModalOpen(true);
  };

  const handleFullReadGoBack = () => {
    if (fullReadHistory.length <= 1) return;
    const newFullReadHistory = fullReadHistory.slice(0, -1);
    const prevNoteId = newFullReadHistory[newFullReadHistory.length - 1];
    setFullReadHistory(newFullReadHistory);
    const prevNote = initialNotes.find((n) => n.id === prevNoteId);
    if (prevNote) {
      selectNoteAndPushHistory(prevNote);
    }
  };

  // New Folder Modal State
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string>("none");

  // Rename Folder Modal State
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");

  // Custom Delete Confirmation Modals State
  const [deletingNoteConfirm, setDeletingNoteConfirm] = useState<Note | null>(null);
  const [deletingFolderConfirm, setDeletingFolderConfirm] = useState<Folder | null>(null);

  // Custom Missing Note Modal State
  const [missingNoteModalTitle, setMissingNoteModalTitle] = useState<string | null>(null);

  // Unsaved Changes Guard State
  const [pendingNoteToSelect, setPendingNoteToSelect] = useState<Note | null>(null);
  const [isUnsavedWarningOpen, setIsUnsavedWarningOpen] = useState(false);
  const [unsavedActionNotice, setUnsavedActionNotice] = useState<string | null>(null);

  // Wiki-Link & Asset Autocomplete Suggestion Popup State
  const [wikiSuggestOpen, setWikiSuggestOpen] = useState(false);
  const [wikiSuggestQuery, setWikiSuggestQuery] = useState("");
  const [wikiSuggestTab, setWikiSuggestTab] = useState<"all" | "notes" | "assets">("all");
  const [wikiSuggestIndex, setWikiSuggestIndex] = useState(0);
  const [wikiSuggestMode, setWikiSuggestMode] = useState<"wiki" | "attach">("wiki");
  const [wikiSuggestCursorPos, setWikiSuggestCursorPos] = useState<number | null>(null);
  const [wikiSuggestPos, setWikiSuggestPos] = useState<{ top: number; left: number }>({ top: 200, left: 200 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWikiSuggestIndex(0);
  }, [wikiSuggestQuery, wikiSuggestTab, wikiSuggestOpen]);

  // Auto-scroll list to keep selected item in view on ArrowUp / ArrowDown
  useEffect(() => {
    if (wikiSuggestOpen && itemsContainerRef.current) {
      const selectedEl = itemsContainerRef.current.children[wikiSuggestIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [wikiSuggestIndex, wikiSuggestOpen]);

  // Detect unsaved changes (isDirty)
  const isDirty =
    activeNote !== null &&
    (editorTitle !== activeNote.title ||
      editorContent !== activeNote.content ||
      editorCategory !== (activeNote.category || "idea") ||
      editorTags !== (activeNote.tags || ""));

  // Undo & Redo History Stack State
  const [undoStack, setUndoStack] = useState<Array<{ title: string; content: string; category: any; tags: string }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ title: string; content: string; category: any; tags: string }>>([]);
  const isHistoryActionRef = useRef(false);

  // Sync editor fields when activeNote changes and reset undo/redo stacks
  useEffect(() => {
    if (activeNote) {
      setEditorTitle(activeNote.title);
      setEditorContent(activeNote.content);
      setEditorCategory(activeNote.category as any);
      setEditorTags(activeNote.tags || "");
      setEditorFolderId(activeNote.folderId ? activeNote.folderId.toString() : "none");
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [
    activeNote?.id,
    activeNote?.title,
    activeNote?.content,
    activeNote?.category,
    activeNote?.tags,
    activeNote?.folderId,
  ]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const currentSnapshot = {
      title: editorTitle,
      content: editorContent,
      category: editorCategory,
      tags: editorTags,
    };
    const prevSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, currentSnapshot]);

    isHistoryActionRef.current = true;
    setEditorTitle(prevSnapshot.title);
    setEditorContent(prevSnapshot.content);
    setEditorCategory(prevSnapshot.category);
    setEditorTags(prevSnapshot.tags);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const currentSnapshot = {
      title: editorTitle,
      content: editorContent,
      category: editorCategory,
      tags: editorTags,
    };
    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, currentSnapshot]);

    isHistoryActionRef.current = true;
    setEditorTitle(nextSnapshot.title);
    setEditorContent(nextSnapshot.content);
    setEditorCategory(nextSnapshot.category);
    setEditorTags(nextSnapshot.tags);
  };

  // Select note & push to history stack
  const selectNoteAndPushHistory = (note: Note) => {
    if (currentActiveNoteId !== note.id) {
      setHistory((prev) => [...prev, note.id]);
    }
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorCategory(note.category as any);
    setEditorTags(note.tags);
    setEditorFolderId(note.folderId ? note.folderId.toString() : "none");
    setIsSavedNotice(false);
    setWikiSuggestOpen(false);
    setViewMode("preview");
  };

  // Safe note selection with unsaved warning check
  const handleNoteSelect = (note: Note) => {
    if (currentActiveNoteId === note.id) return;
    if (isDirty) {
      setPendingNoteToSelect(note);
      setIsUnsavedWarningOpen(true);
    } else {
      selectNoteAndPushHistory(note);
    }
  };

  // Back button action
  const handleGoBack = () => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    const prevNoteId = newHistory[newHistory.length - 1];
    const prevNote = initialNotes.find((n) => n.id === prevNoteId);
    setHistory(newHistory);
    if (prevNote) {
      setEditorTitle(prevNote.title);
      setEditorContent(prevNote.content);
      setEditorCategory(prevNote.category as any);
      setEditorTags(prevNote.tags);
      setEditorFolderId(prevNote.folderId ? prevNote.folderId.toString() : "none");
      setIsSavedNotice(false);
      setWikiSuggestOpen(false);
    }
  };

  const handleConfirmSaveAndSwitch = () => {
    if (!activeNote || !pendingNoteToSelect) return;
    startTransition(async () => {
      await updateNoteAction(activeNote.id, {
        title: editorTitle,
        content: editorContent,
        category: editorCategory,
        tags: editorTags,
        folderId: editorFolderId !== "none" ? parseInt(editorFolderId, 10) : null,
      });
      setIsUnsavedWarningOpen(false);
      selectNoteAndPushHistory(pendingNoteToSelect);
      setPendingNoteToSelect(null);
    });
  };

  const handleConfirmDiscardAndSwitch = () => {
    if (pendingNoteToSelect) {
      setIsUnsavedWarningOpen(false);
      selectNoteAndPushHistory(pendingNoteToSelect);
      setPendingNoteToSelect(null);
    }
  };

  // Switch to target note by Title for Zettelkasten Wiki-Links [[Note Title]]
  const openWikiLinkNote = (targetTitle: string) => {
    const found = initialNotes.find(
      (n) => n.title.toLowerCase().trim() === targetTitle.toLowerCase().trim()
    );
    if (found) {
      if (isFullReadModalOpen) {
        setFullReadHistory((prev) => [...prev, found.id]);
      }
      handleNoteSelect(found);
    } else {
      setMissingNoteModalTitle(targetTitle);
    }
  };

  // Pre-process markdown string to turn ALL [[Note Title]] into standard Markdown links [#wiki-link:Title]
  const preprocessWikiLinks = (rawContent: string) => {
    if (!rawContent) return "";
    return rawContent.replace(/\[\[(.*?)\]\]/g, (_, wikiTitle) => {
      const cleanTitle = wikiTitle.trim();
      return `[${cleanTitle}](#wiki-link:${encodeURIComponent(cleanTitle)})`;
    });
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(editorContent);
    setIsCopiedNotice(true);
    setTimeout(() => setIsCopiedNotice(false), 2000);
  };

  // Detect [[ typing in textarea and open wiki suggest popup using FIXED viewport coords
  const checkWikiTrigger = (val: string, cursorIndex: number) => {
    const textBeforeCursor = val.slice(0, cursorIndex);
    const lastDoubleBracketIndex = textBeforeCursor.lastIndexOf("[[");

    if (lastDoubleBracketIndex !== -1) {
      const query = textBeforeCursor.slice(lastDoubleBracketIndex + 2);
      if (!query.includes("]]") && !query.includes("\n")) {
        setWikiSuggestQuery(query);
        setWikiSuggestCursorPos(lastDoubleBracketIndex);
        setWikiSuggestMode("wiki");

        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          const textUpToBracket = textBeforeCursor.slice(0, lastDoubleBracketIndex);
          const lines = textUpToBracket.split("\n");
          const lineNumber = lines.length;
          const charsOnLine = lines[lines.length - 1].length;
          const scrollTop = textareaRef.current.scrollTop;
          const lineHeight = 22;
          const charWidth = 7.5;
          const popupHeight = 290;

          const cursorY = rect.top + lineNumber * lineHeight - scrollTop;
          const cursorX = rect.left + charsOnLine * charWidth + 16;
          const spaceBelow = window.innerHeight - (cursorY + lineHeight);
          const computedTop = spaceBelow >= popupHeight
            ? cursorY + lineHeight + 4
            : cursorY - popupHeight - 4;

          setWikiSuggestPos({
            top: Math.max(8, computedTop),
            left: Math.min(Math.max(cursorX, 320), window.innerWidth - 20),
          });
        }

        setWikiSuggestOpen(true);
        return;
      }
    }
    setWikiSuggestOpen(false);
  };

  const handleWikiKeyDown = (e: React.KeyboardEvent) => {
    if (!wikiSuggestOpen || suggestedItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setWikiSuggestIndex((prev) => (prev + 1) % suggestedItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setWikiSuggestIndex((prev) => (prev - 1 + suggestedItems.length) % suggestedItems.length);
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const targetItem = suggestedItems[wikiSuggestIndex] || suggestedItems[0];
      if (targetItem) {
        insertSuggestion(targetItem);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setWikiSuggestOpen(false);
    }
  };

  const recordUndoSnapshot = (oldTitle = editorTitle, oldContent = editorContent) => {
    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      return;
    }
    setUndoStack((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.title === oldTitle && last.content === oldContent) {
        return prev;
      }
      return [
        ...prev.slice(-40),
        { title: oldTitle, content: oldContent, category: editorCategory, tags: editorTags },
      ];
    });
    setRedoStack([]);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    recordUndoSnapshot(editorTitle, editorContent);
    setEditorTitle(val);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorIndex = e.target.selectionStart;
    recordUndoSnapshot(editorTitle, editorContent);
    setEditorContent(val);
    checkWikiTrigger(val, cursorIndex);
  };

  // Global Keyboard Shortcuts (Ctrl+S to Save, Ctrl+Z to Undo, Ctrl+Y / Ctrl+Shift+Z to Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (currentActiveNoteId && !isPending) {
          handleSaveNote();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (undoStack.length > 0 && document.activeElement === textareaRef.current) {
          e.preventDefault();
          e.stopPropagation();
          handleUndo();
        }
      } else if (
        (isCtrlOrCmd && e.key.toLowerCase() === "y") ||
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        if (redoStack.length > 0 && document.activeElement === textareaRef.current) {
          e.preventDefault();
          e.stopPropagation();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentActiveNoteId, isPending, editorTitle, editorContent, editorCategory, editorTags, editorFolderId, undoStack, redoStack]);

  const handleTextareaKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    checkWikiTrigger(target.value, target.selectionStart);
  };

  const insertSuggestion = (item: { title: string; type: "note" | "asset"; urlOrPath?: string; assetType?: string }) => {
    if (wikiSuggestCursorPos === null) return;
    const currentVal = editorContent;

    let textBefore = "";
    let textAfter = "";

    if (wikiSuggestMode === "wiki") {
      textBefore = currentVal.slice(0, wikiSuggestCursorPos);
      const currentCursor = textareaRef.current ? textareaRef.current.selectionStart : currentVal.length;
      textAfter = currentVal.slice(currentCursor);
    } else {
      textBefore = currentVal.slice(0, wikiSuggestCursorPos);
      textAfter = currentVal.slice(wikiSuggestCursorPos);
    }

    let snippet = "";
    if (item.type === "note") {
      snippet = `[[${item.title}]]`;
    } else {
      const url = item.urlOrPath || "";
      if (item.assetType === "image" || isImageUrl(url) || item.assetType === "video" || isVideoUrl(url) || extractYouTubeId(url)) {
        snippet = `![${item.title}](${url})`;
      } else {
        snippet = `[${item.title}](${url})`;
      }
    }

    const newVal = `${textBefore}${snippet}${textAfter}`;
    setEditorContent(newVal);
    setWikiSuggestOpen(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = textBefore.length + snippet.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleOpenAttachPopup = () => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || 0;
    setWikiSuggestCursorPos(cursorPos);
    setWikiSuggestQuery("");
    setWikiSuggestTab("all");
    setWikiSuggestMode("attach");
    const rect = textareaRef.current.getBoundingClientRect();
    setWikiSuggestPos({
      top: Math.max(100, rect.top + 60),
      left: Math.min(window.innerWidth - 350, rect.left + rect.width - 20),
    });
    setWikiSuggestOpen(true);
  };

  const suggestedItems = React.useMemo(() => {
    const q = wikiSuggestQuery.toLowerCase().trim();
    const items: Array<{
      id: string;
      title: string;
      type: "note" | "asset";
      category?: string;
      urlOrPath?: string;
      assetType?: string;
    }> = [];

    if (wikiSuggestTab === "all" || wikiSuggestTab === "notes") {
      initialNotes.forEach((n) => {
        if (!q || n.title.toLowerCase().includes(q)) {
          items.push({ id: `note-${n.id}`, title: n.title, type: "note", category: n.category });
        }
      });
    }

    if (wikiSuggestTab === "all" || wikiSuggestTab === "assets") {
      (initialAssets || []).forEach((a) => {
        if (!q || a.title.toLowerCase().includes(q) || (a.tags && a.tags.toLowerCase().includes(q))) {
          items.push({
            id: `asset-${a.id}`,
            title: a.title,
            type: "asset",
            category: a.type,
            urlOrPath: a.urlOrPath,
            assetType: a.type,
          });
        }
      });
    }

    return items;
  }, [wikiSuggestQuery, wikiSuggestTab, initialNotes, initialAssets]);

  // Sort & Category filtering for notes
  const [sortBy, setSortBy] = useState<"updated-desc" | "updated-asc" | "title-asc" | "title-desc">("updated-desc");

  const filteredNotes = initialNotes
    .filter((note) => {
      if (categoryFilter === "all") return true;
      return note.category === categoryFilter;
    })
    .sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (sortBy === "updated-desc") {
        return timeB - timeA;
      }
      if (sortBy === "updated-asc") {
        return timeA - timeB;
      }
      if (sortBy === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "title-desc") {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

  const handleOpenCreateFolderModal = (parentId?: number | null) => {
    setNewFolderParentId(parentId ? parentId.toString() : "none");
    setNewFolderName("");
    setIsFolderDialogOpen(true);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const parentIdNum = newFolderParentId !== "none" ? parseInt(newFolderParentId, 10) : null;

    startTransition(async () => {
      await createFolderAction(newFolderName, parentIdNum);
      setNewFolderName("");
      setIsFolderDialogOpen(false);
    });
  };

  const handleOpenRenameFolderModal = (folder: Folder) => {
    setRenamingFolder(folder);
    setRenamingFolderName(folder.name);
  };

  const handleRenameFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder || !renamingFolderName.trim()) return;

    startTransition(async () => {
      await renameFolderAction(renamingFolder.id, renamingFolderName);
      setRenamingFolder(null);
      setRenamingFolderName("");
    });
  };

  const handleCreateNote = () => {
    if (isDirty) {
      setUnsavedActionNotice("creating a new note");
      return;
    }
    startTransition(async () => {
      const result = await createNoteAction({
        title: "Untitled Note",
        content: "",
        category: "idea",
        tags: "",
      });
      if (result.success && result.insertId) {
        const newNote: Note = {
          id: result.insertId,
          title: "Untitled Note",
          content: "",
          category: "idea",
          tags: "",
          folderId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        selectNoteAndPushHistory(newNote);
        setViewMode("preview");
      }
    });
  };

  const handleCreateNoteInFolder = (folderId: number) => {
    if (isDirty) {
      setUnsavedActionNotice("creating a new note");
      return;
    }
    startTransition(async () => {
      const result = await createNoteAction({
        title: "Untitled Note",
        content: "",
        category: "idea",
        tags: "",
        folderId: folderId,
      });
      if (result.success && result.insertId) {
        const newNote: Note = {
          id: result.insertId,
          title: "Untitled Note",
          content: "",
          category: "idea",
          tags: "",
          folderId: folderId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        selectNoteAndPushHistory(newNote);
        setViewMode("preview");
      }
    });
  };

  const handleSaveNote = () => {
    if (!currentActiveNoteId) return;

    startTransition(async () => {
      await updateNoteAction(currentActiveNoteId, {
        title: editorTitle,
        content: editorContent,
        category: editorCategory,
        tags: editorTags,
        folderId: editorFolderId !== "none" ? parseInt(editorFolderId, 10) : null,
      });
      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 2000);
    });
  };

  // Move note to target folder (via Drag & Drop or Cut-Paste)
  const handleMoveNoteToFolder = (noteId: number, targetFolderId: number | null) => {
    if (isDirty && noteId === currentActiveNoteId) {
      setUnsavedActionNotice("moving this note to another folder");
      return;
    }
    if (noteId === currentActiveNoteId) {
      setEditorFolderId(targetFolderId ? targetFolderId.toString() : "none");
    }
    startTransition(async () => {
      await updateNoteAction(noteId, { folderId: targetFolderId });
    });
  };

  const handleMoveFolderToFolder = (folderId: number, targetParentId: number | null) => {
    if (folderId === targetParentId) return;
    startTransition(async () => {
      await moveFolderAction(folderId, targetParentId);
    });
  };

  const handleCutNote = (note: Note) => {
    if (isDirty && note.id === currentActiveNoteId) {
      setUnsavedActionNotice("cutting this note");
      return;
    }
    setClipboardNote({ action: "cut", note });
  };

  const handleCopyNote = (note: Note) => {
    if (isDirty && note.id === currentActiveNoteId) {
      setUnsavedActionNotice("duplicating this note");
      return;
    }
    setClipboardNote({ action: "copy", note });
  };

  const handlePasteNoteToFolder = (targetFolderId: number | null) => {
    if (!clipboardNote) return;

    if (clipboardNote.action === "cut") {
      handleMoveNoteToFolder(clipboardNote.note.id, targetFolderId);
      setClipboardNote(null);
    } else if (clipboardNote.action === "copy") {
      startTransition(async () => {
        const result = await createNoteAction({
          title: `${clipboardNote.note.title} (Copy)`,
          content: clipboardNote.note.content,
          category: clipboardNote.note.category as any,
          tags: clipboardNote.note.tags,
          folderId: targetFolderId,
        });
        if (result.success && result.insertId) {
          const duplicatedNote: Note = {
            id: result.insertId,
            title: `${clipboardNote.note.title} (Copy)`,
            content: clipboardNote.note.content,
            category: clipboardNote.note.category as any,
            tags: clipboardNote.note.tags,
            folderId: targetFolderId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          selectNoteAndPushHistory(duplicatedNote);
        }
      });
      setClipboardNote(null);
    }
  };

  // Breadcrumb Path builder
  const getBreadcrumbPath = (note: Note | null, foldersList: Folder[]): string[] => {
    if (!note) return ["Vault"];
    const path: string[] = [note.title];
    let currentFolderId = note.folderId;

    while (currentFolderId) {
      const parentFolder = foldersList.find((f) => f.id === currentFolderId);
      if (parentFolder) {
        path.unshift(parentFolder.name);
        currentFolderId = parentFolder.parentId || null;
      } else {
        break;
      }
    }

    path.unshift("Vault");
    return path;
  };

  const wordCount = editorContent.trim() ? editorContent.trim().split(/\s+/).length : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)] min-h-[650px] font-mono">
      
      {/* ========================================================================= */}
      {/* LEFT PANE: RECURSIVE FOLDER TREE & SEARCH NAVIGATOR */}
      {/* ========================================================================= */}
      <div className="lg:col-span-4 glass-panel p-4 rounded-3xl flex flex-col h-full overflow-hidden border border-white/10 shadow-lg">
        
        {/* Top Header & Creation Buttons */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
          <div className="flex items-center gap-2 font-mono font-bold text-xs text-white">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>SECOND BRAIN VAULT</span>
            <Badge variant="outline" className="border-white/10 text-slate-300 font-mono text-[11px] ml-1">
              {initialNotes.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {/* New Folder Modal */}
            <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleOpenCreateFolderModal()}
                className="border-white/15 text-slate-300 hover:bg-white/10 text-[11px] font-mono rounded-xl h-8 px-2.5 gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                Folder
              </Button>

              <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
                <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
                  <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-indigo-400" /> CREATE NEW FOLDER
                  </DialogTitle>
                  <button
                    onClick={() => setIsFolderDialogOpen(false)}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </DialogHeader>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Folder Name</label>
                    <Input
                      autoFocus
                      required
                      placeholder="e.g. Architecture & Specs"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Parent Folder (Optional)</label>
                    <Select value={newFolderParentId} onValueChange={(val: any) => setNewFolderParentId(val || "none")}>
                      <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                        <div className="flex items-center gap-2 truncate">
                          <FolderIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>
                            {newFolderParentId === "none"
                              ? "None (Root Level)"
                              : initialFolders.find((f) => f.id.toString() === newFolderParentId)?.name || "Select parent..."}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[200px]">
                        <SelectItem value="none" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">None (Root Level)</SelectItem>
                        {initialFolders.map((f) => (
                          <SelectItem key={f.id} value={f.id.toString()} className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                      {isPending ? "Creating..." : "Save Folder"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Rename Folder Modal */}
            <Dialog open={renamingFolder !== null} onOpenChange={(open) => !open && setRenamingFolder(null)}>
              <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
                <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
                  <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-indigo-400" /> RENAME FOLDER
                  </DialogTitle>
                  <button onClick={() => setRenamingFolder(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </DialogHeader>

                <form onSubmit={handleRenameFolder} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Folder Name</label>
                    <Input
                      required
                      value={renamingFolderName}
                      onChange={(e) => setRenamingFolderName(e.target.value)}
                      placeholder="e.g. Architecture, Research, Journal..."
                      className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 font-mono"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                      {isPending ? "Renaming..." : "Save Name"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              size="xs"
              disabled={isPending}
              onClick={handleCreateNote}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[11px] rounded-xl h-8 px-3 gap-1 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Note
            </Button>
          </div>
        </div>

        {/* Search Bar & Sort Filter Popup */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search notes, wiki-links, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono"
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

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "h-10 w-10 rounded-2xl border border-white/15 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer transition-all flex items-center justify-center",
                sortBy !== "updated-desc" && "border-indigo-500/50 text-indigo-300 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
              )}
              title="Sort Notes Options"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#16131c] border-white/15 text-slate-200 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl font-mono text-xs space-y-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-wider px-2.5 py-1.5 font-bold">
                  SORT NOTES BY
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setSortBy("updated-desc")}
                  className="rounded-xl cursor-pointer hover:bg-white/10 flex items-center justify-between text-xs px-2.5 py-2 font-mono"
                >
                  <span>Date Updated (Newest)</span>
                  {sortBy === "updated-desc" && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("updated-asc")}
                  className="rounded-xl cursor-pointer hover:bg-white/10 flex items-center justify-between text-xs px-2.5 py-2 font-mono"
                >
                  <span>Date Updated (Oldest)</span>
                  {sortBy === "updated-asc" && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("title-asc")}
                  className="rounded-xl cursor-pointer hover:bg-white/10 flex items-center justify-between text-xs px-2.5 py-2 font-mono"
                >
                  <span>Title (A → Z)</span>
                  {sortBy === "title-asc" && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy("title-desc")}
                  className="rounded-xl cursor-pointer hover:bg-white/10 flex items-center justify-between text-xs px-2.5 py-2 font-mono"
                >
                  <span>Title (Z → A)</span>
                  {sortBy === "title-desc" && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2 shrink-0 text-slate-400 font-mono text-[11px] scrollbar-none">
          {[
            { id: "all", label: "All" },
            { id: "architecture", label: "Architecture" },
            { id: "snippet", label: "Snippets" },
            { id: "idea", label: "Ideas" },
            { id: "journal", label: "Journal" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={cn(
                "px-2.5 py-1 rounded-xl transition-all shrink-0 cursor-pointer",
                categoryFilter === cat.id
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold"
                  : "hover:bg-white/5 hover:text-slate-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* RECURSIVE FOLDER TREE COMPONENT */}
        <FolderTree
          folders={initialFolders}
          notes={filteredNotes}
          activeNoteId={currentActiveNoteId}
          searchQuery={searchQuery}
          sortBy={sortBy}
          isDirty={isDirty}
          clipboardNote={clipboardNote}
          onSelectNote={handleNoteSelect}
          onCreateFolder={(parentId) => handleOpenCreateFolderModal(parentId)}
          onCreateNoteInFolder={(folderId) => handleCreateNoteInFolder(folderId)}
          onRenameFolder={(folder) => handleOpenRenameFolderModal(folder)}
          onDeleteFolder={(folder) => setDeletingFolderConfirm(folder)}
          onDeleteNote={(note) => setDeletingNoteConfirm(note)}
          onMoveNoteToFolder={handleMoveNoteToFolder}
          onMoveFolderToFolder={handleMoveFolderToFolder}
          onCutNote={handleCutNote}
          onCopyNote={handleCopyNote}
          onPasteNoteToFolder={handlePasteNoteToFolder}
          onUnsavedActionAlert={(action) => setUnsavedActionNotice(action)}
        />
      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANE: ZETTELKASTEN MARKDOWN WORKSPACE (Spans 8 cols on lg) */}
      {/* ========================================================================= */}
      <div className="lg:col-span-8 glass-panel p-5 rounded-3xl flex flex-col h-full overflow-hidden border border-white/10 shadow-lg relative">
        {activeNote ? (
          <>
            {/* Header: Breadcrumbs & Back Button, Title Input, Mode Switcher */}
            <div className="space-y-3 pb-4 border-b border-white/10 shrink-0">
              
              {/* Breadcrumb Path & Navigation Back Button */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono text-slate-400 pb-1 scrollbar-none">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={history.length <= 1}
                    onClick={handleGoBack}
                    className={cn(
                      "font-mono text-xs rounded-xl h-7 px-2.5 gap-1.5 transition-all shadow-sm mr-1 shrink-0",
                      history.length <= 1
                        ? "opacity-40 border-white/10 text-slate-500 cursor-not-allowed"
                        : "border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                    )}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </Button>

                  <div className="flex items-center gap-1.5 flex-wrap text-slate-400">
                    {getBreadcrumbPath(activeNote, initialFolders).map((segment, idx, arr) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-slate-600 font-bold">/</span>}
                        <span className={idx === arr.length - 1 ? "text-indigo-300 font-bold" : "text-slate-400"}>
                          {segment}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Unsaved Changes Indicator */}
                {isDirty && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono px-2.5 py-0.5 rounded-xl font-bold shadow-md shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" /> Unsaved
                  </span>
                )}
              </div>

              {/* Title Input & Action Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Input
                  value={editorTitle}
                  onChange={handleTitleChange}
                  placeholder="Note Title..."
                  className="bg-transparent border-none text-xl sm:text-2xl font-bold text-white focus-visible:ring-0 px-2 py-1 h-auto font-mono placeholder:text-slate-600 tracking-tight"
                />

                <div className="flex items-center gap-2 shrink-0">
                  {/* UNDO & REDO BUTTONS */}
                  {viewMode === "edit" && (
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/15 p-1 rounded-2xl">
                      <button
                        type="button"
                        disabled={undoStack.length === 0}
                        onClick={handleUndo}
                        className={cn(
                          "p-2 rounded-xl text-xs transition-all cursor-pointer",
                          undoStack.length === 0 ? "opacity-30 cursor-not-allowed text-slate-500" : "text-slate-200 hover:bg-white/10 hover:text-white"
                        )}
                        title="Undo (Ctrl+Z)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={redoStack.length === 0}
                        onClick={handleRedo}
                        className={cn(
                          "p-2 rounded-xl text-xs transition-all cursor-pointer",
                          redoStack.length === 0 ? "opacity-30 cursor-not-allowed text-slate-500" : "text-slate-200 hover:bg-white/10 hover:text-white"
                        )}
                        title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Mode Switcher */}
                  <div className="flex items-center bg-white/[0.04] border border-white/15 p-1 rounded-2xl">
                    <button
                      onClick={() => setViewMode("edit")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1 transition-all cursor-pointer",
                        viewMode === "edit" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setViewMode("preview")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1 transition-all cursor-pointer",
                        viewMode === "preview" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>

                  {/* FULL READ MODE BUTTON */}
                  <Button
                    onClick={handleOpenFullReadModal}
                    className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 rounded-2xl h-10 px-3.5 font-mono text-xs gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
                    title="Open Full Screen Reader View"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-purple-300" /> Full Read
                  </Button>

                  {/* ATTACH ASSET / DRIVE / LINK BUTTON */}
                  {viewMode === "edit" && (
                    <Button
                      onClick={handleOpenAttachPopup}
                      className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 rounded-2xl h-10 px-3.5 font-mono text-xs gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
                      title="Attach Asset Vault item, Local Drive file, or Link"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-emerald-300" /> Attach
                    </Button>
                  )}

                  {/* Save Action */}
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={handleSaveNote}
                    title="Save Note (Ctrl+S)"
                    className={cn(
                      "font-mono text-xs rounded-2xl h-10 px-4 gap-1.5 transition-all shadow-lg cursor-pointer",
                      isSavedNotice
                        ? "bg-emerald-600 text-white"
                        : isDirty
                        ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/40 animate-pulse"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                    )}
                  >
                    {isSavedNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Save
                      </>
                    )}
                  </Button>

                  {/* Delete Action */}
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => setDeletingNoteConfirm(activeNote)}
                    className="w-10 h-10 rounded-2xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    title="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Category & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">

                <div className="flex items-center gap-2">
                  <Select value={editorCategory} onValueChange={(val: any) => setEditorCategory(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-10 px-3.5 font-mono">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-400">Type:</span>
                        <span className="capitalize text-white font-semibold">{editorCategory}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5 min-w-[180px]">
                      <SelectItem value="architecture" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Architecture</SelectItem>
                      <SelectItem value="snippet" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Code Snippet</SelectItem>
                      <SelectItem value="idea" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Idea</SelectItem>
                      <SelectItem value="journal" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Journal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={editorTags}
                      onChange={(e) => setEditorTags(e.target.value)}
                      placeholder="Tags (comma-separated)..."
                      className="pl-8 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* WIKI-LINK & ATTACHMENT SUGGESTION POPOVER */}
            {wikiSuggestOpen && viewMode === "edit" && (
              <div
                style={{
                  position: "fixed",
                  top: `${wikiSuggestPos.top}px`,
                  left: `${wikiSuggestPos.left}px`,
                  transform: "translateX(-100%)",
                  zIndex: 9999,
                }}
                className="bg-[#141420] border border-purple-500/40 text-slate-100 rounded-2xl p-3 shadow-2xl w-84 space-y-2.5 font-mono text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between text-[10px] text-purple-300 font-bold border-b border-white/10 pb-1.5 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-purple-400" /> Link Note or Attach Asset / Drive
                  </span>
                  <button onClick={() => setWikiSuggestOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Category Tabs: All | Notes | Assets / Drive */}
                <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setWikiSuggestTab("all")}
                    className={cn(
                      "flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center font-bold",
                      wikiSuggestTab === "all" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setWikiSuggestTab("notes")}
                    className={cn(
                      "flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center font-bold",
                      wikiSuggestTab === "notes" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Notes ({initialNotes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWikiSuggestTab("assets")}
                    className={cn(
                      "flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center font-bold",
                      wikiSuggestTab === "assets" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Assets & Drive ({(initialAssets || []).length})
                  </button>
                </div>

                {/* Search Input Bar inside Suggestion Popup */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search note, asset, or drive file..."
                    value={wikiSuggestQuery}
                    onChange={(e) => setWikiSuggestQuery(e.target.value)}
                    onKeyDown={handleWikiKeyDown}
                    className="pl-8 bg-white/[0.06] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-xl h-8 font-mono"
                  />
                </div>

                {/* Filtered Items List */}
                <div ref={itemsContainerRef} className="max-h-52 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {suggestedItems.length === 0 ? (
                    <div className="p-3 text-center text-slate-500 text-xs italic font-sans">
                      No items found matching &quot;{wikiSuggestQuery}&quot;
                    </div>
                  ) : (
                    suggestedItems.map((item, idx) => {
                      const isSelected = idx === wikiSuggestIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => insertSuggestion(item)}
                          onMouseEnter={() => setWikiSuggestIndex(idx)}
                          className={cn(
                            "p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all group border",
                            isSelected
                              ? "bg-purple-600/50 border-purple-400/60 text-white font-bold shadow-lg"
                              : "bg-transparent border-transparent text-slate-300 hover:bg-purple-600/20"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.type === "note" ? (
                              <LinkIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            ) : item.assetType === "image" || isImageUrl(item.urlOrPath || "") ? (
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : item.assetType === "video" || isVideoUrl(item.urlOrPath || "") || extractYouTubeId(item.urlOrPath || "") ? (
                              <Video className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ) : item.urlOrPath?.startsWith("/drive") ? (
                              <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <Paperclip className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate font-semibold text-xs">
                              {item.title}
                            </span>
                          </div>
                          <Badge variant="outline" className={cn("text-[9px] uppercase px-1.5 py-0 shrink-0", isSelected ? "border-purple-300 text-purple-200 bg-purple-500/20" : "border-white/10 text-slate-400")}>
                            {item.type === "note" ? item.category || "Note" : item.category || "Asset"}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="text-[9px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-white/10 shrink-0">
                  <span>↑↓ Navigate by arrow</span>
                  <span>Tab / Enter to autocomplete</span>
                </div>
              </div>
            )}

            {/* Viewport: Editor vs ReactMarkdown Preview */}
            <div className="flex-1 py-2 overflow-y-auto scrollbar-thin relative flex flex-col">
              {viewMode === "edit" ? (
                <Textarea
                  ref={textareaRef}
                  value={editorContent}
                  onChange={handleTextareaChange}
                  onKeyUp={handleTextareaKeyUp}
                  onKeyDown={handleWikiKeyDown}
                  placeholder="Start typing markdown, code blocks, or wiki-links like [[Note Title]]..."
                  className="w-full h-full min-h-[380px] bg-transparent border-none text-slate-200 font-mono text-xs focus-visible:ring-0 resize-none leading-relaxed p-4 placeholder:text-slate-600 placeholder:italic"
                />
              ) : (
                <div className="prose prose-invert max-w-none font-sans text-slate-200 text-sm leading-relaxed space-y-3 p-4 flex-1">
                  {!editorContent.trim() ? (
                    <div className="flex flex-col items-center justify-center my-auto py-12 px-6 text-center space-y-4 rounded-3xl bg-white/[0.015] border border-white/10">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
                        <FileText className="w-7 h-7 opacity-80" />
                      </div>
                      <div className="space-y-1 max-w-sm">
                        <h4 className="text-sm font-mono font-bold text-slate-200 tracking-wide uppercase">
                          EMPTY NOTE WORKSPACE
                        </h4>
                        <p className="text-xs text-slate-400 font-sans leading-relaxed">
                          Switch to <span className="text-indigo-300 font-mono font-semibold">Edit</span> mode to write markdown, add code blocks, or link notes using <span className="text-indigo-300 font-mono font-semibold">[[Wiki-Links]]</span>.
                        </p>
                      </div>
                      <Button
                        size="xs"
                        onClick={() => setViewMode("edit")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-xl h-8 px-4 gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Start Editing
                      </Button>
                    </div>
                  ) : (
                    <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ul({ children }) {
                        return <ul className="list-disc list-inside space-y-1.5 my-3 pl-2 text-slate-200">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal list-inside space-y-1.5 my-3 pl-2 text-slate-200">{children}</ol>;
                      },
                      li({ children }) {
                        return <li className="text-slate-200 leading-relaxed font-sans">{children}</li>;
                      },
                      h1({ children }) {
                        return <h1 className="text-xl font-bold text-white mt-4 mb-2 font-mono tracking-tight border-b border-white/10 pb-1">{children}</h1>;
                      },
                      h2({ children }) {
                        return <h2 className="text-lg font-bold text-white mt-4 mb-2 font-mono tracking-tight">{children}</h2>;
                      },
                      h3({ children }) {
                        return <h3 className="text-base font-bold text-white mt-3 mb-1.5 font-mono">{children}</h3>;
                      },
                      p({ children }) {
                        return <div className="mb-2 text-slate-200 leading-relaxed font-sans">{children}</div>;
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-4 border-indigo-500/60 bg-indigo-500/10 p-3 rounded-r-2xl my-3 italic text-indigo-200 font-mono text-xs">
                            {children}
                          </blockquote>
                        );
                      },
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeString = String(children).replace(/\n$/, "");
                        return !inline && match ? (
                          <CodeBlockWithCopy language={match[1]} code={codeString} style={vscDarkPlus as any} />
                        ) : (
                          <code className="bg-white/10 text-indigo-300 font-mono text-xs px-1.5 py-0.5 rounded-lg border border-white/10" {...props}>
                            {children}
                          </code>
                        );
                      },

                      img({ src, alt }: any) {
                        if (!src) return null;
                        const ytId = extractYouTubeId(src);
                        if (ytId) {
                          return (
                            <div className="my-3 rounded-2xl overflow-hidden border border-white/15 shadow-2xl aspect-video bg-black/40 max-w-2xl">
                              <iframe
                                src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                                title={alt || "YouTube Video"}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          );
                        }
                        if (isVideoUrl(src)) {
                          return (
                            <video controls className="max-h-96 w-full rounded-2xl border border-white/15 shadow-xl my-3 bg-black/40">
                              <source src={src} />
                              Your browser does not support video playback.
                            </video>
                          );
                        }
                        return (
                          <div className="my-3 space-y-1 group">
                            <a href={src} target="_blank" rel="noopener noreferrer" className="block w-fit">
                              <img
                                src={src}
                                alt={alt || "Note Attachment"}
                                className="max-h-96 rounded-2xl border border-white/15 shadow-xl object-contain bg-black/20 hover:opacity-90 transition-opacity"
                              />
                            </a>
                            {alt && <span className="block text-[11px] text-slate-400 font-mono italic">{alt}</span>}
                          </div>
                        );
                      },
                      a({ href, children, ...props }: any) {
                        if (!href) return <span>{children}</span>;

                        if (href.startsWith("#wiki-link:")) {
                          const targetTitle = decodeURIComponent(href.replace("#wiki-link:", ""));
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openWikiLinkNote(targetTitle);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 rounded-xl bg-indigo-500/25 text-indigo-200 border border-indigo-500/50 hover:bg-indigo-500/40 hover:border-indigo-400 font-mono text-xs cursor-pointer transition-all shadow-[0_0_10px_rgba(99,102,241,0.25)] font-semibold"
                              title={`Jump to note: ${targetTitle}`}
                            >
                              <LinkIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{children}</span>
                            </button>
                          );
                        }

                        const ytId = extractYouTubeId(href);
                        if (ytId) {
                          return (
                            <div className="my-3 space-y-2 max-w-2xl">
                              <div className="rounded-2xl overflow-hidden border border-white/15 shadow-2xl aspect-video bg-black/40">
                                <iframe
                                  src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                                  title={typeof children === "string" ? children : "YouTube Video"}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                                <span className="truncate">{children}</span>
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                  Open YouTube <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          );
                        }

                        if (isImageUrl(href)) {
                          return (
                            <div className="my-3 space-y-1">
                              <a href={href} target="_blank" rel="noopener noreferrer" className="block group w-fit">
                                <img
                                  src={href}
                                  alt={typeof children === "string" ? children : "Attached Image"}
                                  className="max-h-96 rounded-2xl border border-white/15 shadow-xl object-contain bg-black/20 hover:opacity-90 transition-opacity"
                                />
                              </a>
                              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                <span className="truncate">{children}</span>
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          );
                        }

                        if (isVideoUrl(href)) {
                          return (
                            <div className="my-3 space-y-1 max-w-2xl">
                              <video controls className="max-h-96 w-full rounded-2xl border border-white/15 shadow-xl bg-black/40">
                                <source src={href} />
                              </video>
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                {children} <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          );
                        }

                        if (isAudioUrl(href)) {
                          return (
                            <div className="my-3 space-y-1 max-w-md">
                              <audio controls className="w-full rounded-xl border border-white/15 bg-black/40 p-2">
                                <source src={href} />
                              </audio>
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                {children} <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          );
                        }

                        return (
                          <a
                            href={href}
                            target={href.startsWith("/") ? "_self" : "_blank"}
                            rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
                            className="inline-flex items-center gap-1 text-indigo-400 underline hover:text-indigo-300 font-mono font-medium transition-colors"
                            {...props}
                          >
                            <span>{children}</span>
                            {!href.startsWith("#") && <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />}
                          </a>
                        );
                      },
                    }}
                  >
                    {preprocessWikiLinks(editorContent)}
                  </ReactMarkdown>
                )}
                </div>
              )}
            </div>

            {/* Footer Metrics Status */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 shrink-0">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Updated: {activeNote.updatedAt ? new Date(activeNote.updatedAt).toLocaleString() : "Just now"}
              </span>
              <span>
                {wordCount} words • {editorContent.length} chars • Type [[ to link notes
              </span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs space-y-4 p-6">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-xl">
              <FileText className="w-8 h-8 opacity-70" />
            </div>
            <div className="text-center space-y-1.5 max-w-sm">
              <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase">
                NO NOTE SELECTED
              </h3>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Select a note from the Second Brain vault tree on the left, or click <span className="text-indigo-300 font-mono font-semibold">+ Note</span> to create a new one.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* COOL GLASSMORPHIC UNSAVED CHANGES WARNING DIALOG */}
      {isUnsavedWarningOpen && pendingNoteToSelect && (
        <Dialog open={isUnsavedWarningOpen} onOpenChange={() => setIsUnsavedWarningOpen(false)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-amber-500/40 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">UNSAVED CHANGES DETECTED</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                You have unsaved edits in <span className="text-amber-300 font-bold">&quot;{activeNote?.title}&quot;</span>. Do you want to save before switching to <span className="text-indigo-300 font-bold">&quot;{pendingNoteToSelect.title}&quot;</span>?
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                disabled={isPending}
                onClick={handleConfirmSaveAndSwitch}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {isPending ? "Saving..." : "Save & Switch Note"}
              </Button>
              <Button
                variant="outline"
                onClick={handleConfirmDiscardAndSwitch}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Discard Changes &amp; Switch
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsUnsavedWarningOpen(false);
                  setPendingNoteToSelect(null);
                }}
                className="text-slate-400 hover:text-white rounded-2xl h-10 text-xs font-mono cursor-pointer"
              >
                Stay &amp; Keep Editing
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* GLASSMORPHIC ACTION UNSAVED WARNING DIALOG */}
      {unsavedActionNotice && (
        <Dialog open={!!unsavedActionNotice} onOpenChange={() => setUnsavedActionNotice(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-amber-500/40 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">UNSAVED CHANGES DETECTED</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                You have unsaved edits in <span className="text-amber-300 font-bold">&quot;{activeNote?.title}&quot;</span>. Please save your changes before <span className="text-indigo-300 font-bold">{unsavedActionNotice}</span>.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  handleSaveNote();
                  setUnsavedActionNotice(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {isPending ? "Saving..." : "Save Note Now"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setUnsavedActionNotice(null)}
                className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono cursor-pointer"
              >
                Keep Editing
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* FULL READ MODE DIALOG MODAL */}
      {isFullReadModalOpen && activeNote && (
        <Dialog open={isFullReadModalOpen} onOpenChange={setIsFullReadModalOpen}>
          <DialogContent showCloseButton={false} className="bg-[#12121c] border-purple-500/30 text-slate-100 max-w-5xl w-[95vw] h-[92vh] rounded-3xl p-0 shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden font-mono">
            {/* Full Read Floating Header */}
            <div className="p-4 px-6 border-b border-white/15 flex items-center justify-between bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={fullReadHistory.length <= 1}
                  onClick={handleFullReadGoBack}
                  className={cn(
                    "font-mono text-xs rounded-xl h-8 px-3 gap-1.5 transition-all shadow-sm shrink-0",
                    fullReadHistory.length <= 1
                      ? "opacity-40 border-white/10 text-slate-500 cursor-not-allowed"
                      : "border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                  )}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/20 font-mono text-xs px-2.5 py-1 shrink-0">
                  📖 FULL READ READER MODE
                </Badge>
                <h2 className="text-base font-bold text-white font-mono truncate">{editorTitle}</h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleCopyContent}
                  variant="outline"
                  className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-10 px-3.5 text-xs font-mono gap-1.5 cursor-pointer"
                >
                  {isCopiedNotice ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-indigo-400" /> Copy Markdown
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setIsFullReadModalOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-10 px-4 text-xs font-mono gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  <Minimize2 className="w-3.5 h-3.5" /> Exit Full Read
                </Button>
              </div>
            </div>

            {/* Sub-Header Metadata */}
            <div className="px-6 py-3 border-b border-white/10 bg-white/[0.01] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400 shrink-0">
              <div className="flex items-center gap-3">
                <span>Category: <strong className="text-white uppercase">{editorCategory}</strong></span>
                <span>•</span>
                <span>Folder: <strong className="text-white">{editorFolderId === "none" ? "Unassigned" : initialFolders.find((f) => f.id.toString() === editorFolderId)?.name || "Unassigned"}</strong></span>
                {editorTags && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      {editorTags.split(",").map((tag, idx) => (
                        <span key={idx} className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-2 py-0.5 rounded-md text-[10px]">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <span>{wordCount} words • {editorContent.length} chars</span>
            </div>

            {/* Scrollable Distraction-Free Reading Content Pane */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-thin">
              <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold text-white font-mono tracking-tight border-b border-white/10 pb-3">
                  {editorTitle}
                </h1>

                <div className="prose prose-invert max-w-none font-sans text-slate-100 text-base leading-relaxed space-y-4">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ul({ children }) {
                        return <ul className="list-disc list-inside space-y-2 my-4 pl-3 text-slate-100">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal list-inside space-y-2 my-4 pl-3 text-slate-100">{children}</ol>;
                      },
                      li({ children }) {
                        return <li className="text-slate-100 leading-relaxed font-sans">{children}</li>;
                      },
                      h1({ children }) {
                        return <h1 className="text-2xl font-bold text-white mt-6 mb-3 font-mono tracking-tight border-b border-white/10 pb-1">{children}</h1>;
                      },
                      h2({ children }) {
                        return <h2 className="text-xl font-bold text-white mt-5 mb-2 font-mono tracking-tight">{children}</h2>;
                      },
                      h3({ children }) {
                        return <h3 className="text-lg font-bold text-white mt-4 mb-2 font-mono">{children}</h3>;
                      },
                      p({ children }) {
                        return <p className="mb-3 text-slate-100 leading-relaxed font-sans text-base">{children}</p>;
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-4 border-indigo-500/70 bg-indigo-500/10 p-4 rounded-r-2xl my-4 italic text-indigo-200 font-mono text-sm leading-relaxed">
                            {children}
                          </blockquote>
                        );
                      },
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeString = String(children).replace(/\n$/, "");
                        return !inline && match ? (
                          <CodeBlockWithCopy language={match[1]} code={codeString} style={vscDarkPlus as any} />
                        ) : (
                          <code className="bg-white/10 text-indigo-300 font-mono text-xs px-2 py-0.5 rounded-lg border border-white/10" {...props}>
                            {children}
                          </code>
                        );
                      },

                      a({ href, children, ...props }: any) {
                        if (href && href.startsWith("#wiki-link:")) {
                          const targetTitle = decodeURIComponent(href.replace("#wiki-link:", ""));
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openWikiLinkNote(targetTitle);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 my-0.5 rounded-xl bg-indigo-500/25 text-indigo-200 border border-indigo-500/50 hover:bg-indigo-500/40 hover:border-indigo-400 font-mono text-xs cursor-pointer transition-all shadow-[0_0_10px_rgba(99,102,241,0.25)] font-semibold"
                              title={`Jump to note: ${targetTitle}`}
                            >
                              <LinkIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{children}</span>
                            </button>
                          );
                        }
                        return (
                          <a href={href} className="text-indigo-400 underline hover:text-indigo-300" {...props}>
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {preprocessWikiLinks(editorContent)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC MISSING NOTE ALERT DIALOG */}
      {missingNoteModalTitle && (
        <Dialog open={!!missingNoteModalTitle} onOpenChange={() => setMissingNoteModalTitle(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-amber-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">NOTE NOT FOUND IN VAULT</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Note titled <span className="text-amber-300 font-bold">&quot;{missingNoteModalTitle}&quot;</span> does not exist in your Second Brain yet.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setMissingNoteModalTitle(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Dismiss
              </Button>
              <Button
                onClick={() => {
                  const titleToCreate = missingNoteModalTitle;
                  setMissingNoteModalTitle(null);
                  startTransition(async () => {
                    const res = await createNoteAction({
                      title: titleToCreate,
                      content: `# ${titleToCreate}\n\nCreated from Wiki-Link reference.`,
                      category: "idea",
                    });
                    if (res.success && res.insertId) {
                      const createdNote: Note = {
                        id: res.insertId,
                        title: titleToCreate,
                        content: `# ${titleToCreate}\n\nCreated from Wiki-Link reference.`,
                        category: "idea",
                        tags: "",
                        folderId: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      };
                      selectNoteAndPushHistory(createdNote);
                    }
                  });
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                + Create Note Now
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC DELETE NOTE CONFIRMATION DIALOG */}
      {deletingNoteConfirm && (
        <Dialog open={!!deletingNoteConfirm} onOpenChange={() => setDeletingNoteConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE VAULT NOTE</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete note <span className="text-rose-300 font-bold">&quot;{deletingNoteConfirm.title}&quot;</span> from your Second Brain?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingNoteConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingNoteConfirm.id;
                  startTransition(async () => {
                    await deleteNoteAction(id);
                    setDeletingNoteConfirm(null);
                    if (id === currentActiveNoteId) {
                      setHistory([]);
                    } else {
                      setHistory((prev) => prev.filter((hId) => hId !== id));
                    }
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Delete Note"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC DELETE FOLDER CONFIRMATION DIALOG */}
      {deletingFolderConfirm && (
        <Dialog open={!!deletingFolderConfirm} onOpenChange={() => setDeletingFolderConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE FOLDER</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete folder <span className="text-rose-300 font-bold">&quot;{deletingFolderConfirm.name}&quot;</span>?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This will cascade delete all subfolders and notes inside this folder.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingFolderConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingFolderConfirm.id;
                  startTransition(async () => {
                    await deleteFolderAction(id);
                    setDeletingFolderConfirm(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Delete Folder"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
