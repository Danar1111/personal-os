"use client";

import React, { useState } from "react";
import {
  AppWindow,
  Search,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  Globe,
  Server,
  Database,
  Code,
  Terminal,
  Zap,
  Bot,
  Cloud,
  Layers,
  CreditCard,
  Activity,
  Shield,
  HardDrive,
  Folder,
  LayoutGrid,
  Sparkles,
  Cpu,
  Radio,
  Tv,
  Music,
  Camera,
  Mail,
  Compass,
  Feather,
  Film,
  Headphones,
  Image as ImageIcon,
  Lock,
  MapPin,
  Package,
  Phone,
  Play,
  Settings,
  Share2,
  Sliders,
  Smartphone,
  Wrench,
  Check,
  RefreshCw,
  Link as LinkIcon,
  AlertTriangle,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Application } from "@/db/schema";
import { createApplication, updateApplication, deleteApplication } from "./actions";

// Map of popular icon names to Lucide Icon Components
const ICON_MAP: Record<string, any> = {
  Globe,
  Server,
  Database,
  Code,
  Terminal,
  Zap,
  Bot,
  Cloud,
  Layers,
  CreditCard,
  Activity,
  Shield,
  HardDrive,
  Folder,
  LayoutGrid,
  AppWindow,
  Sparkles,
  Cpu,
  Radio,
  Tv,
  Music,
  Camera,
  Mail,
  Compass,
  Feather,
  Film,
  Headphones,
  Image: ImageIcon,
  Lock,
  MapPin,
  Package,
  Phone,
  Play,
  Settings,
  Share2,
  Sliders,
  Smartphone,
  Wrench,
};

const POPULAR_ICONS = [
  "Globe",
  "Server",
  "Database",
  "Code",
  "Terminal",
  "Zap",
  "Bot",
  "Cloud",
  "Layers",
  "CreditCard",
  "Activity",
  "Shield",
  "AppWindow",
  "Sparkles",
  "Cpu",
  "HardDrive",
];

const SUGGESTED_CATEGORIES = [
  "Development",
  "Productivity",
  "Local Services",
  "Finance",
  "Design & Media",
  "AI & Data",
  "General",
];

function getFaviconUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;
  } catch (e) {
    return "";
  }
}

