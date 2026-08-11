import React from "react";
import Link from "next/link";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Newspaper, Settings, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewsListClient, NewsArticle } from "./NewsListClient";

async function fetchNewsData() {
  try {
    const apiKey = process.env.NEWSAPI_KEY || process.env.GNEWS_API_KEY;
    if (!apiKey) {
      return { articles: [], missingKey: true };
    }


    // Try GNews API first
    let res = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=5&apikey=${apiKey}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const articles: NewsArticle[] = (data?.articles || []).map((a: any) => ({
        title: a.title,
        description: a.description,
        url: a.url,
        image: a.image || a.urlToImage,
        source: { name: a.source?.name || "Tech News" },
      }));
      return { articles, missingKey: false };
    }

    // Fallback to NewsAPI format
    res = await fetch(
      `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=5&apiKey=${apiKey}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const articles: NewsArticle[] = (data?.articles || []).map((a: any) => ({
        title: a.title,
        description: a.description,
        url: a.url,
        image: a.urlToImage || a.image,
        source: { name: a.source?.name || "News" },
      }));
      return { articles, missingKey: false };
    }

    return { articles: [], missingKey: false };
  } catch (error) {
    console.error("[NewsWidget fetch error]:", error);
    return { articles: [], missingKey: false };
  }
}

export async function NewsWidget() {
  const { articles, missingKey } = await fetchNewsData();

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col justify-between h-[495px] border border-white/10 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-mono tracking-wider uppercase">DAILY TECH NEWS</h3>
            <p className="text-[10px] text-slate-400 font-mono">Scroll for All Stories • 1H Revalidate</p>
          </div>
        </div>
        <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] font-mono">
          {articles.length} STORIES
        </Badge>
      </div>

      {/* Content */}
      {missingKey ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2.5 bg-white/[0.02] rounded-2xl border border-white/5 p-4 my-auto">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-white font-mono">News API Key Required</p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Configure your NewsAPI / GNews API key in System Settings to unlock tech news.
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 underline"
          >
            <Settings className="w-3 h-3 inline" /> Open Settings →
          </Link>
        </div>
      ) : articles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-xs font-mono text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5 my-auto">
          No news stories fetched at this time.
        </div>
      ) : (
        <NewsListClient articles={articles} />
      )}
    </div>
  );
}
