import React, { Suspense } from "react";
import { getSettings, getAISkills } from "./actions";
import { SettingsControlCenter } from "@/components/settings-control-center";
import { Settings, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MigrationWizard } from "@/components/migration/MigrationWizard";
import { Database } from "lucide-react";

export const revalidate = 0;

export default async function SettingsPage() {
  const initialSettings = await getSettings();
  const initialSkills = await getAISkills();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <Settings className="w-7 h-7 text-indigo-400" />
            <span>AI CONTROL CENTER & SETTINGS</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            System Preferences • API Vault, Free-Form LLM Switcher & Dynamic AI Skill Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Skills Registered:</span>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
              {initialSkills.length}
            </Badge>
          </div>

          <MigrationWizard
            mode="export"
            trigger={
              <Button
                variant="outline"
                className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-xs rounded-xl h-8 px-3 gap-1.5 cursor-pointer shadow-sm"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Backup / Restore</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Control Center Component */}
      <Suspense fallback={<div className="p-8 text-center font-mono text-xs text-slate-400">Loading Settings...</div>}>
        <SettingsControlCenter
          initialSettings={initialSettings}
          initialSkills={initialSkills}
        />
      </Suspense>
    </div>
  );
}

