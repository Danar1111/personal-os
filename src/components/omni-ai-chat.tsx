"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { useZenRunning } from "@/hooks/use-zen-running";
import {
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  Loader2,
  Trash2,
  ExternalLink,
  Maximize2,
  Minimize2,
  X,
  Flame,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CHAT_STORAGE_KEY = "personal_os_omnibar_chat_history";

/** Robustly extract plain text from any AI SDK message structure */
function extractText(m: any): string {
  if (typeof m?.content === "string" && m.content.trim()) return m.content.trim();

  if (Array.isArray(m?.content)) {
    const texts = m.content
      .filter((p: any) => p?.type === "text" && p?.text)
      .map((p: any) => p.text as string);
    if (texts.length) return texts.join("\n").trim();
  }

  if (Array.isArray(m?.parts)) {
    const texts = m.parts
      .filter((p: any) => p?.type === "text" && p?.text)
      .map((p: any) => p.text as string);
    if (texts.length) return texts.join("\n").trim();
  }

  if (typeof m?.text === "string" && m.text.trim()) return m.text.trim();

  return "";
}

/** Extract all tool invocations from a message */
function extractToolInvocations(m: any): any[] {
  const fromDirect = Array.isArray(m?.toolInvocations) ? m.toolInvocations : [];
  const fromParts = Array.isArray(m?.parts)
    ? m.parts
        .filter((p: any) => p?.type === "tool-invocation" || p?.toolInvocation)
        .map((p: any) => p?.toolInvocation ?? p)
    : [];

  const seen = new Set<string>();
  const all = [...fromDirect, ...fromParts].filter((t) => {
    const id = t?.toolCallId ?? t?.id ?? JSON.stringify(t);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return all;
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".png") ||
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".gif") ||
    clean.endsWith(".webp") ||
    clean.endsWith(".svg") ||
    clean.endsWith(".bmp") ||
    clean.endsWith(".ico") ||
    clean.startsWith("/uploads/") ||
    clean.startsWith("data:image/")
  );
}

