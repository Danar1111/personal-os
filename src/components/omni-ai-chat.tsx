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
import { getActiveModelAction } from "@/app/settings/actions";

const CHAT_STORAGE_KEY = "personal_os_omnibar_chat_history";

/** Robustly extract plain text from ai v7 UIMessage (parts-based) */
function extractText(m: any): string {
  // ai v7: text is in m.parts[].text where type === "text"
  if (Array.isArray(m?.parts)) {
    const texts = m.parts
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string" && p.text.trim())
      .map((p: any) => p.text as string);
    if (texts.length) return texts.join("\n").trim();
  }

  // Fallback: legacy content string
  if (typeof m?.content === "string" && m.content.trim()) return m.content.trim();

  // Fallback: legacy content array
  if (Array.isArray(m?.content)) {
    const texts = m.content
      .filter((p: any) => p?.type === "text" && p?.text)
      .map((p: any) => p.text as string);
    if (texts.length) return texts.join("\n").trim();
  }

  return "";
}

/** Extract all tool invocations from ai v7 UIMessage parts or legacy toolInvocations */
function extractToolInvocations(m: any): any[] {
  if (Array.isArray(m?.parts)) {
    const partsTools = m.parts.filter((p: any) => {
      if (!p?.type) return false;
      return p.type === "dynamic-tool" || (typeof p.type === "string" && p.type.startsWith("tool-"));
    });
    if (partsTools.length > 0) return partsTools;
  }

  if (Array.isArray(m?.toolInvocations)) {
    return m.toolInvocations;
  }

  return [];
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
    "/knowledge": "Personal Knowledge Vault",
    "/emailer": "Omni-Emailer Studio",
    "/emailer/templates": "Omni-Emailer Studio",
    "/settings": "System Settings",
    "/zen": "Zen Time-Blocker",
    "/ai-briefing": "Daily AI Briefing",
  };

  const combinedRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s<>"'\)]+)|(\/(?:apps|tasks|vault|calendar|finance|skills|inventory|drive|watchlist|knowledge|emailer|settings|zen|ai-briefing)(?:\?[^\s<>"'\)]*)?)/gi;
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

function safeSerializeMessages(msgs: any[]): string {
  return JSON.stringify(msgs, (key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Error) return value.message;
    if (typeof value === "function") return undefined;
    return value;
  });
}

export function OmniAIChat() {
  const [initialMsgs, setInitialMsgs] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInitialMsgs(parsed);
        }
      }
    } catch (e) {}
    setIsLoaded(true);
  }, []);

  if (!isLoaded) return null;

  return <ChatCore initialMsgs={initialMsgs} />;
}

