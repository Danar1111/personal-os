import React from "react";
import { getDriveAssets, getSyncFolderSettingAction } from "./actions";
import { UniversalDriveClient } from "@/components/universal-drive-client";
import { HardDrive, Cloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0; // Disable static cache for live data updates

export default async function DrivePage() {
  const initialAssets = await getDriveAssets();
  const initialSyncFolder = await getSyncFolderSettingAction();

  const localCount = initialAssets.filter(
    (a) => a.syncStatus === "LOCAL_UNSYNCED" || a.syncStatus === "SYNCED_LOCAL_KEPT"
  ).length;

  const cloudCount = initialAssets.filter(
    (a) => a.syncStatus === "SYNCED_LOCAL_KEPT" || a.syncStatus === "CLOUD_ONLY"
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <HardDrive className="w-7 h-7 text-indigo-400" />
            <span>UNIVERSAL DRIVE & CLOUD STORAGE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Unified File Explorer • Local Storage (/public/uploads) & Google Drive API v3 Real-time Sync
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>Local:</span>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-500/10 text-[10px]">
              {localCount}
            </Badge>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span>Synced:</span>
            <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10 text-[10px]">
              {cloudCount}
            </Badge>
          </div>
        </div>
      </div>

      {/* Universal Drive Client Component */}
      <UniversalDriveClient
        initialAssets={initialAssets}
        initialSyncFolder={initialSyncFolder}
      />
    </div>
  );
}
