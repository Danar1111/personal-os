import React from "react";
import { getAssets } from "./actions";
import { DigitalInventory } from "@/components/digital-inventory";
import { FolderArchive, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0; // Disable static cache for live data updates

export default async function InventoryPage() {
  const initialAssets = await getAssets();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <FolderArchive className="w-7 h-7 text-indigo-400" />
            <span>RESOURCE & ASSET VAULT</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Digital Inventory • Drizzle ORM + Laragon MySQL Bookmarks & Media Manager
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Total Vault Assets:</span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
            {initialAssets.length}
          </Badge>
        </div>
      </div>

      {/* Digital Inventory Component */}
      <DigitalInventory initialAssets={initialAssets} />
    </div>
  );
}
