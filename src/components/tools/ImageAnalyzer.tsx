"use client";

import React, { useState, useRef } from "react";
import {
  ImageIcon,
  Loader2,
  Copy,
  Check,
  Upload,
  X,
  Sparkles,
  Wand2,
  User,
  Palette,
  Camera,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function ImageAnalyzer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Mode & Single Custom Instruction
  const [analysisMode, setAnalysisMode] = useState<"full" | "style_only">("full");
  const [customInstruction, setCustomInstruction] = useState<string>("");

  // Result state
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP, etc.)");
      return;
    }

    setError(null);
    setSelectedFile(file);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageBase64(reader.result);
      }
    };
    reader.onerror = () => {
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageBase64(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/image-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          analysisMode,
          customInstruction,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze image");
      }

      setGeneratedPrompt(data.prompt || "");
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-5">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4.5 rounded-3xl bg-white/[0.02] border border-white/10 glass-panel">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 shadow-lg shadow-indigo-500/10">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              AI IMAGE DETAIL ANALYZER
              <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px] font-mono px-2 py-0.5">
                VISION AI
              </Badge>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Reverse-engineer photo aesthetics or customize subjects into super detailed text-to-image prompts.
            </p>
          </div>
        </div>
      </div>

      {/* Split-Pane Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: INPUT & CONTROLS (6 cols on lg) */}
        <div className="lg:col-span-6 glass-panel p-5 rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl space-y-5">
          {/* Mode Selector Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Pilih Mode Analisis</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/10 font-mono text-xs">
              <button
                type="button"
                onClick={() => setAnalysisMode("full")}
                className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  analysisMode === "full"
                    ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Deskripsikan Seluruh Foto</span>
              </button>

              <button
                type="button"
                onClick={() => setAnalysisMode("style_only")}
                className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  analysisMode === "style_only"
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Ambil Style & Lighting Saja</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Upload Zone / Sleek Image Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>Gambar Referensi</span>
              </label>
              {selectedFile && (
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]">
                  {selectedFile.name}
                </span>
              )}
            </div>

            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative cursor-pointer h-52 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                  isDragging
                    ? "border-indigo-400 bg-indigo-500/15 scale-[0.99]"
                    : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleInputChange}
                  className="hidden"
                />
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-3 animate-pulse">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-mono font-medium text-slate-200">
                  Klik untuk upload atau drag & drop gambar
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Format PNG, JPG, WEBP (Max 10MB)
                </p>
              </div>
            ) : (
              <div className="relative h-56 w-full rounded-2xl overflow-hidden border border-white/15 bg-black/60 group flex items-center justify-center">
                {/* Ambient Blurred Backdrop */}
                <div
                  className="absolute inset-0 bg-cover bg-center blur-xl opacity-30 scale-110"
                  style={{ backgroundImage: `url(${previewUrl})` }}
                />
                <img
                  src={previewUrl}
                  alt="Reference Preview"
                  className="relative z-10 max-h-56 max-w-full object-contain rounded-lg shadow-2xl"
                />
                <div className="absolute inset-0 z-20 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClearImage}
                    className="rounded-xl font-mono text-xs flex items-center gap-1.5 shadow-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Ganti Gambar</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Single Optional Custom Subject / Instruction Field */}
          {analysisMode === "full" && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                <span>Instruksi / Subjek Kustom (Opsional)</span>
              </label>
              <Input
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="misal: gunakan muka saya tanpa ada yang berubah"
                className="bg-white/[0.03] border-white/15 text-xs text-slate-100 placeholder:text-slate-500 rounded-xl h-10 font-mono focus-visible:ring-indigo-500/50"
              />
              <p className="text-[10px] font-mono text-slate-500">
                Bisa ditulis dalam bahasa Indonesia. AI akan menerjemahkan & menyematkannya ke dalam prompt Inggris.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Action Trigger Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!imageBase64 || isAnalyzing}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-200" />
                <span>Menganalisis Gambar...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2 text-indigo-200" />
                <span>
                  {analysisMode === "style_only"
                    ? "Generate Style & Lighting Saja"
                    : "Generate Super Detail Prompt"}
                </span>
              </>
            )}
          </Button>
        </div>

        {/* RIGHT PANE: OUTPUT (6 cols on lg) */}
        <div className="lg:col-span-6 glass-panel p-5 rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl flex flex-col justify-between space-y-4 min-h-[540px]">
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Hasil Master Prompt</span>
              </label>
            </div>

            {/* Read-Only Output Textarea */}
            <div className="relative flex-1 flex flex-col space-y-2">
              <Textarea
                readOnly
                value={generatedPrompt}
                placeholder="Hasil prompt super detail yang di-reverse-engineer akan muncul di sini..."
                className="w-full h-full min-h-[400px] p-4.5 bg-white/[0.02] border-white/15 text-slate-200 font-mono text-xs leading-relaxed rounded-2xl resize-none focus-visible:ring-indigo-500/50 selection:bg-indigo-500/30 placeholder:text-slate-600"
              />
              {generatedPrompt && (
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 pt-1">
                  <span>Words: {generatedPrompt.split(/\s+/).filter(Boolean).length}</span>
                  <span>Characters: {generatedPrompt.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Copy Action Button */}
          <Button
            onClick={handleCopyPrompt}
            disabled={!generatedPrompt}
            variant="outline"
            className="w-full h-11 border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 font-mono text-xs rounded-2xl transition-all disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-emerald-400" />
                <span className="text-emerald-400">Prompt Berhasil Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2 text-slate-400" />
                <span>Copy Master Prompt ke Clipboard</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
