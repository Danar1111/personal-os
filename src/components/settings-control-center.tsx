"use client";

import React, { useState, useTransition } from "react";
import { AISkill } from "@/db/schema";
import {
  saveSettingAction,
  saveMultipleSettingsAction,
  createAISkillAction,
  deleteAISkillAction,
} from "@/app/settings/actions";
import {
  Key,
  Cpu,
  Terminal,
  Wrench,
  Save,
  Eye,
  EyeOff,
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

  // AI Provider Keys state
  const [openaiKey, setOpenaiKey] = useState(initialSettings["openai_key"] || "");
  const [anthropicKey, setAnthropicKey] = useState(initialSettings["anthropic_key"] || "");
  const [geminiKey, setGeminiKey] = useState(initialSettings["gemini_key"] || "");
  const [showAiKeys, setShowAiKeys] = useState(false);

  // Third-Party External Data Pipeline Keys state (Finnhub, TMDB, NewsAPI)
  const [finnhubKey, setFinnhubKey] = useState(initialSettings["finnhub_api_key"] || "");
  const [tmdbKey, setTmdbKey] = useState(initialSettings["tmdb_api_key"] || "");
  const [newsapiKey, setNewsapiKey] = useState(initialSettings["newsapi_key"] || "");
  const [showExternalKeys, setShowExternalKeys] = useState(false);

  // Free-form LLM Model state
  const [customModel, setCustomModel] = useState(
    initialSettings["active_model"] || "gpt-4o-mini"
  );

  // System Prompt state
  const [systemPrompt, setSystemPrompt] = useState(
    initialSettings["system_prompt"] ||
      "You are the Personal OS AI Core, an intelligent autonomous system assistant embedded inside the user's Personal OS dashboard. You assist with productivity, task management, second brain notes, finance tracking, time blocking, and local files. Execute tools proactively when requested."
  );

  // Register Skill Modal State
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillModule, setNewSkillModule] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");

  // Custom Glassmorphic Delete Confirmation Modal State (Popup Verif)
  const [deletingSkillConfirm, setDeletingSkillConfirm] = useState<AISkill | null>(null);

  // Feedback banner
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const triggerSavedFeedback = (msg: string) => {
    setSavedFeedback(msg);
    setTimeout(() => setSavedFeedback(null), 3500);
  };

  const handleSaveAiKeys = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveMultipleSettingsAction({
        openai_key: openaiKey,
        anthropic_key: anthropicKey,
        gemini_key: geminiKey,
      });
      triggerSavedFeedback("AI Provider Vault keys saved to MySQL Database!");
    });
  };

  const handleSaveExternalKeys = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveMultipleSettingsAction({
        finnhub_api_key: finnhubKey,
        tmdb_api_key: tmdbKey,
        newsapi_key: newsapiKey,
      });
      triggerSavedFeedback("✓ External Data Pipeline keys securely saved to MySQL Database!");
    });
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

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillModule.trim() || !newSkillDesc.trim()) return;

    startTransition(async () => {
      await createAISkillAction({
        name: newSkillName,
        module: newSkillModule,
        description: newSkillDesc,
      });
      setNewSkillName("");
      setNewSkillModule("");
      setNewSkillDesc("");
      setIsAddSkillOpen(false);
      triggerSavedFeedback(`New AI Skill "${newSkillName}" registered!`);
    });
  };

  const modelPresets = [
    { id: "gpt-4o-mini", label: "gpt-4o-mini (Fast & Recommended)" },
    { id: "gpt-4o", label: "gpt-4o (High Intelligence)" },
    { id: "claude-3-5-sonnet", label: "claude-3-5-sonnet" },
    { id: "gemini-1.5-pro", label: "gemini-1.5-pro" },
    { id: "groq/llama-3-70b", label: "groq/llama-3-70b" },
    { id: "ollama/llama3", label: "ollama/llama3 (Local)" },
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

        {/* Tab 1: API Vault */}
        {activeTab === "api" && (
          <div className="space-y-6 py-2">
            {/* AI Provider Keys */}
            <form onSubmit={handleSaveAiKeys} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" /> AI PROVIDER API KEYS
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Configure OpenAI, Anthropic &amp; Gemini keys for Personal OS AI Core
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAiKeys(!showAiKeys)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 transition-colors cursor-pointer"
                >
                  {showAiKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showAiKeys ? "Hide Keys" : "Show Keys"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">OpenAI API Key</label>
                  <Input
                    type={showAiKeys ? "text" : "password"}
                    placeholder="sk-proj-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Anthropic API Key</label>
                  <Input
                    type={showAiKeys ? "text" : "password"}
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Gemini API Key</label>
                  <Input
                    type={showAiKeys ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-indigo-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save AI Provider Keys
              </Button>
            </form>

            {/* External Data Pipeline Keys */}
            <form onSubmit={handleSaveExternalKeys} className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" /> EXTERNAL DATA PIPELINE KEYS
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Configure Finnhub (Finance), TMDB (Watchlist) &amp; NewsAPI (Briefing) keys
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExternalKeys(!showExternalKeys)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 transition-colors cursor-pointer"
                >
                  {showExternalKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showExternalKeys ? "Hide Keys" : "Show Keys"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Finnhub Stock API Key
                  </label>
                  <Input
                    type={showExternalKeys ? "text" : "password"}
                    placeholder="ct0..."
                    value={finnhubKey}
                    onChange={(e) => setFinnhubKey(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-purple-400" /> TMDB Movie API Key
                  </label>
                  <Input
                    type={showExternalKeys ? "text" : "password"}
                    placeholder="a47f..."
                    value={tmdbKey}
                    onChange={(e) => setTmdbKey(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Newspaper className="w-3.5 h-3.5 text-cyan-400" /> NewsAPI Key
                  </label>
                  <Input
                    type={showExternalKeys ? "text" : "password"}
                    placeholder="84bf..."
                    value={newsapiKey}
                    onChange={(e) => setNewsapiKey(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono focus:border-cyan-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save External Pipeline Keys
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
              Function calling capabilities registered with the Personal OS AI Core
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-xs font-mono">
              {initialSkills.length} Registered Skills
            </Badge>

            <Dialog open={isAddSkillOpen} onOpenChange={setIsAddSkillOpen}>
              <DialogTrigger className={cn(Button, "bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-4 gap-2 cursor-pointer flex items-center shadow-lg shadow-indigo-600/30")}>
                <Plus className="w-4 h-4" /> Register New AI Skill
              </DialogTrigger>
              <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
                <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
                  <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-indigo-400" /> REGISTER NEW AI SKILL
                  </DialogTitle>
                  <button
                    onClick={() => setIsAddSkillOpen(false)}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </DialogHeader>

                <form onSubmit={handleCreateSkill} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Skill Function Name *</label>
                    <Input
                      required
                      placeholder="e.g. log_workout or generate_invoice"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Target Module / System *</label>
                    <Input
                      required
                      placeholder="e.g. Health Matrix or Finance Hub"
                      value={newSkillModule}
                      onChange={(e) => setNewSkillModule(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Skill Function Description *</label>
                    <Textarea
                      required
                      rows={3}
                      placeholder="Describe what this tool does when invoked by the AI Core..."
                      value={newSkillDesc}
                      onChange={(e) => setNewSkillDesc(e.target.value)}
                      className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl p-4 font-sans leading-relaxed"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30 cursor-pointer">
                      {isPending ? "Registering..." : "Register Skill"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Dynamic Skill Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialSkills.slice(0, skillsVisibleLimit).map((skill) => (
            <div
              key={skill.id}
              className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-indigo-500/50 transition-all group relative shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/30">
                  {skill.name}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{skill.module}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingSkillConfirm(skill);
                    }}
                    className="p-1.5 rounded-xl bg-black/80 text-slate-400 hover:text-rose-400 hover:bg-rose-600/80 transition-colors border border-white/10 cursor-pointer"
                    title="Delete skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                {skill.description}
              </p>
            </div>
          ))}
        </div>

        {/* Show More / Show Less Expander Button */}
        {initialSkills.length > 6 && (
          <div className="flex justify-center pt-4">
            {skillsVisibleLimit < initialSkills.length ? (
              <Button
                onClick={() => setSkillsVisibleLimit(initialSkills.length)}
                className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-mono text-xs rounded-2xl h-10 px-6 gap-2 shadow-lg cursor-pointer transition-all"
              >
                Show More (+{initialSkills.length - skillsVisibleLimit} more skills)
              </Button>
            ) : (
              <Button
                onClick={() => setSkillsVisibleLimit(6)}
                variant="outline"
                className="border-white/15 text-slate-400 hover:text-white font-mono text-xs rounded-2xl h-10 px-6 cursor-pointer"
              >
                Show Less
              </Button>
            )}
          </div>
        )}
      </div>

      {/* COOL GLASSMORPHIC DELETE SKILL CONFIRMATION DIALOG (Popup Verif) */}
      {deletingSkillConfirm && (
        <Dialog open={!!deletingSkillConfirm} onOpenChange={() => setDeletingSkillConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE AI SKILL</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete AI skill <span className="text-rose-300 font-bold">&quot;{deletingSkillConfirm.name}&quot;</span>?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
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
                  setDeletingSkillConfirm(null);
                  startTransition(async () => {
                    await deleteAISkillAction(id);
                    triggerSavedFeedback("AI Skill deleted");
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete Skill"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
