"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { Sparkles, RotateCcw, ChevronRight, Quote as QuoteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  getMotivationalQuotesBatchAction,
  MotivationalQuote,
} from "@/app/actions/motivational-quotes";

const STORAGE_KEY = "personal_os_quotes_batch_v2";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours batch freshness

interface CachedQuotesState {
  quotes: MotivationalQuote[];
  currentIndex: number;
  lastFetched: number;
  source: string;
}

// Initial instant quote for instant render (0ms delay, zero layout shift)
const INITIAL_INSTANT_QUOTE: MotivationalQuote = {
  quote: "Jadilah mata air yang jernih, yang memberikan kehidupan kepada sekitarmu.",
  translation: "Jadilah pribadi yang bersih hatinya dan memberi manfaat nyata bagi kehidupan orang-orang di sekitarmu.",
  author: "B.J. Habibie",
  tag: "WISDOM",
};

export function MotivationalQuoteWidget() {
  const [currentQuote, setCurrentQuote] = useState<MotivationalQuote>(INITIAL_INSTANT_QUOTE);
  const [isFading, setIsFading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Advance to next quote in the cached batch
  const advanceToNext = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const cached: CachedQuotesState = JSON.parse(raw);
      if (!cached.quotes || cached.quotes.length === 0) return;

      setIsFading(true);
      setTimeout(() => {
        const nextIndex = (cached.currentIndex + 1) % cached.quotes.length;
        const nextQuote = cached.quotes[nextIndex];
        cached.currentIndex = nextIndex;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
        setCurrentQuote(nextQuote);
        setIsFading(false);
      }, 150);
    } catch {
      // ignore
    }
  }, []);

  // Fetch a brand new batch from AI / Web Search
  const fetchNewBatch = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);

    try {
      const res = await getMotivationalQuotesBatchAction();
      if (res.success && res.quotes.length > 0) {
        let newIndex = 0;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const prev: CachedQuotesState = JSON.parse(raw);
            newIndex = manual ? 0 : (prev.currentIndex + 1) % res.quotes.length;
          }
        } catch {
          // ignore
        }

        const newState: CachedQuotesState = {
          quotes: res.quotes,
          currentIndex: newIndex,
          lastFetched: Date.now(),
          source: res.source,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

        setIsFading(true);
        setTimeout(() => {
          setCurrentQuote(res.quotes[newIndex]);
          setIsFading(false);
        }, 150);
      }
    } catch (e) {
      console.warn("[MotivationalQuoteWidget] Fetch batch error:", e);
    } finally {
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached: CachedQuotesState = JSON.parse(raw);
        if (cached.quotes && cached.quotes.length > 0) {
          // Advance smoothly to next quote so each reload gives a fresh one
          const nextIndex = (cached.currentIndex + 1) % cached.quotes.length;
          cached.currentIndex = nextIndex;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
          setCurrentQuote(cached.quotes[nextIndex]);

          // Quietly re-fetch if cache is older than 12h
          if (Date.now() - cached.lastFetched > CACHE_TTL_MS) {
            fetchNewBatch(false);
          }
          return;
        }
      }
    } catch {
      // ignore
    }

    // If no cache, fetch initial batch
    fetchNewBatch(false);
  }, [fetchNewBatch]);

  // Subtle auto-cycle set to 2 minutes (120 seconds) for comfortable, unhurried reading
  useEffect(() => {
    const timer = setInterval(() => {
      advanceToNext();
    }, 120000);
    return () => clearInterval(timer);
  }, [advanceToNext]);

  return (
    <div
      className="relative shrink-0 w-full sm:w-[560px] md:w-[580px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "group/quote relative flex items-center gap-2.5 h-[52px] px-3.5 rounded-2xl",
          "bg-white/[0.03] hover:bg-white/[0.06] border border-purple-500/25 hover:border-purple-500/50",
          "shadow-sm hover:shadow-purple-500/10 transition-all duration-300",
          "cursor-pointer select-none w-full",
          "backdrop-blur-md overflow-hidden"
        )}
        onClick={advanceToNext}
      >
        {/* Subtle Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent pointer-events-none opacity-50 group-hover/quote:opacity-100 transition-opacity rounded-2xl" />

        {/* Left Icon & Tag */}
        <div className="shrink-0 flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 group-hover/quote:text-purple-300 border border-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 animate-pulse" />
          </div>
          {currentQuote.tag && (
            <Badge
              variant="outline"
              className="hidden sm:inline-flex shrink-0 text-[8.5px] font-mono font-bold tracking-wider px-1.5 py-0.5 border-purple-500/30 text-purple-300 bg-purple-500/10 uppercase"
            >
              {currentQuote.tag}
            </Badge>
          )}
        </div>

        {/* Quote Text & Author (Default 2-line clean container, stable height) */}
        <div
          className={cn(
            "min-w-0 flex-1 flex flex-col justify-center transition-opacity duration-200",
            isFading ? "opacity-0" : "opacity-100"
          )}
        >
          <p className="text-[11.5px] leading-[1.35] text-slate-200 font-sans italic line-clamp-2">
            &ldquo;{currentQuote.quote}&rdquo;{" "}
            <span className="text-[10px] text-purple-300/90 font-mono font-semibold not-italic whitespace-nowrap">
              — {currentQuote.author}
            </span>
          </p>
        </div>

        {/* Action Controls: Next & Manual AI Refresh */}
        <div
          className="flex items-center gap-1 shrink-0 ml-1 text-slate-400"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Next Quote Button */}
          <button
            type="button"
            onClick={advanceToNext}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-slate-400"
            title="Next quote"
          >
            <ChevronRight className="w-3.5 h-3.5 group-hover/quote:translate-x-0.5 transition-transform" />
          </button>

          {/* Manual Refresh from AI / Web Batch */}
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => fetchNewBatch(true)}
            className={cn(
              "p-1.5 rounded-lg hover:bg-purple-500/20 hover:text-purple-300 transition-colors cursor-pointer text-slate-400",
              isRefreshing && "text-purple-400"
            )}
            title="Fetch new batch"
          >
            <RotateCcw
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                isRefreshing && "animate-spin text-purple-400"
              )}
            />
          </button>
        </div>
      </div>

      {/* Custom Floating Glass Tooltip on Hover (Kata-kata & Terjemahan Bahasa Indonesia Saja) */}
      {isHovered && (
        <div className="absolute top-full mt-2 right-0 z-[100] w-full sm:w-[500px] p-3.5 rounded-2xl bg-[#0c0c16]/95 border border-purple-500/40 shadow-2xl backdrop-blur-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/10 space-y-2.5">
          {/* Original Quote Words */}
          <div className="space-y-1">
            <p className="text-xs text-slate-100 font-sans italic leading-relaxed">
              &ldquo;{currentQuote.quote}&rdquo;
            </p>
            <p className="text-[10.5px] text-purple-300 font-mono font-semibold text-right">
              — {currentQuote.author}
            </p>
          </div>

          {/* Indonesian Translation / Arti */}
          {currentQuote.translation && currentQuote.translation !== currentQuote.quote && (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <div className="text-[9.5px] font-mono uppercase tracking-wider text-purple-300 font-bold">
                Arti (Bahasa Indonesia):
              </div>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                {currentQuote.translation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
