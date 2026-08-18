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
    const toolMap = new Map<string, any>();
    const toolOrder: string[] = [];

    for (const part of m.parts) {
      const isToolCall = part?.type === "tool-call" || part?.type === "dynamic-tool" || (typeof part?.type === "string" && part.type.startsWith("tool-") && !part.type.includes("result"));
      const isToolResult = typeof part?.type === "string" && part.type.includes("result");

      if (isToolCall) {
        const callId = part.toolCallId ?? part.id ?? `tool-${toolOrder.length}`;
        if (!toolMap.has(callId)) {
          const toolName = part.toolName || (typeof part.type === "string" ? part.type.replace(/^tool-/, "") : "tool");
          toolMap.set(callId, {
            toolCallId: callId,
            toolName,
            args: part.args || part.input || {},
            state: "executing",
            ...part
          });
          toolOrder.push(callId);
        } else {
          const existing = toolMap.get(callId);
          toolMap.set(callId, {
            ...existing,
            ...part,
            args: part.args || part.input || existing.args,
          });
        }
      } else if (isToolResult) {
        const callId = part.toolCallId ?? part.id;
        if (callId && toolMap.has(callId)) {
          const existing = toolMap.get(callId);
          toolMap.set(callId, {
            ...existing,
            output: part.output ?? part.result,
            result: part.output ?? part.result,
            state: "result",
          });
        }
      } else if (part?.toolName || part?.toolCallId) {
        const callId = part.toolCallId ?? part.id ?? `tool-${toolOrder.length}`;
        const hasResult = part.result !== undefined || part.output !== undefined || part.state === "result" || part.state === "output-available";
        if (!toolMap.has(callId)) {
          toolMap.set(callId, {
            ...part,
            toolCallId: callId,
            toolName: part.toolName || "tool",
            args: part.args || part.input || {},
            state: hasResult ? "result" : "executing",
          });
          toolOrder.push(callId);
        } else {
          const existing = toolMap.get(callId);
          toolMap.set(callId, {
            ...existing,
            ...part,
            state: hasResult ? "result" : existing.state,
          });
        }
      }
    }

    if (toolOrder.length > 0) {
      return toolOrder.map((id) => toolMap.get(id));
    }
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
    "/drive": "Drive",
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
            className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 underline font-mono my-0.5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-all hover:bg-indigo-500/20 max-w-full min-w-0 overflow-hidden align-middle"
          >
            <span className="truncate max-w-full">{label}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0 text-indigo-400 ml-0.5" />
          </a>
        );
      } else {
        parts.push(
          <a
            key={`link-${matchIndex}`}
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono my-0.5 max-w-full min-w-0 overflow-hidden align-middle"
          >
            <span className="truncate max-w-full">{label}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0 ml-0.5" />
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
          <span key={`url-img-${matchIndex}`} className="block my-2 space-y-1 max-w-full overflow-hidden">
            <a href={rawUrl} target="_blank" rel="noopener noreferrer" className="block w-fit max-w-full">
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
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 max-w-full min-w-0 overflow-hidden"
            >
              <span className="truncate max-w-full">{rawUrl}</span>
              <ExternalLink className="w-3 h-3 inline shrink-0 ml-0.5" />
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
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono my-0.5 max-w-full min-w-0 overflow-hidden align-middle"
          >
            <span className="truncate max-w-full">{rawUrl}</span>
            <ExternalLink className="w-3.5 h-3.5 inline shrink-0 ml-0.5" />
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
            className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 underline font-mono my-0.5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-all hover:bg-indigo-500/20 max-w-full min-w-0 overflow-hidden align-middle"
          >
            <span className="truncate max-w-full">Open {pageTitle} ({rawRoute})</span>
            <ExternalLink className="w-3 h-3 inline shrink-0 text-indigo-400 ml-0.5" />
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

  // --- PLAN & EXECUTE ENGINE ---
  const [engineState, setEngineState] = useState<{ planId: string, steps: any[], currentIndex: number, status: 'idle'|'running'|'failed'|'done' } | null>(null);
  const isDispatchingRef = useRef(false);

  // 1. Detect Plan Creation
  useEffect(() => {
    if (status !== 'ready' || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') {
      const toolInvocations = extractToolInvocations(lastMsg);
      const planTool = toolInvocations.find((t: any) => t.toolName === 'create_execution_plan');
      if (planTool) {
        const rawSteps = planTool.args?.execution_plan || planTool.input?.execution_plan || planTool.result?.execution_plan || planTool.args?.steps || planTool.input?.steps || planTool.result?.steps;
        if (Array.isArray(rawSteps) && rawSteps.length > 0) {

          const validSteps = rawSteps.filter((s: any) => s.target_tool !== 'none' && s.action_type !== 'none');
          const stepsToUse = validSteps.length > 0 ? validSteps : rawSteps;

          const planId = planTool.toolCallId || planTool.id || `plan-${messages.length}`;
          if (!engineState || engineState.status !== 'running') {

            // Automatically append a final JARVIS synthesis step (N+1) if not already present
            const hasFinalStep = stepsToUse.some((s: any) => s.action_type === 'final_response' || s.target_tool === 'final_response');
            const fullSteps = hasFinalStep ? stepsToUse : [
              ...stepsToUse,
              {
                step_id: stepsToUse.length + 1,
                action_type: 'final_response',
                target_tool: 'final_response',
                instruction: 'Berikan konfirmasi akhir dalam 1-2 kalimat percakapan yang alami, hangat, dan mengalir (tanpa poin-poin/bullet list, tanpa judul laporan, dan tanpa kata-kata meta). Langsung katakan konfirmasi hasil ke pengguna secara singkat.',
                requires_previous_context: true
              }
            ];

            setEngineState({
              planId,
              steps: fullSteps,
              currentIndex: 0,
              status: 'running'
            });
            isDispatchingRef.current = false;
          }
        }

      }
    }
  }, [messages, status, engineState]);

  // 2. Drive the Engine & Self-Healing
  useEffect(() => {
    if (engineState?.status === 'running' && status === 'ready' && !isDispatchingRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg) return;

      const lastText = extractText(lastMsg);
      // If we just sent a system command, wait for AI response
      if (lastMsg.role === 'user' && (lastText.includes("![SYSTEM_ENGINE]!") || lastText.includes("[SYSTEM_STEPPER]"))) return;

      if (lastMsg.role === 'assistant') {
        const toolInvocations = extractToolInvocations(lastMsg);

        // Check if AI mistakenly called create_execution_plan during a stepper step
        const calledPlanAgain = toolInvocations.some((t: any) => t.toolName === 'create_execution_plan');

        // Check for errors in action tools for self-healing
        const actionTools = toolInvocations.filter((t: any) => t.toolName !== 'create_execution_plan');
        const hadError = actionTools.some((t: any) => t.state === 'result' && (t.result?.success === false || t.result?.error));

        if (hadError) {
          isDispatchingRef.current = true;
          setEngineState(prev => prev ? { ...prev, status: 'failed' } : null);
          const healMsg = `[SYSTEM_STEPPER] Step ${engineState.currentIndex} encountered an error. Please review the tool output and attempt a self-healing alternative. If unrecoverable, notify the user.`;
          setTimeout(() => {
            (sendMessage as any)({ text: healMsg });
            setTimeout(() => { isDispatchingRef.current = false; }, 1000);
          }, 300);
          return;
        }

        // If AI called create_execution_plan again during stepper mode without running the step tool
        if (calledPlanAgain && engineState.currentIndex > 0) {
          const prevStepIndex = engineState.currentIndex - 1;
          const prevStep = engineState.steps[prevStepIndex];
          const prevTool = (prevStep?.target_tool || prevStep?.action_type || "").replace(/^functions\./, "").replace(/^tools?\./, "").trim();

          if (prevTool && prevTool !== "final_response" && prevTool !== "final_response_step") {
            // Re-enforce the step tool execution without advancing
            isDispatchingRef.current = true;
            const retryMsg = `[SYSTEM_STEPPER] CRITICAL REMINDER for Step ${prevStepIndex + 1}: DO NOT call create_execution_plan! You MUST execute the tool '${prevTool}' directly now. ${prevStep.instruction}`;
            setTimeout(() => {
              (sendMessage as any)({ text: retryMsg });
              setTimeout(() => { isDispatchingRef.current = false; }, 1000);
            }, 300);
            return;
          }
        }

        const step = engineState.steps[engineState.currentIndex];
        if (step) {
          const stepNum = step.step_id || (engineState.currentIndex + 1);
          const rawToolName = step.target_tool || step.action_type || "";
          const toolName = rawToolName.replace(/^functions\./, "").replace(/^tools?\./, "").trim();
          const instruction = step.instruction || (typeof step === "string" ? step : JSON.stringify(step));

          // Summarize previous assistant message text/tool outputs to pass as direct context
          let prevContextSummary = "";
          if (engineState.currentIndex > 0) {
            const prevText = extractText(lastMsg);
            const prevTools = extractToolInvocations(lastMsg).filter((t: any) => t.toolName !== 'create_execution_plan');
            const toolResults = prevTools.map((t: any) => {
              const res = t.output ?? t.result;
              return typeof res === "string" ? res : (res?.message || JSON.stringify(res || {}));
            }).join(" ");

            const combined = (prevText + " " + toolResults).replace(/\s+/g, " ").trim();
            if (combined) {
              prevContextSummary = combined.length > 350 ? combined.substring(0, 350) + "..." : combined;
            }
          }

          let stepMsg = `[SYSTEM_STEPPER] Langkah ${stepNum} dari ${engineState.steps.length}: ${instruction}`;
          if (toolName === "final_response" || toolName === "final_response_step") {
            stepMsg = `[SYSTEM_STEPPER] Langkah ${stepNum} dari ${engineState.steps.length} (LANGKAH TERAKHIR / SINTESIS HASIL): ${instruction}. JANGAN memanggil tool apa pun! Berikan konfirmasi hasil 1-2 kalimat percakapan yang alami dan ramah kepada pengguna secara langsung.`;
          } else if (toolName && toolName !== "tool_call" && toolName !== "reasoning") {
            stepMsg += ` (MUST use tool: ${toolName})`;
          }
          if (prevContextSummary) {
            stepMsg += ` [Data/Result dari Langkah Sebelumnya: "${prevContextSummary}"]`;
          }

          isDispatchingRef.current = true;
          setEngineState(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null);
          setTimeout(() => {
            (sendMessage as any)({ text: stepMsg });
            setTimeout(() => { isDispatchingRef.current = false; }, 1000);
          }, 300);
        } else {
          setEngineState(prev => prev ? { ...prev, status: 'done' } : null);
        }
      }
    }
  }, [engineState, status, messages, sendMessage]);
  // --- END ENGINE ---

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
          engineState={engineState}
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
  engineState,
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
  engineState: { planId: string, steps: any[], currentIndex: number, status: 'idle'|'running'|'failed'|'done' } | null;
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
              if (!textContent || textContent.includes("![SYSTEM_ENGINE]!") || textContent.includes("[SYSTEM_STEPPER]")) return [];
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
                  <div className="space-y-2 max-w-[85%] min-w-0 overflow-hidden">
                    {round.text && (
                      <div className="p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans text-xs shadow-md bg-white/[0.04] border border-white/10 text-slate-200 rounded-tl-none break-words overflow-hidden min-w-0 max-w-full">
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

                      if (toolNameDisplay === "create_execution_plan") {
                        const planSteps = args?.execution_plan || args?.steps || rawOutput?.execution_plan || rawOutput?.steps || [];
                        return (
                          <div key={callId} className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-slate-200 font-sans text-xs space-y-2 shadow-lg">
                            <div className="flex items-center gap-2 font-mono font-bold text-indigo-300 text-[11px] border-b border-indigo-500/20 pb-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Multi-Step Execution Plan ({planSteps.length} Steps)</span>
                            </div>
                            <div className="space-y-1.5 pt-1 font-mono text-[11px]">
                              {planSteps.map((s: any, idx: number) => {
                                const stepNum = s.step_id || (idx + 1);
                                const toolName = s.target_tool || s.action_type || "";
                                const instruction = s.instruction || (typeof s === "string" ? s : "");
                                return (
                                  <div key={idx} className="flex items-start gap-2 text-slate-300 bg-white/[0.03] p-2 rounded-xl border border-white/5">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] shrink-0 mt-0.5">
                                      Step {stepNum}
                                    </span>
                                    <div className="flex-1 space-y-0.5">
                                      <div className="text-slate-200 font-semibold">{instruction}</div>
                                      {toolName && <div className="text-[10px] text-indigo-400">Target Tool: <code className="bg-black/30 px-1 rounded text-indigo-300">{toolName}</code></div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
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
        {(() => {
          const isEngineActive = engineState?.status === 'running';
          const isBusy = isLoading || isEngineActive;
          if (!isBusy) return null;

          const currentStepNum = Math.min(Math.max(engineState?.currentIndex || 1, 1), engineState?.steps?.length || 1);
          const totalStepsNum = engineState?.steps?.length || 1;
          const loadingText = isEngineActive
            ? `Omni AI is executing Step ${currentStepNum} of ${totalStepsNum}...`
            : "Omni AI is analyzing...";

          return (
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 w-fit">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{loadingText}</span>
            </div>
          );
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMsg(); }} className="p-3 border-t border-white/10 bg-white/[0.01] flex flex-col gap-2 shrink-0">
        <div className="flex items-end gap-2">
          {(() => {
            const isEngineActive = engineState?.status === 'running';
            const isBusy = isLoading || isEngineActive;
            const currentStepNum = Math.min(Math.max(engineState?.currentIndex || 1, 1), engineState?.steps?.length || 1);
            const totalStepsNum = engineState?.steps?.length || 1;
            const placeholderText = isBusy
              ? `Omni AI is executing multi-step plan (Step ${currentStepNum}/${totalStepsNum})...`
              : "Ask Omni AI assistant... (Enter to send, Shift+Enter for new line)";

            return (
              <>
                <Textarea
                  ref={inputRef}
                  autoFocus
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!isBusy) sendMsg();
                    }
                  }}
                  placeholder="Ask Omni AI assistant... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl min-h-[44px] max-h-[140px] py-3 px-4 font-mono focus-visible:ring-indigo-500/40 resize-none scrollbar-thin"
                />
                <Button type="submit" disabled={isBusy || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 px-4 cursor-pointer shadow-lg shadow-indigo-600/30 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" />
                </Button>
              </>
            );

          })()}
        </div>
        <div className="flex items-center justify-between px-2 text-[10px] font-mono text-slate-500">
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Enter</kbd> send • <kbd className="px-1 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Ctrl+J</kbd> open • <kbd className="px-1 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300 font-bold">Ctrl+Shift+J</kbd> fullscreen</span>
          <span>{activeModel}</span>
        </div>
      </form>
    </>
  );
}
