"use client";

import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  KeyRound,
  X,
  AlertTriangle,
  Loader2,
  Lock,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { KnowledgeEntry } from "@/db/schema";
import { VaultCard } from "@/components/knowledge/VaultCard";
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from "./actions";
import { cn } from "@/lib/utils";

interface KnowledgeClientProps {
  initialEntries: KnowledgeEntry[];
  initialSearchQuery?: string;
}

const CATEGORY_PRESETS = ["Bio", "Work", "Finance", "Preferences"];

export function KnowledgeClient({
  initialEntries,
  initialSearchQuery = "",
}: KnowledgeClientProps) {
  const searchParams = useSearchParams();
  const urlQuery = searchParams?.get("search") || initialSearchQuery;

  const [entries, setEntries] = useState<KnowledgeEntry[]>(initialEntries);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Sync searchQuery when URL searchParam changes (e.g. from Omni AI link)
  useEffect(() => {
    const q = (searchParams?.get("search") || "").trim();
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<KnowledgeEntry | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Preferences");
  const [formContent, setFormContent] = useState("");
  const [formIsSensitive, setFormIsSensitive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Status feedback toast
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setFormTitle("");
    setFormCategory("Preferences");
    setFormContent("");
    setFormIsSensitive(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setFormTitle(entry.title);
    setFormCategory(entry.category || "Preferences");
    setFormContent(entry.content);
    setFormIsSensitive(entry.isSensitive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formContent.trim()) {
      setFormError("Content is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    if (editingEntry) {
      const res = await updateKnowledgeEntry(editingEntry.id, {
        title: formTitle,
        category: formCategory,
        content: formContent,
        isSensitive: formIsSensitive,
      });

      if (res.success) {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === editingEntry.id
              ? {
                  ...item,
                  title: formTitle.trim(),
                  category: formCategory.trim() || "Preferences",
                  content: formContent.trim(),
                  isSensitive: formIsSensitive,
                  updatedAt: new Date(),
                }
              : item
          )
        );
        triggerFeedback(res.message || "Updated successfully");
        setIsModalOpen(false);
      } else {
        setFormError(res.message || "Failed to update entry");
      }
    } else {
      const res = await createKnowledgeEntry({
        title: formTitle,
        category: formCategory,
        content: formContent,
        isSensitive: formIsSensitive,
      });

      if (res.success) {
        setEntries((prev) => [
          {
            id: crypto.randomUUID(),
            title: formTitle.trim(),
            category: formCategory.trim() || "Preferences",
            content: formContent.trim(),
            isSensitive: formIsSensitive,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          ...prev,
        ]);
        triggerFeedback(res.message || "Created successfully");
        setIsModalOpen(false);
      } else {
        setFormError(res.message || "Failed to create entry");
      }
    }

    setIsSubmitting(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;

    setIsSubmitting(true);
    const res = await deleteKnowledgeEntry(deletingEntry.id);
    if (res.success) {
      setEntries((prev) => prev.filter((item) => item.id !== deletingEntry.id));
      triggerFeedback(res.message || "Deleted entry");
      setDeletingEntry(null);
    } else {
      triggerFeedback(res.message || "Failed to delete entry");
    }
    setIsSubmitting(false);
  };

  // Categories extraction
  const allCategories = Array.from(
    new Set(["All", ...CATEGORY_PRESETS, ...entries.map((e) => e.category)])
  );

  // Filtered entries
  const filteredEntries = entries.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (!item.isSensitive && item.content.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat =
      selectedCategory === "All" ||
      (selectedCategory === "Sensitive" && item.isSensitive) ||
      item.category.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCat;
  });

  const sensitiveCount = entries.filter((e) => e.isSensitive).length;
  const aiContextCount = entries.filter((e) => !e.isSensitive).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161622] border border-indigo-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-mono text-xs animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0e0e14]/90 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Personal Knowledge Vault</span>
              <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px] font-mono">
                {entries.length} Entries
              </Badge>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Brand Voice, Bio, Preferences & Secure Credentials for Personal OS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">{aiContextCount} AI Context</span>
            <span className="text-slate-600">|</span>
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-slate-300">{sensitiveCount} Masked</span>
          </div>

          <Button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-4 py-2 text-xs font-mono gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Entry</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries by title, category..."
            className="pl-10 bg-[#0e0e14]/80 border-white/10 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono focus-visible:ring-indigo-500/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none font-mono text-xs">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer",
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20 font-bold"
                  : "bg-[#0e0e14]/60 text-slate-400 border-white/10 hover:text-white hover:bg-white/5"
              )}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => setSelectedCategory("Sensitive")}
            className={cn(
              "px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center gap-1",
              selectedCategory === "Sensitive"
                ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20 font-bold"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
            )}
          >
            <Lock className="w-3 h-3" />
            <span>Sensitive ({sensitiveCount})</span>
          </button>
        </div>
      </div>

      {/* Grid Content Area */}
      {filteredEntries.length === 0 ? (
        <div className="bg-[#0e0e14]/60 border border-white/10 rounded-3xl p-12 text-center text-slate-400 space-y-3 font-mono">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-200">No knowledge entries found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans">
            {searchQuery || selectedCategory !== "All"
              ? "Try adjusting your search query or category filter."
              : "Click 'Add Entry' above to save your Bio, Brand Voice, Preferences, or Sensitive NIK/Keys."}
          </p>
          {(searchQuery || selectedCategory !== "All") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-mono mt-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((item) => (
            <VaultCard
              key={item.id}
              entry={item}
              onEdit={openEditModal}
              onDelete={setDeletingEntry}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Entry Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0e0e14] border-white/15 text-slate-100 rounded-3xl p-6 max-w-lg max-h-[88vh] w-[94vw] shadow-2xl backdrop-blur-2xl flex flex-col font-sans">
          <DialogTitle className="shrink-0 text-base font-bold text-white flex items-center gap-2 font-mono pb-2 border-b border-white/10">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <span>{editingEntry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}</span>
          </DialogTitle>

          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3 font-sans text-xs">
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-mono text-[11px] uppercase font-bold">
                  Entry Title
                </label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. National ID (NIK), Forge25 Brand Voice, WiFi Password"
                  className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono focus-visible:ring-indigo-500/40"
                  required
                />
              </div>

              {/* Category selection */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-mono text-[11px] uppercase font-bold flex items-center justify-between">
                  <span>Category</span>
                  <span className="text-slate-500 text-[10px] font-normal">Choose or type custom</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CATEGORY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormCategory(preset)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl border text-[11px] font-mono transition-all cursor-pointer",
                        formCategory.toLowerCase() === preset.toLowerCase()
                          ? "bg-indigo-600 text-white border-indigo-500 font-bold"
                          : "bg-white/[0.04] text-slate-400 border-white/10 hover:text-white"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Category (e.g. Bio, Work, Finance, Credentials)"
                  className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono focus-visible:ring-indigo-500/40"
                />
              </div>

              {/* Content Textarea */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-mono text-[11px] uppercase font-bold">
                  Content / Value
                </label>
                <Textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Enter key info, guidelines, bio text, or sensitive key..."
                  className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl p-3 font-mono focus-visible:ring-indigo-500/40 resize-none scrollbar-thin"
                  required
                />
              </div>

              {/* Sensitive Toggle */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className={cn("w-4 h-4", formIsSensitive ? "text-rose-400" : "text-slate-400")} />
                    <span className="font-mono text-xs font-bold text-slate-200">
                      Mark as Sensitive Data
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormIsSensitive(!formIsSensitive)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative cursor-pointer",
                      formIsSensitive ? "bg-rose-600" : "bg-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 left-1",
                        formIsSensitive ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {formIsSensitive ? (
                  <p className="text-[11px] text-rose-300 font-mono leading-relaxed bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                    ⚠️ <strong>Warning:</strong> Sensitive data is masked in the UI and <strong>EXCLUDED from automatic Omni AI system prompt injection</strong> to prevent leaks to external LLMs.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-300/80 font-mono leading-relaxed bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                    ✨ Non-sensitive entries are automatically injected into Omni AI's context so the AI knows your preferences, bio, and brand guidelines!
                  </p>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-white/10 mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl h-10 px-4 text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-2xl h-10 px-6 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {isSubmitting ? "Saving..." : editingEntry ? "Save Changes" : "Create Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <DialogContent className="bg-[#0e0e14] border-rose-500/30 text-slate-100 rounded-3xl p-6 max-w-md w-[92vw] shadow-2xl backdrop-blur-2xl font-sans">
          <DialogTitle className="text-base font-bold text-rose-400 flex items-center gap-2 font-mono pb-2 border-b border-white/10">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span>Confirm Deletion</span>
          </DialogTitle>

          <div className="space-y-3 mt-3 text-xs font-mono">
            <p className="text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{deletingEntry?.title}"</strong> from Knowledge Vault?
            </p>
            <p className="text-slate-500 text-[11px]">
              This action is permanent and cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-white/10 font-mono text-xs">
            <Button
              variant="ghost"
              onClick={() => setDeletingEntry(null)}
              className="rounded-2xl h-9 px-4 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleDeleteConfirm}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-9 px-4 cursor-pointer gap-1.5 shadow-lg shadow-rose-600/30"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Delete Entry</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
