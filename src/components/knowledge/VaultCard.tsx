"use client";

import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  MoreVertical,
  Edit2,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KnowledgeEntry } from "@/db/schema";
import { cn } from "@/lib/utils";

interface VaultCardProps {
  entry: KnowledgeEntry;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (entry: KnowledgeEntry) => void;
}

export function VaultCard({ entry, onEdit, onDelete }: VaultCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getCategoryColor = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("bio")) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (cat.includes("work") || cat.includes("brand")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (cat.includes("finance")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (cat.includes("pref")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  };

  return (
    <div className="relative group bg-[#0e0e14]/90 border border-white/10 hover:border-indigo-500/30 rounded-3xl p-5 shadow-xl backdrop-blur-xl transition-all duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-indigo-500/5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Badge
              variant="outline"
              className={cn("text-[10px] font-mono px-2.5 py-0.5 rounded-full border", getCategoryColor(entry.category))}
            >
              <Tag className="w-3 h-3 mr-1 inline" />
              {entry.category}
            </Badge>

            {entry.isSensitive ? (
              <Badge
                variant="outline"
                className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1"
                title="Masked in UI & excluded from bulk AI context injection"
              >
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                Sensitive
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1"
                title="Auto-injected into Omni AI context"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                AI Context
              </Badge>
            )}
          </div>

          {/* Action Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-32 bg-[#14141e] border border-white/15 rounded-2xl shadow-2xl z-20 py-1.5 font-mono text-xs overflow-hidden">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(entry);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(entry);
                    }}
                    className="w-full text-left px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-100 font-sans tracking-tight mb-3 line-clamp-1">
          {entry.title}
        </h3>

        {/* Content Section */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 font-mono text-xs text-slate-300 leading-relaxed break-words relative overflow-hidden min-h-[70px] flex items-center">
          {entry.isSensitive && !isRevealed ? (
            <div className="flex items-center justify-between w-full text-slate-500 select-none">
              <span className="tracking-widest font-bold text-slate-500">
                ••••••••••••••••
              </span>
              <span className="text-[10px] text-slate-600 italic">Masked</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap w-full max-h-48 overflow-y-auto scrollbar-thin">
              {entry.content}
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-[11px] font-mono">
        <div className="text-slate-500">
          {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : ""}
        </div>

        <div className="flex items-center gap-1.5">
          {entry.isSensitive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRevealed(!isRevealed)}
              className="h-8 px-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 font-mono gap-1 text-xs"
              title={isRevealed ? "Hide Sensitive Data" : "Reveal Sensitive Data"}
            >
              {isRevealed ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Reveal</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={cn(
              "h-8 px-3 rounded-xl font-mono gap-1.5 text-xs transition-all",
              isCopied
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
            )}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