/** Parses Markdown images ![alt](url), Markdown links [Label](/url), raw URLs, AND app routes into interactive elements with image preview support */
function renderFormattedText(text: string, onInternalLinkClick: () => void, zenRunning: boolean) {
  if (!text) return null;

  const routeLabelMap: Record<string, string> = {
    "/apps": "App Launcher",
    "/tasks": "Task Omni-Kanban",
    "/vault": "Second Brain Vault",
    "/calendar": "Master Calendar",
    "/finance": "Finance Hub",
    "/skills": "Skill Matrix",
    "/inventory": "Asset Vault",
    "/drive": "Local Drive",
    "/watchlist": "TMDB Watchlist",
    "/settings": "System Settings",
    "/zen": "Zen Time-Blocker",
    "/ai-briefing": "Daily AI Briefing",
  };

  const combinedRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s<>"'\)]+)|(\/(?:apps|tasks|vault|calendar|finance|skills|inventory|drive|watchlist|settings|zen|ai-briefing)(?:\?[^\s<>"'\)]*)?)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  const zenPill = (key: string, label: string) => (
    <span
      key={key}
      className="inline-flex items-center gap-1 font-semibold text-slate-500 font-mono mx-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 cursor-not-allowed"
      title="Links locked during Zen mode"
    >
      <Flame className="w-3 h-3 text-amber-500 shrink-0" />
      <span className="truncate max-w-sm">{label}</span>
    </span>
  );

  while ((match = combinedRegex.exec(text)) !== null) {
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    if (match[1] !== undefined && match[2]) {
      // Group 1 & 2: Markdown Image ![alt](url)
      const alt = match[1] || "Image Attachment";
      const rawUrl = match[2];
      const isInternal = rawUrl.startsWith("/");

      if (zenRunning) {
        parts.push(zenPill(`img-${matchIndex}`, alt));
      } else {
        parts.push(
          <span key={`img-${matchIndex}`} className="block my-2 space-y-1">
            <a
              href={rawUrl}
              target={isInternal ? "_self" : "_blank"}
              rel={isInternal ? undefined : "noopener noreferrer"}
              onClick={isInternal ? onInternalLinkClick : undefined}
              className="block w-fit"
            >
              <img
                src={rawUrl}
                alt={alt}
                className="max-h-64 max-w-full rounded-2xl border border-white/15 shadow-xl object-contain bg-black/40 hover:opacity-90 transition-opacity"
              />
            </a>
            <span className="flex items-center gap-2">
              {isInternal ? (
                <a
                  href={rawUrl}
                  onClick={onInternalLinkClick}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 underline font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
                >
                  <span>{alt}</span>
                  <ExternalLink className="w-3 h-3 inline shrink-0" />
                </a>
              ) : (
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                >
                  <span>{alt}</span>
                  <ExternalLink className="w-3 h-3 inline shrink-0" />
                </a>
              )}
            </span>
          </span>
        );
      }
    } else if (match[3] && match[4]) {
      // Group 3 & 4: Markdown Link [Label](url)
      const label = match[3];
      const rawUrl = match[4];
      const isInternal = rawUrl.startsWith("/");
      const isImage = isImageUrl(rawUrl);

      if (zenRunning) {
        parts.push(zenPill(`link-${matchIndex}`, label));
      } else if (isImage) {
        parts.push(
          <span key={`link-img-${matchIndex}`} className="block my-2 space-y-1">
            <a
              href={rawUrl}
              target={isInternal ? "_self" : "_blank"}
              rel={isInternal ? undefined : "noopener noreferrer"}
              onClick={isInternal ? onInternalLinkClick : undefined}
              className="block w-fit"
            >
              <img
                src={rawUrl}
                alt={label}
                className="max-h-64 max-w-full rounded-2xl border border-white/15 shadow-xl object-contain bg-black/40 hover:opacity-90 transition-opacity"
              />
            </a>
            <span className="flex items-center gap-2">
              {isInternal ? (
                <a
                  href={rawUrl}
                  onClick={onInternalLinkClick}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 underline font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
                >
                  <span>{label}</span>
                  <ExternalLink className="w-3 h-3 inline shrink-0" />
                </a>
              ) : (
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                >
                  <span>{label}</span>
                  <ExternalLink className="w-3 h-3 inline shrink-0" />
                </a>
              )}
            </span>
          </span>
        );
      } else if (isInternal) {
        parts.push(
          <a
            key={`link-${matchIndex}`}
            href={rawUrl}
            onClick={onInternalLinkClick}
            className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 underline font-mono mx-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-all hover:bg-indigo-500/20"
          >
            <span>{label}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0 text-indigo-400" />
          </a>
        );
      } else {
        parts.push(
          <a
            key={`link-${matchIndex}`}
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono mx-1"
          >
            <span>{label}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0" />
          </a>
        );
      }
    } else if (match[5]) {
      // Group 5: Raw HTTP / HTTPS URL
      const rawUrl = match[5];
      const isImage = isImageUrl(rawUrl);

      if (zenRunning) {
        parts.push(zenPill(`url-${matchIndex}`, rawUrl));
      } else if (isImage) {
        parts.push(
          <span key={`url-img-${matchIndex}`} className="block my-2 space-y-1">
            <a href={rawUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
              <img
                src={rawUrl}
                alt="Image"
                className="max-h-64 max-w-full rounded-2xl border border-white/15 shadow-xl object-contain bg-black/40 hover:opacity-90 transition-opacity"
              />
            </a>
            <a
              href={rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
            >
              <span className="truncate max-w-md">{rawUrl}</span>
              <ExternalLink className="w-3 h-3 inline shrink-0" />
            </a>
          </span>
        );
      } else {
        parts.push(
          <a
            key={`url-${matchIndex}`}
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono mx-1 break-all"
          >
            <span className="truncate max-w-md">{rawUrl}</span>
            <ExternalLink className="w-3.5 h-3.5 inline shrink-0" />
          </a>
        );
      }
    } else if (match[6]) {
      // Group 6: Internal Route /apps, /drive?search=...
      const rawRoute = match[6];
      const cleanPath = rawRoute.split("?")[0].toLowerCase();
      const pageTitle = routeLabelMap[cleanPath] || cleanPath;

      if (zenRunning) {
        parts.push(zenPill(`route-${matchIndex}`, pageTitle));
      } else {
        parts.push(
          <a
            key={`route-${matchIndex}`}
            href={rawRoute}
            onClick={onInternalLinkClick}
            className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 underline font-mono mx-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-all hover:bg-indigo-500/20"
          >
            <span>Open {pageTitle} ({rawRoute})</span>
            <ExternalLink className="w-3 h-3 inline shrink-0 text-indigo-400" />
          </a>
        );
      }
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
}

export function OmniAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const zenRunning = useZenRunning();

  const { messages, sendMessage, status, setMessages } = useChat({
    maxSteps: 5,
  } as any);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Listen for custom open events (e.g. open-omni-ai) or Ctrl+J shortcut
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setIsOpen(true);
      if (e.detail?.initialQuery) {
        setInput(e.detail.initialQuery);
      }
    };
    window.addEventListener("open-omni-ai" as any, handleOpen);

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-omni-ai" as any, handleOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Restore saved chat history on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {}
  }, [setMessages]);

  // Persist chat history to localStorage whenever messages update
  useEffect(() => {
    if (messages && messages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([]);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col flex-nowrap bg-[#0e0e12]/95 border-white/15 text-slate-100 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-2xl transition-all duration-300",
          isExpanded
            ? "sm:max-w-6xl w-[96vw] h-[88vh] max-h-[900px]"
            : "sm:max-w-2xl w-[92vw] h-[680px] max-h-[85vh]"
        )}
      >
        <DialogTitle className="sr-only">Omni AI Control Assistant</DialogTitle>

        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <span>OMNI AI ASSISTANT</span>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[9px] font-mono">
                  GPT-4o
                </Badge>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Control Center AI • Press Ctrl+J anytime</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="h-8 px-2.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl font-mono gap-1"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
              title={isExpanded ? "Collapse View" : "Expand Fullscreen View"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Chat Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3 font-mono">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
                <Bot className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-bold text-slate-200">How can I assist your Personal OS today?</p>
                <p className="text-xs text-slate-400 font-sans">Ask me to query notes, create tasks, summarize briefing, or inspect system state.</p>
              </div>
            </div>
          ) : (
            messages.map((m: any) => {
              const textContent = extractText(m);
              const toolInvocations = extractToolInvocations(m);
              const isUser = m.role === "user";

              if (!textContent && toolInvocations.length === 0) return null;

              return (
                <div
                  key={m.id}
                  className={cn("flex gap-3 text-xs font-mono", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-2 max-w-[85%]">
                    {textContent && (
                      <div
                        className={cn(
                          "p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans text-xs shadow-md",
                          isUser
                            ? "bg-indigo-600 text-white rounded-tr-none font-mono"
                            : "bg-white/[0.04] border border-white/10 text-slate-200 rounded-tl-none"
                        )}
                      >
                        {isUser ? textContent : renderFormattedText(textContent, () => setIsOpen(false), zenRunning)}
                      </div>
                    )}

                    {toolInvocations.map((t: any) => {
                      const isComplete = t.state === "result" || !!t.result;
                      const callId = t.toolCallId ?? t.id ?? Math.random().toString();
                      return (
                        <div
                          key={callId}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] font-mono text-slate-300"
                        >
                          {isComplete ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                          )}
                          <span>
                            Tool: <strong className="text-indigo-300">{t.toolName}</strong>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 w-fit">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Omni AI is analyzing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-white/[0.01] flex flex-col gap-2 shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              autoFocus
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Omni AI assistant... (Enter to send, Shift+Enter for new line)"
              disabled={isLoading}
              className="flex-1 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl min-h-[44px] max-h-[140px] py-3 px-4 font-mono focus-visible:ring-indigo-500/40 resize-none scrollbar-thin"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 px-4 cursor-pointer shadow-lg shadow-indigo-600/30 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between px-2 text-[10px] font-mono text-slate-500">
            <span>
              Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Shift + Enter</kbd> for newline
            </span>
            <span>GPT-4o Multiline</span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
