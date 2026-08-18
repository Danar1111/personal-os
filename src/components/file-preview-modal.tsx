"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File,
  Copy,
  Check,
  Maximize2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PreviewableFile {
  title: string;
  urlOrPath: string;
  source: "local" | "google";
  extension?: string;
  mimeType?: string;
  size?: string | number;
  googleFileId?: string;
  webViewLink?: string;
}

interface FilePreviewModalProps {
  file: PreviewableFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const ext = (file?.extension || file?.title.split(".").pop() || "").toLowerCase();
  const mime = (file?.mimeType || "").toLowerCase();

  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext) || mime.includes("image");
  const isVideo = ["mp4", "webm", "mkv", "mov", "avi"].includes(ext) || mime.includes("video");
  const isAudio = ["mp3", "wav", "flac", "aac", "ogg"].includes(ext) || mime.includes("audio");
  const isPdf = ext === "pdf" || mime.includes("pdf");
  const isCodeOrText = ["txt", "md", "json", "js", "ts", "jsx", "tsx", "html", "css", "py", "sql", "sh", "yml", "yaml", "env", "csv", "log"].includes(ext) || mime.includes("text") || mime.includes("json") || mime.includes("javascript");

  // Fetch text content for local text/code files
  useEffect(() => {
    if (isOpen && file && file.source === "local" && isCodeOrText && !isPdf && !isImage && !isVideo && !isAudio) {
      setIsLoadingText(true);
      fetch(file.urlOrPath)
        .then((res) => (res.ok ? res.text() : "Unable to load file content."))
        .then((text) => {
          setTextContent(text);
          setIsLoadingText(false);
        })
        .catch((err) => {
          console.error("Failed to read text file:", err);
          setTextContent("Error reading file content.");
          setIsLoadingText(false);
        });
    } else {
      setTextContent(null);
    }
  }, [isOpen, file, isCodeOrText, isPdf, isImage, isVideo, isAudio]);

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-5xl w-[94vw] h-[88vh] bg-[#0c0c14]/95 border-white/15 text-white p-0 rounded-3xl overflow-hidden backdrop-blur-2xl flex flex-col shadow-2xl z-[9999]"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-white/10 bg-white/[0.02] shrink-0 font-mono">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 shrink-0">
              {isImage && <ImageIcon className="w-4 h-4 text-emerald-400" />}
              {isVideo && <Film className="w-4 h-4 text-purple-400" />}
              {isAudio && <Music className="w-4 h-4 text-amber-400" />}
              {isPdf && <FileText className="w-4 h-4 text-rose-400" />}
              {isCodeOrText && !isPdf && <FileCode className="w-4 h-4 text-cyan-400" />}
              {!isImage && !isVideo && !isAudio && !isPdf && !isCodeOrText && (
                <File className="w-4 h-4 text-slate-400" />
              )}
            </div>

            <div className="space-y-0.5 min-w-0">
              <DialogTitle className="text-sm font-bold text-white truncate max-w-lg">
                {file.title}
              </DialogTitle>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase border-white/10 bg-white/[0.04] text-slate-300 px-1.5 py-0"
                >
                  {file.source === "google" ? "Google Drive" : "Local Storage"}
                </Badge>
                {ext && <span className="uppercase font-semibold text-slate-400">• .{ext}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {textContent && (
              <Button
                size="xs"
                variant="outline"
                onClick={handleCopyText}
                className="bg-white/5 border-white/10 hover:bg-white/10 text-xs font-mono h-8 px-2.5 gap-1 text-slate-300"
              >
                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hasCopied ? "Copied" : "Copy"}</span>
              </Button>
            )}

            {file.source === "local" && (
              <a
                href={file.urlOrPath}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono transition-colors"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            <a
              href={file.webViewLink || file.urlOrPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono transition-all shadow-md shadow-indigo-600/30"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open New Tab</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Viewport */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 sm:p-6 bg-black/40">
          {/* 1. Google Drive Viewer (If googleFileId is present, use Google Drive preview for 100% reliable rendering) */}
          {file.googleFileId ? (
            <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
              <iframe
                src={`https://drive.google.com/file/d/${file.googleFileId}/preview`}
                className="w-full h-full border-0"
                allow="autoplay"
                title={file.title}
              />
            </div>
          ) : isImage ? (
            /* 2. Image Lightbox */
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={file.urlOrPath}
                alt={file.title}
                className="max-h-[75vh] max-w-full object-contain rounded-2xl border border-white/10 shadow-2xl bg-black/50"
              />
            </div>
          ) : isPdf ? (
            /* 3. Local PDF Viewer */
            <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#202028]">
              <iframe
                src={`${file.urlOrPath}#toolbar=1`}
                className="w-full h-full border-0"
                title={file.title}
              />
            </div>
          ) : isVideo ? (
            /* 4. Video Player */
            <div className="w-full max-w-4xl max-h-[75vh] flex items-center justify-center">
              <video
                src={file.urlOrPath}
                controls
                autoPlay
                className="w-full max-h-[75vh] rounded-2xl border border-white/10 shadow-2xl bg-black"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : isAudio ? (
            /* 5. Audio Player */
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 max-w-md w-full text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-xl">
                <Music className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-mono font-bold text-white truncate">{file.title}</h4>
                <p className="text-xs font-mono text-slate-400">Audio Track Player</p>
              </div>
              <audio src={file.urlOrPath} controls autoPlay className="w-full" />
            </div>
          ) : isCodeOrText ? (
            /* 6. Code & Text File Viewer */
            <div className="w-full h-full rounded-2xl border border-white/10 bg-[#08080e] p-4 overflow-auto scrollbar-thin font-mono text-xs text-slate-200 shadow-2xl">
              {isLoadingText ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Loading file content...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono">
                  {textContent}
                </pre>
              )}
            </div>
          ) : (
            /* 7. Generic Unsupported Preview */
            <div className="text-center p-8 space-y-4 max-w-md bg-white/[0.02] border border-white/10 rounded-3xl shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mx-auto">
                <File className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-mono font-bold text-white">Preview Not Available</h4>
                <p className="text-xs font-mono text-slate-400">
                  This file format cannot be rendered inline in browser. You can download or open it in a new tab.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <a
                  href={file.urlOrPath}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all shadow-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
