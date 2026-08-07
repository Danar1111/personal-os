import React from "react";
import { getVaultData } from "./actions";
import { SecondBrainVault } from "@/components/second-brain-vault";
import { FileText, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0; // Disable static cache for live data updates

export default async function VaultPage() {
  const { notes: initialNotes, folders: initialFolders, assets: initialAssets } = await getVaultData();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <FileText className="w-7 h-7 text-indigo-400" />
            <span>SECOND BRAIN ZETTELKASTEN VAULT</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Knowledge Base • Drizzle ORM + Laragon MySQL • Markdown Syntax & Wiki-Links [[Note]]
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Vault Notes:</span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
            {initialNotes.length}
          </Badge>
          <span className="text-slate-500 ml-1">Folders:</span>
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px]">
            {initialFolders.length}
          </Badge>
        </div>
      </div>

      {/* Zettelkasten Vault Component */}
      <SecondBrainVault initialNotes={initialNotes} initialFolders={initialFolders} initialAssets={initialAssets} />
    </div>
  );
}
