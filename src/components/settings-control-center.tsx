"use client";

import React, { useState, useTransition, useEffect } from "react";

import { useSearchParams } from "next/navigation";
import { AISkill } from "@/db/schema";
import {
  saveSettingAction,
  saveMultipleSettingsAction,
  forceSyncAiSkillsAction,
  revokeSpotifyTokenAction,
} from "@/app/settings/actions";
import {
  Key,
  Cpu,
  Terminal,
  Wrench,
  Save,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Sparkles,
  Bot,
  Database,
  TrendingUp,
  Film,
  Newspaper,
  ShieldCheck,
  AlertTriangle,
  X,
  RefreshCw,
  Mail,
  Music,
  Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SettingsControlCenterProps {
  initialSettings: Record<string, string>;
  initialSkills: AISkill[];
}

export function SettingsControlCenter({
  initialSettings,
  initialSkills,
}: SettingsControlCenterProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"api" | "model" | "prompt">("api");
  const [skillsVisibleLimit, setSkillsVisibleLimit] = useState<number>(6);

  // Brevo Transactional Emailer Sender state
  const [brevoSenderEmail, setBrevoSenderEmail] = useState(initialSettings["brevo_sender_email"] || "assistant@danar.site");
  const [brevoSenderName, setBrevoSenderName] = useState(initialSettings["brevo_sender_name"] || "Personal OS Assistant");


  // Free-form LLM Model state
  const [customModel, setCustomModel] = useState(
    initialSettings["active_model"] || "gpt-4o-mini"
  );

  // System Prompt state
  const [systemPrompt, setSystemPrompt] = useState(
    initialSettings["system_prompt"] ||
      "You are the Personal OS AI Core, an intelligent autonomous system assistant embedded inside the user's Personal OS dashboard. You assist with productivity, task management, second brain notes, finance tracking, time blocking, and local files. Execute tools proactively when requested."
  );

  // Filter Search State
  const [skillSearch, setSkillSearch] = useState("");

  const handleSyncSkills = () => {
    startTransition(async () => {
      await forceSyncAiSkillsAction();
      triggerSavedFeedback("System AI Skills synced successfully!");
    });
  };

  // Spotify OAuth Token state & URL Params
  const searchParams = useSearchParams();
  const spotifyParam = searchParams.get("spotify");
  const spotifyMessage = searchParams.get("message");

  const [hasSpotifyToken, setHasSpotifyToken] = useState<boolean>(
    Boolean(initialSettings["SPOTIFY_REFRESH_TOKEN"] || initialSettings["spotify_refresh_token"])
  );

  useEffect(() => {
    if (spotifyParam === "success") {
      setHasSpotifyToken(true);
      triggerSavedFeedback("✓ Successfully connected Spotify account!");
    } else if (spotifyParam === "error") {
      triggerSavedFeedback(`⚠️ Spotify OAuth Error: ${spotifyMessage || "Failed to authorize"}`);
    }
  }, [spotifyParam, spotifyMessage]);

  const handleRevokeSpotify = () => {
    startTransition(async () => {
      await revokeSpotifyTokenAction();
      setHasSpotifyToken(false);
      triggerSavedFeedback("Spotify authorization token revoked.");
    });
  };

  // Feedback banner
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const triggerSavedFeedback = (msg: string) => {
    setSavedFeedback(msg);
    setTimeout(() => setSavedFeedback(null), 3500);
  };




  const handleSaveModel = (val: string) => {
    setCustomModel(val);
    startTransition(async () => {
      await saveSettingAction("active_model", val);
      triggerSavedFeedback(`Active model updated to "${val}" in Database!`);
    });
  };

  const handleSavePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveSettingAction("system_prompt", systemPrompt);
      triggerSavedFeedback("System prompt updated in MySQL Database!");
    });
  };

  const modelPresets = [
    { id: "gpt-4o-mini", label: "gpt-4o-mini ⚡ Recommended" },
    { id: "gpt-5-nano-2025-08-07", label: "gpt-5-nano-2025-08-07" },
    { id: "gpt-4o", label: "gpt-4o" },
    { id: "gpt-4-turbo", label: "gpt-4-turbo" },
    { id: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
    { id: "o1-mini", label: "o1-mini" },
    { id: "o3-mini", label: "o3-mini" },
  ];

  return (
    <div className="space-y-8 font-mono">
      {/* Toast Notification Banner */}
      {savedFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-lg shadow-emerald-500/10 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{savedFeedback}</span>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
            PERSISTED
          </Badge>
        </div>
      )}

      {/* Main Settings Navigation & Cards */}
      <div className="glass-panel p-6 rounded-3xl space-y-6 border border-white/10 shadow-lg">
        {/* Section Tabs */}
        <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 p-1.5 rounded-2xl font-mono text-xs overflow-x-auto">
          {[
            { id: "api", label: "API Vault", icon: Key },
            { id: "model", label: "Model Switcher", icon: Cpu },
            { id: "prompt", label: "System Prompt", icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>


        {/* Tab 1: API Vault & System Security */}

        {activeTab === "api" && (
          <div className="space-y-6 py-2">
            <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                    ENVIRONMENT VAULT • SERVER-SIDE ENCRYPTION ACTIVE
                  </h3>
                  <p className="text-xs text-slate-300 font-sans mt-0.5">
                    All secret API keys are strictly loaded from server-side environment variables (<code className="text-emerald-300 font-mono">.env</code>). Zero keys are exposed to the browser or client-side HTML.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Key className="w-3.5 h-3.5 text-indigo-400" /> OpenAI API Key
                    </span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/40 text-[10px]">
                      Active (.env)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">Status: Connected &amp; Protected</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Mail className="w-3.5 h-3.5 text-purple-400" /> Brevo Email API Key
                    </span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/40 text-[10px]">
                      Active (.env)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">Status: Connected &amp; Protected</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Film className="w-3.5 h-3.5 text-purple-400" /> TMDB Movie API Key
                    </span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/40 text-[10px]">
                      Active (.env)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">Status: Connected &amp; Protected</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Newspaper className="w-3.5 h-3.5 text-cyan-400" /> News / GNews API Key
                    </span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/40 text-[10px]">
                      Active (.env)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">Status: Connected &amp; Protected</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Finnhub Stock API Key
                    </span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/40 text-[10px]">
                      Active (.env)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">Status: Connected &amp; Protected</p>
                </div>

                {/* Spotify OAuth Card */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 col-span-1 md:col-span-2 lg:col-span-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-200 flex items-center gap-1.5 font-bold text-sm">
                      <Music className="w-4 h-4 text-[#1DB954]" /> Spotify Integration (OAuth &amp; Realtime Playback)
                    </span>
                    {hasSpotifyToken ? (
                      <Badge variant="outline" className="bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/50 text-[11px] font-bold px-2.5 py-0.5">
                        ✓ Connected to Spotify
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/40 text-[10px]">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono leading-relaxed">
                    Authenticate via Spotify OAuth to enable the built-in Now Playing widget &amp; LRCLIB synchronized lyrics engine.
                  </p>
                  <div className="flex items-center gap-3 pt-1 font-mono text-xs">
                    {!hasSpotifyToken ? (
                      <a
                        href="/api/spotify/login"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1DB954] text-black font-bold hover:bg-[#1ed760] transition-all shadow-lg shadow-[#1DB954]/20 cursor-pointer text-xs"
                      >
                        <Radio className="w-4 h-4" /> Connect Spotify Account
                      </a>
                    ) : (
                      <>
                        <a
                          href="/api/spotify/login"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs transition-all cursor-pointer border border-white/10"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Reconnect Account
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleRevokeSpotify}
                          disabled={isPending}
                          className="h-8 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl font-mono cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke Access
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>


            {/* Brevo Sender Preferences */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  await saveMultipleSettingsAction({
                    brevo_sender_email: brevoSenderEmail,
                    brevo_sender_name: brevoSenderName,
                  });
                  triggerSavedFeedback("✓ Brevo sender email preferences updated successfully!");
                });
              }}
              className="space-y-4 pt-4 border-t border-white/10"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <Mail className="w-4 h-4 text-purple-400" /> BREVO SENDER PREFERENCES
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Configure default Sender Email &amp; Name for Omni-Emailer Studio
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/emailer/templates"}
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 font-mono text-xs rounded-xl h-8 px-3 gap-1"
                >
                  <Sparkles className="w-3 h-3 text-purple-400" /> Template Studio →
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" /> Sender Email
                  </label>
                  <Input
                    type="email"
                    placeholder="assistant@danar.site"
                    value={brevoSenderEmail}
                    onChange={(e) => setBrevoSenderEmail(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" /> Sender Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Personal OS Assistant"
                    value={brevoSenderName}
                    onChange={(e) => setBrevoSenderName(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save Sender Preferences
              </Button>
            </form>
          </div>
        )}

        {/* Tab 2: Free-Form Model Switcher */}

        {activeTab === "model" && (
          <div className="space-y-5 py-2">
            <div className="pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> ACTIVE LLM PROVIDER &amp; FREE-FORM MODEL
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Type any model string freely or select from preset recommendations.
              </p>
            </div>

            <div className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Active Model Name (Free-Form Input)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. gpt-4o-mini or ollama/llama3"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                  <Button
                    onClick={() => handleSaveModel(customModel)}
                    disabled={isPending}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 shrink-0 cursor-pointer shadow-lg shadow-indigo-600/30"
                  >
                    Save Model
                  </Button>
                </div>
              </div>

              {/* Quick Preset Recommendation Pills */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Quick Presets:
                </span>
                <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                  {modelPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSaveModel(preset.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-[11px] transition-all cursor-pointer",
                        customModel === preset.id
                          ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-sm font-bold"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: System Prompt */}
        {activeTab === "prompt" && (
          <form onSubmit={handleSavePrompt} className="space-y-5 py-2">
            <div className="pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" /> GLOBAL SYSTEM PROMPT MANAGER
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Define the core system instructions governing AI Core persona and behavior.
              </p>
            </div>

            <div className="space-y-2">
              <Textarea
                rows={5}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs font-mono text-slate-200 rounded-2xl p-4 leading-relaxed focus:border-indigo-500/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Save System Prompt
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Dynamic AI Skill Directory & Registration Modal */}
      <div className="glass-panel p-6 rounded-3xl space-y-5 border border-white/10 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-400" /> REGISTERED AI SKILL DIRECTORY
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Function calling capabilities registered with the Personal OS AI Core (Auto-Synced with Engine)
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-xs font-mono gap-1 py-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Live Sync ({initialSkills.length} Skills)
            </Badge>

            <Button
              onClick={handleSyncSkills}
              disabled={isPending}
              variant="outline"
              className="border-white/15 text-slate-300 hover:text-white font-mono text-xs rounded-2xl h-9 px-3 gap-1.5 cursor-pointer"
              title="Force Sync System Skills"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
              <span>Sync Skills</span>
            </Button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter skills by function name, module, or description..."
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            className="bg-white/[0.03] border-white/10 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 px-4 font-mono flex-1"
          />
          {skillSearch && (
            <Button
              variant="ghost"
              onClick={() => setSkillSearch("")}
              className="text-xs font-mono text-slate-400 hover:text-white h-10 px-3 rounded-2xl"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Dynamic Skill Cards Grouped by Module */}
        {(() => {
          const filtered = initialSkills.filter((s) => {
            if (!skillSearch.trim()) return true;
            const q = skillSearch.toLowerCase();
            return (
              s.name.toLowerCase().includes(q) ||
              s.module.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q)
            );
          });

          if (filtered.length === 0) {
            return (
              <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-white/10 rounded-3xl">
                No AI skills matching &quot;{skillSearch}&quot;.
              </div>
            );
          }

          // Group by module
          const groupedByModule: Record<string, AISkill[]> = {};
          filtered.forEach((s) => {
            const mod = s.module || "General System";
            if (!groupedByModule[mod]) groupedByModule[mod] = [];
            groupedByModule[mod].push(s);
          });

          const moduleKeys = Object.keys(groupedByModule);

          return (
            <div className="space-y-6">
              {moduleKeys.map((modName) => {
                const skillsInMod = groupedByModule[modName];
                return (
                  <div key={modName} className="space-y-3">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Wrench className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                        {modName}
                      </h4>
                      <Badge variant="outline" className="border-white/10 text-slate-400 text-[10px] font-mono">
                        {skillsInMod.length} Skill{skillsInMod.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {skillsInMod.map((skill) => (
                        <div
                          key={skill.id}
                          className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-indigo-500/50 transition-all group relative shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/30">
                              {skill.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                              {skill.module}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-line">
                            {skill.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
