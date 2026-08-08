"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Brain,
  Sparkles,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Settings,
  AlertCircle,
  Newspaper,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeMarketSentiment } from "@/app/finance/actions";

export function SentimentWidget() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);

    const res = await analyzeMarketSentiment(query);
    setResult(res);
    setIsLoading(false);
  };

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-6 space-y-5 border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-mono text-white tracking-wide uppercase flex items-center gap-2">
              UNIVERSAL MARKET SENTIMENT ANALYZER
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono">
                AI + GNews
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Real-time LLM Synthesis on Global &amp; Local Market Headlines
            </p>
          </div>
        </div>

        <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 text-xs font-mono py-1 px-3 self-start sm:self-auto">
          AI CORE ENGINE
        </Badge>
      </div>

      {/* Search Input Form */}
      <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any stock or topic (e.g. BBCA, NVDA, Crypto, Fed, Inflation, Tech)..."
            className="pl-10 pr-9 bg-white/[0.04] border-white/10 text-xs text-white placeholder:text-slate-500 rounded-xl h-11 focus:border-purple-500/50 font-mono"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs rounded-xl h-11 px-6 gap-2 shadow-lg shadow-purple-600/25 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300" />
          )}
          <span>{isLoading ? "AI Analyzing..." : "Analyze Sentiment"}</span>
        </Button>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 bg-white/[0.02] rounded-2xl border border-white/5 p-6">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <div className="space-y-1 font-mono">
            <p className="text-xs font-semibold text-white">🧠 AI Analyzing Market Headlines for &quot;{query}&quot;...</p>
            <p className="text-[11px] text-slate-400">Fetching global news feed &amp; executing sentiment classification</p>
          </div>
        </div>
      )}

      {/* Missing Key Warning */}
      {result && !result.success && result.missingKey && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{result.message}</span>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs font-mono text-amber-300 hover:text-white underline shrink-0"
          >
            <Settings className="w-3.5 h-3.5" /> Settings →
          </Link>
        </div>
      )}

      {/* Error Message */}
      {result && !result.success && !result.missingKey && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          {result.message}
        </div>
      )}

      {/* Analysis Result Container */}
      {result && result.success && (
        <div className="space-y-4 pt-2 animate-in fade-in-50 duration-300">
          {/* Sentiment Badge & Header */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono text-slate-400">Target Topic:</span>
              <Badge variant="outline" className="border-white/20 text-white font-mono text-xs px-2.5 py-0.5">
                {result.query}
              </Badge>
              <span className="text-[11px] font-mono text-slate-500">
                ({result.articlesCount} news sources analyzed)
              </span>
            </div>

            {/* Sentiment Pill */}
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border shadow-md ${
                result.sentiment === "BULLISH"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10"
                  : result.sentiment === "BEARISH"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
              }`}
            >
              {result.sentiment === "BULLISH" ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : result.sentiment === "BEARISH" ? (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              ) : (
                <Minus className="w-4 h-4 text-amber-400" />
              )}
              <span>SENTIMENT: {result.sentiment}</span>
            </div>
          </div>

          {/* AI Summary Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-900/20 via-indigo-900/15 to-slate-900/40 border border-purple-500/30 space-y-2 relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-purple-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI SYNTHESIS SUMMARY</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium">
              {result.summary}
            </p>
          </div>

          {/* Analyzed News Feed */}
          {result.articles && result.articles.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                <Newspaper className="w-3.5 h-3.5 text-slate-500" />
                <span>Analyzed News Articles ({result.articles.length})</span>
              </div>

              <div className="space-y-2">
                {result.articles.map((art: any, idx: number) => (
                  <a
                    key={idx}
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 transition-all flex items-center justify-between text-xs font-sans group"
                  >
                    <span className="text-slate-300 group-hover:text-purple-300 transition-colors line-clamp-1 flex-1 mr-3">
                      {art.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 flex items-center gap-1">
                      <span>{art.source}</span>
                      <ExternalLink className="w-3 h-3 text-purple-400 opacity-60 group-hover:opacity-100" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
