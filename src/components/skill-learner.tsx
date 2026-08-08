"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Skill, SkillMilestone, Asset, Note } from "@/db/schema";
import {
  createSkillAction,
  updateSkillAction,
  deleteSkillAction,
  createMilestoneAction,
  toggleMilestoneAction,
  deleteMilestoneAction,
} from "@/app/skills/actions";
import {
  Plus,
  Trash2,
  Brain,
  Code,
  Palette,
  Globe,
  CheckSquare,
  Square,
  Search,
  CheckCircle2,
  ChevronRight,
  Edit3,
  FileText,
  HardDrive,
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
import { Progress } from "@/components/ui/progress";
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

interface SkillLearnerProps {
  initialSkills: Skill[];
  initialMilestones: SkillMilestone[];
  initialAssets?: Asset[];
  initialNotes?: Note[];
}

import { useSearchParams } from "next/navigation";

export function SkillLearner({
  initialSkills,
  initialMilestones,
  initialAssets = [],
  initialNotes = [],
}: SkillLearnerProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [skillVisibleLimit, setSkillVisibleLimit] = useState<number>(6);
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Create Skill Modal State
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<"hard_skill" | "creative" | "language" | "soft_skill">("hard_skill");
  const [newProficiency, setNewProficiency] = useState<"beginner" | "intermediate" | "advanced" | "mastery">("beginner");
  const [newReferences, setNewReferences] = useState<ReferenceItem[]>([]);

  // Skill Detail View Modal State (ReadOnly / View Action)
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null);
  const [newMilestoneDesc, setNewMilestoneDesc] = useState("");

  // Edit Skill Modal State
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<"hard_skill" | "creative" | "language" | "soft_skill">("hard_skill");
  const [editProficiency, setEditProficiency] = useState<"beginner" | "intermediate" | "advanced" | "mastery">("beginner");
  const [editReferences, setEditReferences] = useState<ReferenceItem[]>([]);

  // Custom Glassmorphic Delete Confirmations
  const [deletingSkillConfirm, setDeletingSkillConfirm] = useState<Skill | null>(null);
  const [deletingMilestoneConfirm, setDeletingMilestoneConfirm] = useState<SkillMilestone | null>(null);

  // Fast reference lookup maps
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

  // Helper to parse reference markers from description
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

  // Filter skills
  const filteredSkills = initialSkills.filter((skill) => {
    const matchesSearch =
      skill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (skill.description && skill.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = activeCategoryTab === "all" || skill.category === activeCategoryTab;
    return matchesSearch && matchesTab;
  });

  const getProficiencyValue = (prof: string) => {
    switch (prof) {
      case "mastery": return 100;
      case "advanced": return 75;
      case "intermediate": return 50;
      default: return 25;
    }
  };

  const getProficiencyColor = (prof: string) => {
    switch (prof) {
      case "mastery": return "border-emerald-500/40 text-emerald-400 bg-emerald-500/10";
      case "advanced": return "border-purple-500/40 text-purple-300 bg-purple-500/10";
      case "intermediate": return "border-indigo-500/40 text-indigo-300 bg-indigo-500/10";
      default: return "border-amber-500/40 text-amber-400 bg-amber-500/10";
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "creative": return <Palette className="w-4 h-4 text-purple-400" />;
      case "language": return <Globe className="w-4 h-4 text-emerald-400" />;
      case "soft_skill": return <Brain className="w-4 h-4 text-amber-400" />;
      default: return <Code className="w-4 h-4 text-indigo-400" />;
    }
  };

  const formatCategoryLabel = (cat: string) => {
    switch (cat) {
      case "creative": return "Creative & Design";
      case "language": return "Languages";
      case "soft_skill": return "Soft Skills & Mindset";
      default: return "Hard & Technical Skills";
    }
  };

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const fullDesc = formatDescriptionWithRefs(newDescription, newReferences);

    startTransition(async () => {
      await createSkillAction({
        title: newTitle,
        description: fullDesc,
        category: newCategory,
        proficiency: newProficiency,
        status: "learning",
      });
      setNewTitle("");
      setNewDescription("");
      setNewReferences([]);
      setIsSkillDialogOpen(false);
    });
  };

  const handleOpenEditModal = (skill: Skill) => {
    setViewingSkill(null);
    setEditingSkill(skill);
    setEditTitle(skill.title);

    const { cleanDesc, references } = parseReferences(skill.description);
    setEditDescription(cleanDesc);
    setEditCategory(skill.category as any);
    setEditProficiency(skill.proficiency as any);
    setEditReferences(references);
  };

  const handleSaveEditSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill || !editTitle.trim()) return;

    const fullDesc = formatDescriptionWithRefs(editDescription, editReferences);

    startTransition(async () => {
      await updateSkillAction(editingSkill.id, {
        title: editTitle,
        description: fullDesc,
        category: editCategory,
        proficiency: editProficiency,
      });
      setEditingSkill(null);
    });
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingSkill || !newMilestoneDesc.trim()) return;

    startTransition(async () => {
      await createMilestoneAction(viewingSkill.id, newMilestoneDesc);
      setNewMilestoneDesc("");
    });
  };

  const handleToggleMilestone = (milestoneId: number, isCompleted: boolean) => {
    startTransition(async () => {
      await toggleMilestoneAction(milestoneId, !isCompleted);
    });
  };

  const handleProficiencyChange = (skillId: number, newProf: "beginner" | "intermediate" | "advanced" | "mastery") => {
    startTransition(async () => {
      await updateSkillAction(skillId, { proficiency: newProf });
    });
  };

  const viewingSkillMilestones = viewingSkill
    ? initialMilestones.filter((m) => m.skillId === viewingSkill.id)
    : [];

  return (
    <div className="space-y-6 font-mono">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10">
        {/* Category Tabs & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search skills matrix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 focus:border-indigo-500 font-mono"
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

          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl shrink-0">
            {[
              { id: "all", label: "All Skills" },
              { id: "hard_skill", label: "Hard Skills" },
              { id: "creative", label: "Creative" },
              { id: "language", label: "Languages" },
              { id: "soft_skill", label: "Soft Skills" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategoryTab(tab.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer",
                  activeCategoryTab === tab.id
                    ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* New Skill Modal Button */}
        <Button
          onClick={() => setIsSkillDialogOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add New Skill
        </Button>
      </div>

      {/* New Skill Dialog */}
      <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-400" /> REGISTER NEW SKILL
            </DialogTitle>
            <button
              onClick={() => setIsSkillDialogOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleCreateSkill} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Skill Title *</label>
              <Input
                required
                placeholder="e.g. Rust Systems Programming"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Description</label>
              <Textarea
                placeholder="Provide skill overview or study syllabus..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl min-h-[80px] p-3.5 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Category</label>
                <Select value={newCategory} onValueChange={(val: any) => setNewCategory(val)}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                    <SelectItem value="hard_skill" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Hard / Technical</SelectItem>
                    <SelectItem value="creative" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Creative &amp; Design</SelectItem>
                    <SelectItem value="language" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Language</SelectItem>
                    <SelectItem value="soft_skill" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Soft Skill</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Initial Level</label>
                <Select value={newProficiency} onValueChange={(val: any) => setNewProficiency(val)}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                    <SelectItem value="beginner" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Beginner (25%)</SelectItem>
                    <SelectItem value="intermediate" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Intermediate (50%)</SelectItem>
                    <SelectItem value="advanced" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Advanced (75%)</SelectItem>
                    <SelectItem value="mastery" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Mastery (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multiple Linked References Manager */}
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
                {isPending ? "Registering..." : "Save Skill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Growth Matrix Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSkills.length === 0 ? (
          <div className="col-span-full py-12 glass-panel rounded-3xl flex flex-col items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-white/10">
            No skills registered matching current filter
          </div>
        ) : (
          filteredSkills.slice(0, skillVisibleLimit).map((skill) => {
            const skillMilestones = initialMilestones.filter((m) => m.skillId === skill.id);
            const completedCount = skillMilestones.filter((m) => m.isCompleted).length;
            const totalCount = skillMilestones.length;
            const milestoneProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const profValue = getProficiencyValue(skill.proficiency);
            const { cleanDesc, references } = parseReferences(skill.description);

            return (
              <div
                key={skill.id}
                onClick={() => setViewingSkill(skill)}
                className="glass-panel glass-panel-hover p-5 rounded-3xl flex flex-col justify-between cursor-pointer relative group transition-all duration-200 border border-white/10 hover:border-indigo-500/50 shadow-lg"
              >
                <div>
                  {/* Card Header: Category & Level */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      {getCategoryIcon(skill.category)}
                      {formatCategoryLabel(skill.category)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={cn("font-mono text-[10px] uppercase px-2 py-0.5", getProficiencyColor(skill.proficiency))}>
                        {skill.proficiency}
                      </Badge>
                      {/* Separate Edit Button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(skill);
                        }}
                        className="w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                        title="Edit Skill"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-bold text-white font-sans group-hover:text-indigo-300 transition-colors">
                    {skill.title}
                  </h3>
                  {cleanDesc && (
                    <p className="text-[11px] text-slate-400 font-sans line-clamp-2 mt-1 leading-relaxed">
                      {cleanDesc}
                    </p>
                  )}

                  {/* Proficiency Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Proficiency Level</span>
                      <span className="text-indigo-300 font-semibold">{profValue}%</span>
                    </div>
                    <Progress value={profValue} className="h-1.5 bg-white/10" />
                  </div>

                  {/* Syllabus / Milestone Progress */}
                  <div className="mt-4 p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Milestones
                    </span>
                    <span className="text-slate-200 text-[11px]">
                      {completedCount} / {totalCount} ({milestoneProgress}%)
                    </span>
                  </div>

                  {/* Reference Badges Preview */}
                  {references.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {references.map((ref, idx) => {
                        const status = checkReferenceStatus(ref);
                        return (
                          <React.Fragment key={idx}>
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
                                <span className="truncate max-w-[130px]">{status.label}</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                              </a>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-400 flex items-center gap-1">
                    Manage Syllabus <ChevronRight className="w-3 h-3" />
                  </span>

                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingSkillConfirm(skill);
                    }}
                    className="w-7 h-7 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 transition-opacity"
                    title="Delete skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Show More / Show Less Expander Button */}
      {filteredSkills.length > 6 && (
        <div className="flex justify-center pt-2">
          {skillVisibleLimit < filteredSkills.length ? (
            <Button
              onClick={() => setSkillVisibleLimit(filteredSkills.length)}
              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-mono text-xs rounded-2xl h-10 px-6 gap-2 shadow-lg cursor-pointer transition-all"
            >
              Show More (+{filteredSkills.length - skillVisibleLimit} more skills)
            </Button>
          ) : (
            <Button
              onClick={() => setSkillVisibleLimit(6)}
              variant="outline"
              className="border-white/15 text-slate-400 hover:text-white font-mono text-xs rounded-2xl h-10 px-6 cursor-pointer"
            >
              Show Less
            </Button>
          )}
        </div>
      )}

      {/* SKILL DETAIL VIEW & SYLLABUS MANAGEMENT MODAL */}
      {viewingSkill && (
        <Dialog open={!!viewingSkill} onOpenChange={() => setViewingSkill(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Eye className="w-4 h-4" />
                </div>
                <DialogTitle className="text-sm font-bold font-mono text-white tracking-wide uppercase truncate max-w-[320px]">
                  {viewingSkill.title}
                </DialogTitle>
              </div>
              <button
                onClick={() => setViewingSkill(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <div className="space-y-4">
              {/* Category & Proficiency Level Selector */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  {getCategoryIcon(viewingSkill.category)}
                  <span>{formatCategoryLabel(viewingSkill.category)}</span>
                </div>

                <Select
                  value={viewingSkill.proficiency}
                  onValueChange={(val: any) => {
                    handleProficiencyChange(viewingSkill.id, val);
                    setViewingSkill({ ...viewingSkill, proficiency: val });
                  }}
                >
                  <SelectTrigger className="w-36 bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-9 px-3 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                    <SelectItem value="beginner" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Beginner</SelectItem>
                    <SelectItem value="intermediate" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Intermediate</SelectItem>
                    <SelectItem value="advanced" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Advanced</SelectItem>
                    <SelectItem value="mastery" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Mastery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clean Description */}
              {(() => {
                const { cleanDesc, references } = parseReferences(viewingSkill.description);
                return (
                  <>
                    {cleanDesc && (
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                        {cleanDesc}
                      </div>
                    )}

                    {/* Milestones Checklist */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                        SYLLABUS &amp; MILESTONES ({viewingSkillMilestones.length})
                      </h4>

                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                        {viewingSkillMilestones.length === 0 ? (
                          <div className="p-4 text-center text-xs font-mono text-slate-500 border border-dashed border-white/10 rounded-2xl">
                            No milestone items added yet. Add one below!
                          </div>
                        ) : (
                          viewingSkillMilestones.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => handleToggleMilestone(m.id, m.isCompleted)}
                              className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {m.isCompleted ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                                <span
                                  className={cn(
                                    "text-xs font-sans text-slate-200",
                                    m.isCompleted && "line-through text-slate-500"
                                  )}
                                >
                                  {m.description}
                                </span>
                              </div>

                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingMilestoneConfirm(m);
                                }}
                                className="w-7 h-7 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100"
                                title="Delete milestone"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Add Milestone Input */}
                    <form onSubmit={handleAddMilestone} className="flex items-center gap-2 pt-2 border-t border-white/10">
                      <Input
                        required
                        placeholder="Add new milestone goal..."
                        value={newMilestoneDesc}
                        onChange={(e) => setNewMilestoneDesc(e.target.value)}
                        className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-10 px-3 flex-1 font-mono"
                      />
                      <Button type="submit" disabled={isPending} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-10 px-4 gap-1 shrink-0">
                        <Plus className="w-3.5 h-3.5" /> Add Goal
                      </Button>
                    </form>

                    {/* Attached References List */}
                    <div className="space-y-2 pt-3 border-t border-white/10">
                      <h4 className="text-xs font-mono text-purple-300 font-semibold flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-purple-400" /> ATTACHED DOCUMENTS &amp; REFERENCES ({references.length})
                      </h4>

                      {references.length === 0 ? (
                        <p className="text-xs font-mono text-slate-500">No external documents or brain notes attached.</p>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
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

            <DialogFooter className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setDeletingSkillConfirm(viewingSkill)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono text-xs rounded-2xl h-11 px-4"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete Skill
              </Button>
              <Button
                onClick={() => handleOpenEditModal(viewingSkill)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 shadow-lg shadow-indigo-600/30"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Skill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* EDIT SKILL MODAL DIALOG */}
      {editingSkill && (
        <Dialog open={!!editingSkill} onOpenChange={() => setEditingSkill(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" /> EDIT SKILL &amp; REFERENCES
              </DialogTitle>
              <button
                onClick={() => setEditingSkill(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <form onSubmit={handleSaveEditSkill} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Skill Title *</label>
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
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl min-h-[80px] p-3.5 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-300">Category</label>
                  <Select value={editCategory} onValueChange={(val: any) => setEditCategory(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                      <SelectItem value="hard_skill" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Hard / Technical</SelectItem>
                      <SelectItem value="creative" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Creative &amp; Design</SelectItem>
                      <SelectItem value="language" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Language</SelectItem>
                      <SelectItem value="soft_skill" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Soft Skill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-300">Proficiency Level</label>
                  <Select value={editProficiency} onValueChange={(val: any) => setEditProficiency(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-10 px-3 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                      <SelectItem value="beginner" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Beginner (25%)</SelectItem>
                      <SelectItem value="intermediate" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Intermediate (50%)</SelectItem>
                      <SelectItem value="advanced" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Advanced (75%)</SelectItem>
                      <SelectItem value="mastery" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Mastery (100%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multiple Linked References Manager */}
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
                  onClick={() => setDeletingSkillConfirm(editingSkill)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono text-xs rounded-2xl h-11 px-4"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Skill
                </Button>
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-6 shadow-lg shadow-indigo-600/30">
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC SKILL DELETE CONFIRMATION DIALOG */}
      {deletingSkillConfirm && (
        <Dialog open={!!deletingSkillConfirm} onOpenChange={() => setDeletingSkillConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE SKILL &amp; SYLLABUS</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete skill <span className="text-rose-300 font-bold">&quot;{deletingSkillConfirm.title}&quot;</span>?
              </p>
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono mt-3 leading-relaxed">
                ⚠️ WARNING: Deleting this skill will ALSO permanently remove all associated milestones!
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingSkillConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingSkillConfirm.id;
                  startTransition(async () => {
                    await deleteSkillAction(id);
                    setDeletingSkillConfirm(null);
                    if (viewingSkill?.id === id) setViewingSkill(null);
                    if (editingSkill?.id === id) setEditingSkill(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Delete Skill"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC MILESTONE DELETE CONFIRMATION DIALOG */}
      {deletingMilestoneConfirm && (
        <Dialog open={!!deletingMilestoneConfirm} onOpenChange={() => setDeletingMilestoneConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE MILESTONE GOAL</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete milestone <span className="text-rose-300 font-bold">&quot;{deletingMilestoneConfirm.description}&quot;</span>?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingMilestoneConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingMilestoneConfirm.id;
                  startTransition(async () => {
                    await deleteMilestoneAction(id);
                    setDeletingMilestoneConfirm(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Delete Goal"}
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
          className="text-[11px] font-mono border-purple-500/30 text-purple-300 hover:bg-purple-500/10 rounded-xl h-8 px-3 gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Reference Link
        </Button>
      </div>

      {references.length === 0 ? (
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs font-mono text-slate-500">
          No external assets, drive files, or brain notes linked to this skill.
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

              {/* Item Value Selector with Inline Search popup */}
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