// ChatCore lives outside DialogContent so useChat state survives modal open/close.
function ChatCore({ initialMsgs }: { initialMsgs: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModel, setActiveModel] = useState("gpt-4o-mini");
  const [initialPrompt, setInitialPrompt] = useState("");
  const zenRunning = useZenRunning();

  // useChat lives HERE — outside DialogContent — so messages persist across open/close
  const { messages, sendMessage, status, setMessages } = useChat({
    maxSteps: 5,
    messages: initialMsgs,
    initialMessages: initialMsgs,
  } as any);

  useEffect(() => {
    const onClear = () => {
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch (e) {}
      if (typeof setMessages === "function") {
        setMessages([]);
      }
    };
    window.addEventListener("omni-ai-clear" as any, onClear);
    return () => window.removeEventListener("omni-ai-clear" as any, onClear);
  }, [setMessages]);

  useEffect(() => {
    getActiveModelAction().then((m) => { if (m) setActiveModel(m); });
  }, [isOpen]);

  useEffect(() => {
    const handleOpen = (e?: any) => {
      setIsOpen(true);
      const query = e?.detail?.initialQuery || e?.detail?.prompt;
      if (query && typeof query === "string") {
        setInitialPrompt(query);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Ctrl + Shift + J -> Toggle Expand / Fullscreen
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsExpanded((p) => !p);
      }
      // Ctrl + J -> Toggle Open / Close
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((p) => !p);
      }
    };
    window.addEventListener("open-omni-ai" as any, handleOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-omni-ai" as any, handleOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const isLoading = status === "submitted" || status === "streaming";

  // Persist every update to localStorage using safeSerializeMessages
  useEffect(() => {
    if (messages && messages.length > 0) {
      try {
        const serialized = safeSerializeMessages(messages);
        localStorage.setItem(CHAT_STORAGE_KEY, serialized);
      } catch (e) {
        console.error("[OmniAI] LocalStorage save error:", e);
      }
    } else if (messages && messages.length === 0) {
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch (e) {}
    }
  }, [messages]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col flex-nowrap bg-[#0e0e12] border-white/15 text-slate-100 rounded-3xl p-0 overflow-hidden shadow-2xl",
          isExpanded
            ? "sm:max-w-6xl w-[96vw] h-[88vh] max-h-[900px]"
            : "sm:max-w-2xl w-[92vw] h-[680px] max-h-[85vh]"
        )}
      >
        <DialogTitle className="sr-only">Omni AI Control Assistant</DialogTitle>
        <ChatDialogContent
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          activeModel={activeModel}
          setIsOpen={setIsOpen}
          zenRunning={zenRunning}
          messages={messages}
          sendMessage={sendMessage}
          isLoading={isLoading}
          initialPrompt={initialPrompt}
          clearInitialPrompt={() => setInitialPrompt("")}
        />
      </DialogContent>
    </Dialog>
  );
}

// Pure display/input component — no useChat hook here, receives everything as props
function ChatDialogContent({
  isExpanded,
  setIsExpanded,
  activeModel,
  setIsOpen,
  zenRunning,
  messages,
  sendMessage,
  isLoading,
  initialPrompt,
  clearInitialPrompt,
}: {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  activeModel: string;
  setIsOpen: (v: boolean) => void;
  zenRunning: boolean;
  messages: any[];
  sendMessage: (opts: { text: string }) => void;
  isLoading: boolean;
  initialPrompt: string;
  clearInitialPrompt: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Populate input when initialPrompt is provided via Jump to event
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      clearInitialPrompt();
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, clearInitialPrompt]);

  // Focus input when modal opens (component mounts = dialog opened)
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on new messages / loading state
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMsg = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <span>OMNI AI ASSISTANT</span>
              <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[9px] font-mono">
                {activeModel}
              </Badge>
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">Control Center AI • Ctrl+J (toggle) • Ctrl+Shift+J (fullscreen)</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("omni-ai-clear"))}
              className="h-8 px-2.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl font-mono gap-1"
              title="Clear Chat History"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10" title={isExpanded ? "Collapse View (Ctrl+Shift+J)" : "Expand Fullscreen View (Ctrl+Shift+J)"}>
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
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
          messages.flatMap((m: any) => {
            const isUser = m.role === "user";

            if (isUser) {
              const textContent = extractText(m);
              if (!textContent) return [];
              return [
                <div key={m.id} className="flex gap-3 text-xs font-mono justify-end">
                  <div className="space-y-2 max-w-[85%]">
                    <div className="p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans text-xs shadow-md bg-indigo-600 text-white rounded-tr-none font-mono">
                      {textContent}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              ];
            }

            // For assistant messages: split parts into natural "rounds"
            // AI SDK v7 pattern: [tool1-call, tool1-result, tool2-call, tool2-result, ..., text]
            // We render each tool as its own bubble + final text as its own bubble
            const parts: any[] = Array.isArray(m?.parts) ? m.parts : [];

            type Round = { text?: string; tools: any[] };
            const rounds: Round[] = [];

            if (parts.length === 0) {
              // Fallback for legacy format
              const textContent = extractText(m);
              const toolInvocations = extractToolInvocations(m);
              if (!textContent && toolInvocations.length === 0) return [];
              // Each tool gets its own round, text gets final round
              toolInvocations.forEach((t: any) => rounds.push({ tools: [t] }));
              if (textContent) rounds.push({ text: textContent, tools: [] });
              if (rounds.length === 0) rounds.push({ text: textContent || undefined, tools: toolInvocations });
            } else {
              // Group paired tool-call + tool-result parts by toolCallId
              const toolMap = new Map<string, any>();
              const toolOrder: string[] = [];
              let finalText = "";

              for (const part of parts) {
                const isText = part?.type === "text";
                const isToolCall = typeof part?.type === "string" && (part.type === "tool-call" || part.type === "dynamic-tool" || (part.type.startsWith("tool-") && !part.type.includes("result")));
                const isToolResult = typeof part?.type === "string" && part.type.includes("result");

                if (isText && part.text?.trim()) {
                  finalText = part.text.trim();
                } else if (isToolCall) {
                  const callId = part.toolCallId ?? part.id ?? `tool-${toolOrder.length}`;
                  if (!toolMap.has(callId)) {
                    toolMap.set(callId, { ...part });
                    toolOrder.push(callId);
                  }
                } else if (isToolResult) {
                  const callId = part.toolCallId ?? part.id;
                  if (callId && toolMap.has(callId)) {
                    const existing = toolMap.get(callId);
                    toolMap.set(callId, { ...existing, output: part.output ?? part.result, result: part.output ?? part.result, state: "result" });
                  }
                } else if (part?.toolName || part?.toolCallId) {
                  // unified part (tool-invocation with all data)
                  const callId = part.toolCallId ?? part.id ?? `tool-${toolOrder.length}`;
                  if (!toolMap.has(callId)) {
                    toolMap.set(callId, part);
                    toolOrder.push(callId);
                  } else {
                    toolMap.set(callId, { ...toolMap.get(callId), ...part });
                  }
                }
              }

              // Build rounds: each tool = one round, final text = one round
              for (const callId of toolOrder) {
                rounds.push({ tools: [toolMap.get(callId)] });
              }
              if (finalText) {
                rounds.push({ text: finalText, tools: [] });
              }

              // Fallback: if nothing parsed, use extractors
              if (rounds.length === 0) {
                const textContent = extractText(m);
                const toolInvocations = extractToolInvocations(m);
                toolInvocations.forEach((t: any) => rounds.push({ tools: [t] }));
                if (textContent) rounds.push({ text: textContent, tools: [] });
              }
            }

            return rounds
              .filter((r) => r.text || r.tools.length > 0)
              .map((round, roundIdx) => (
                <div key={`${m.id}-round-${roundIdx}`} className="flex gap-3 text-xs font-mono justify-start">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="space-y-2 max-w-[85%]">
                    {round.text && (
                      <div className="p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans text-xs shadow-md bg-white/[0.04] border border-white/10 text-slate-200 rounded-tl-none">
                        {renderFormattedText(round.text, () => setIsOpen(false), zenRunning)}
                      </div>
                    )}
                    {round.tools.map((t: any, stepIdx: number) => {
                      const isComplete = t.state === "output-available" || t.state === "result" || !!t.result || !!t.output;
                      const callId = t.toolCallId ?? t.id ?? `${m.id}-${roundIdx}-${stepIdx}`;
                      const rawOutput = t.output ?? t.result;
                      const resultMsg = typeof rawOutput === "string" ? rawOutput : rawOutput?.message;
                      const toolNameDisplay = t.toolName ?? (typeof t.type === "string" && t.type.startsWith("tool-") ? t.type.replace(/^tool-/, "") : t.type) ?? "tool";
                      const args = t.args || t.input;

                      let executingLabel = `Running ${toolNameDisplay}...`;
                      if (toolNameDisplay === "send_email" && args?.to) {
                        executingLabel = `Sending email to ${args.to}...`;
                      } else if (toolNameDisplay === "get_trending_movies") {
                        executingLabel = `Fetching trending movies from TMDB...`;
                      } else if (toolNameDisplay === "fetch_news_articles") {
                        executingLabel = `Fetching latest news...`;
                      } else if (toolNameDisplay === "get_stock_quote") {
                        executingLabel = `Fetching stock quote...`;
                      } else if (toolNameDisplay === "search_tmdb_movies") {
                        executingLabel = `Searching TMDB for movies...`;
                      }

                      return (
                        <div key={callId} className="space-y-1.5">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] font-mono text-slate-300">
                            {isComplete
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              : <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                            }
                            <span>
                              {isComplete ? `Executed Tool: ` : executingLabel}
                              {isComplete && <strong className="text-indigo-300">{toolNameDisplay}</strong>}
                            </span>
                          </div>
                          {resultMsg && (
                            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs shadow-md">
                              {renderFormattedText(resultMsg, () => setIsOpen(false), zenRunning)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
          })
        )}
        {isLoading && (() => {
          // Check if AI has already executed tools in the last assistant message (mid-chain)
          const lastMsg = messages[messages.length - 1];
          const lastTools = lastMsg?.role === "assistant" ? extractToolInvocations(lastMsg) : [];
          const isChaining = lastTools.length > 0;
          return (
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 w-fit">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isChaining ? "Omni AI is chaining next step..." : "Omni AI is analyzing..."}</span>
            </div>
          );
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMsg(); }} className="p-3 border-t border-white/10 bg-white/[0.01] flex flex-col gap-2 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            autoFocus
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
            placeholder={isLoading ? "Omni AI is responding... (Type message here)" : "Ask Omni AI assistant... (Enter to send, Shift+Enter for new line)"}
            className="flex-1 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl min-h-[44px] max-h-[140px] py-3 px-4 font-mono focus-visible:ring-indigo-500/40 resize-none scrollbar-thin"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 px-4 cursor-pointer shadow-lg shadow-indigo-600/30 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between px-2 text-[10px] font-mono text-slate-500">
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Enter</kbd> send • <kbd className="px-1 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Ctrl+J</kbd> open • <kbd className="px-1 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Ctrl+Shift+J</kbd> fullscreen</span>
          <span>{activeModel}</span>
        </div>
      </form>
    </>
  );
}