/** Smart App Icon Component — displays Website Favicon if available & enabled, with fallback to Lucide Icon or Custom URL */
function AppIconDisplay({
  app,
  className = "w-7 h-7",
}: {
  app: Application;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // If iconName is a custom HTTP/HTTPS image URL:
  if (app.iconName && (app.iconName.startsWith("http://") || app.iconName.startsWith("https://"))) {
    if (!imgFailed) {
      return (
        <img
          src={app.iconName}
          alt={app.name}
          className={`${className} object-contain rounded-md`}
          onError={() => setImgFailed(true)}
        />
      );
    }
  }

  // If useFavicon is enabled and image hasn't failed:
  const faviconUrl = app.useFavicon ? getFaviconUrl(app.url) : "";

  if (faviconUrl && !imgFailed) {
    return (
      <img
        src={faviconUrl}
        alt={app.name}
        className={`${className} object-contain rounded-md drop-shadow-md`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fallback to Lucide icon
  const IconComponent = ICON_MAP[app.iconName] || Globe;
  return <IconComponent className={className} />;
}

interface AppLauncherClientProps {
  initialApps: Application[];
}

import { useSearchParams } from "next/navigation";

export function AppLauncherClient({ initialApps }: AppLauncherClientProps) {
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const q = searchParams.get("search") || searchParams.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);

  // Custom Glassmorphic Delete Confirmation Modal State (Popup Verif)
  const [deletingAppConfirm, setDeletingAppConfirm] = useState<Application | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    iconName: "Globe",
    category: "Development",
    useFavicon: true,
  });
  const [iconTypeTab, setIconTypeTab] = useState<"auto" | "lucide" | "custom">("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Categories list
  const categories = ["All", ...Array.from(new Set(apps.map((a) => a.category)))];

  // Filtered Apps
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || app.category.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Grouped by Category
  const groupedApps: Record<string, Application[]> = {};
  filteredApps.forEach((app) => {
    const cat = app.category || "General";
    if (!groupedApps[cat]) groupedApps[cat] = [];
    groupedApps[cat].push(app);
  });

  const handleOpenAddModal = () => {
    setEditingApp(null);
    setFormData({
      name: "",
      url: "https://",
      iconName: "Globe",
      category: "Development",
      useFavicon: true,
    });
    setIconTypeTab("auto");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingApp(app);
    const isCustomUrl =
      app.iconName && (app.iconName.startsWith("http://") || app.iconName.startsWith("https://"));
    setFormData({
      name: app.name,
      url: app.url,
      iconName: app.iconName || "Globe",
      category: app.category || "General",
      useFavicon: app.useFavicon ?? true,
    });

    if (app.useFavicon) setIconTypeTab("auto");
    else if (isCustomUrl) setIconTypeTab("custom");
    else setIconTypeTab("lucide");

    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      setErrorMsg("Please enter an Application Name and Target URL.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    const payload = {
      ...formData,
      useFavicon: iconTypeTab === "auto",
    };

    if (editingApp) {
      const res = await updateApplication(editingApp.id, payload);
      if (res.success) {
        setApps((prev) =>
          prev.map((a) =>
            a.id === editingApp.id
              ? {
                  ...a,
                  name: payload.name.trim(),
                  url: payload.url.trim(),
                  iconName: payload.iconName,
                  category: payload.category.trim(),
                  useFavicon: payload.useFavicon,
                }
              : a
          )
        );
        setIsModalOpen(false);
      } else {
        setErrorMsg(res.message);
      }
    } else {
      const res = await createApplication(payload);
      if (res.success) {
        window.location.reload();
      } else {
        setErrorMsg(res.message);
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-slate-900/50 border border-white/10 glass-panel backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 border border-white/20">
            <AppWindow className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white tracking-wide flex items-center gap-2">
              APP LAUNCHER &amp; HUB
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Auto-Favicon Website Icons &amp; Custom Icon Overrides
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 bg-indigo-500/10 font-mono text-xs py-1.5 px-3">
            {apps.length} Applications Registered
          </Badge>

          <Button
            onClick={handleOpenAddModal}
            className="h-11 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register App</span>
          </Button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10 shadow-lg">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                activeCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applications..."
            className="pl-10 pr-4 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 font-mono"
          />
        </div>
      </div>

      {/* App Launchpad Grid by Categories */}
      {Object.keys(groupedApps).length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 glass-panel rounded-3xl border border-white/10 p-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <AppWindow className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white font-mono">No Applications Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchQuery
                ? `No apps matching "${searchQuery}"`
                : "Get started by registering your favorite web apps, n8n workflows, or local services."}
            </p>
          </div>
          <Button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Register First App
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedApps).map(([categoryName, categoryApps]) => (
            <div key={categoryName} className="space-y-4">
              {/* Category Section Header */}
              <div className="flex items-center gap-3 border-b border-white/10 pb-2.5">
                <span className="text-xs font-bold font-mono tracking-wider text-indigo-400 uppercase">
                  {categoryName}
                </span>
                <Badge variant="outline" className="border-white/10 text-slate-400 font-mono text-[10px]">
                  {categoryApps.length}
                </Badge>
              </div>

              {/* macOS / Bento Launchpad Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categoryApps.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => window.open(app.url, "_blank", "noopener,noreferrer")}
                    className="group relative flex flex-col items-center justify-between p-5 rounded-3xl bg-white/[0.03] hover:bg-gradient-to-b hover:from-indigo-600/20 hover:to-purple-600/10 border border-white/10 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-1 select-none"
                  >
                    {/* Card Actions (Hover) */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => handleOpenEditModal(app, e)}
                        title="Edit App"
                        className="p-1.5 rounded-xl bg-black/80 text-slate-300 hover:text-white hover:bg-indigo-600 transition-colors border border-white/10"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingAppConfirm(app);
                        }}
                        title="Delete App"
                        className="p-1.5 rounded-xl bg-black/80 text-slate-300 hover:text-rose-400 hover:bg-rose-600 transition-colors border border-white/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Icon Container with Smart Auto-Favicon / Lucide Fallback */}
                    <div className="my-2 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 group-hover:text-white group-hover:scale-110 group-hover:border-indigo-400 transition-all duration-300 shadow-md p-2">
                      <AppIconDisplay app={app} className="w-8 h-8" />
                    </div>

                    {/* App Details */}
                    <div className="text-center space-y-1 w-full">
                      <div className="text-xs font-semibold font-mono text-white group-hover:text-indigo-200 truncate px-1">
                        {app.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                        <span>{app.url.replace(/^https?:\/\//, "")}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register / Edit App Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-base font-bold font-mono text-white flex items-center gap-2">
              <AppWindow className="w-5 h-5 text-indigo-400" />
              <span>{editingApp ? "EDIT APPLICATION" : "REGISTER APPLICATION"}</span>
            </DialogTitle>
            <button
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {errorMsg}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Application Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. n8n Automation Hub"
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                required
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Target URL *</label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="e.g. http://localhost:5678 or https://github.com"
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Category</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Local Services, Development, Productivity"
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat })}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-xl border transition-colors cursor-pointer ${
                      formData.category === cat
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold"
                        : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Mode Tabs */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300">Icon Display Options</label>

              {/* Mode Selection Buttons */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/10">
                <button
                  type="button"
                  onClick={() => setIconTypeTab("auto")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-mono flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    iconTypeTab === "auto"
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <RefreshCw className="w-3 h-3" /> Auto Favicon
                </button>

                <button
                  type="button"
                  onClick={() => setIconTypeTab("lucide")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-mono flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    iconTypeTab === "lucide"
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Globe className="w-3 h-3" /> Lucide Icon
                </button>

                <button
                  type="button"
                  onClick={() => setIconTypeTab("custom")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-mono flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    iconTypeTab === "custom"
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <LinkIcon className="w-3 h-3" /> Custom Image
                </button>
              </div>

              {/* Tab Contents */}
              {iconTypeTab === "auto" && (
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono flex items-center gap-2.5">
                  {formData.url && getFaviconUrl(formData.url) ? (
                    <img
                      src={getFaviconUrl(formData.url)}
                      alt="Favicon preview"
                      className="w-7 h-7 object-contain rounded bg-black/40 p-1 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-indigo-400 shrink-0" />
                  )}
                  <span className="text-[11px] leading-relaxed">
                    Automatically fetches official domain favicon from Target URL with fallback to Lucide icon.
                  </span>
                </div>
              )}

              {iconTypeTab === "lucide" && (
                <div className="space-y-2">
                  {/* Popular Icons Grid */}
                  <div className="grid grid-cols-8 gap-2 p-2.5 rounded-2xl bg-white/[0.02] border border-white/10 max-h-36 overflow-y-auto">
                    {POPULAR_ICONS.map((iconStr) => {
                      const IconComp = ICON_MAP[iconStr] || Globe;
                      const isSelected = formData.iconName === iconStr;
                      return (
                        <button
                          key={iconStr}
                          type="button"
                          onClick={() => setFormData({ ...formData, iconName: iconStr })}
                          className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400"
                              : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                          title={iconStr}
                        >
                          <IconComp className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>

                  <Input
                    value={formData.iconName}
                    onChange={(e) => setFormData({ ...formData, iconName: e.target.value })}
                    placeholder="Or type Lucide icon name (e.g. Server, Database)"
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>
              )}

              {iconTypeTab === "custom" && (
                <div className="space-y-1.5">
                  <Input
                    value={formData.iconName}
                    onChange={(e) => setFormData({ ...formData, iconName: e.target.value })}
                    placeholder="Paste direct PNG / SVG image URL (https://...)"
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 font-mono">
                    Provide a direct image URL to use a custom app logo.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {isSubmitting ? "Saving..." : editingApp ? "Update App" : "Register App"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* COOL GLASSMORPHIC DELETE APP CONFIRMATION DIALOG (Popup Verif) */}
      {deletingAppConfirm && (
        <Dialog open={!!deletingAppConfirm} onOpenChange={() => setDeletingAppConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE APPLICATION</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete <span className="text-rose-300 font-bold">&quot;{deletingAppConfirm.name}&quot;</span> from your App Launcher?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingAppConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={async () => {
                  const targetApp = deletingAppConfirm;
                  setDeletingAppConfirm(null);
                  setApps((prev) => prev.filter((a) => a.id !== targetApp.id));
                  const res = await deleteApplication(targetApp.id);
                  if (!res.success) {
                    alert(res.message);
                    setApps(initialApps);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                Delete App
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
