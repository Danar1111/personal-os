import React from "react";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { getPinnedTickers, fetchYahooStockQuotes } from "@/lib/actions/tickerActions";
import { eq } from "drizzle-orm";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Newspaper,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarketNewsListClient, MarketNewsArticle } from "./market-dashboard-client";
import { SentimentWidget } from "@/components/dashboard/SentimentWidget";
import { ManageTickersModal } from "@/components/dashboard/ManageTickersModal";
import { Sparkline } from "@/components/dashboard/Sparkline";

declare global {
  var marketNewsCache: { timestamp: number; articles: MarketNewsArticle[] } | undefined;
}

async function fetchMarketNews() {
  const ONE_HOUR = 3600 * 1000;
  if (globalThis.marketNewsCache && Date.now() - globalThis.marketNewsCache.timestamp < ONE_HOUR) {
    return globalThis.marketNewsCache.articles;
  }

  try {
    const apiKey = process.env.NEWSAPI_KEY || process.env.GNEWS_API_KEY;
    if (!apiKey) return [];


    const res = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=business&lang=en&max=6&apikey=${apiKey}`,
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
      const articles: MarketNewsArticle[] = (data?.articles || []).map((a: any) => ({
        title: a.title,
        description: a.description,
        url: a.url,
        image: a.image || a.urlToImage,
        source: { name: a.source?.name || "Business News" },
        publishedAt: a.publishedAt,
      }));

      if (articles.length > 0) {
        globalThis.marketNewsCache = { timestamp: Date.now(), articles };
      }
      return articles;
    }

    return globalThis.marketNewsCache?.articles || [];
  } catch (error) {
    console.error("[fetchMarketNews error]:", error);
    return globalThis.marketNewsCache?.articles || [];
  }
}

export async function MarketDashboard() {
  const pinned = await getPinnedTickers();
  const symbols = pinned.map((p) => p.symbol);
  const stocks = await fetchYahooStockQuotes(symbols);
  const newsArticles = await fetchMarketNews();

  const formatPrice = (val: number, currency: string) => {
    if (currency === "IDR" || currency === "Rp") {
      return `Rp ${val.toLocaleString("id-ID")}`;
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);
  };

  return (
    <div className="space-y-8">
      {/* Stock Tickers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-white tracking-wide uppercase flex items-center gap-2">
                LIVE GLOBAL &amp; LOCAL EQUITIES (7D TREND SPARK LINES)
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse glow-emerald"></span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Yahoo Finance API • Global Stocks, Crypto &amp; IDX (.JK)
              </p>
            </div>
          </div>

          <ManageTickersModal initialTickers={pinned} />
        </div>

        {stocks.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-white/[0.02] rounded-3xl border border-white/10 p-8">
            <Activity className="w-10 h-10 text-slate-500" />
            <p className="text-xs font-mono text-slate-400">No market tickers currently pinned.</p>
            <ManageTickersModal initialTickers={pinned} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stocks.map((stock) => {
              const isPositive = stock.change >= 0;
              const tvSymbol = stock.symbol.split(".")[0];

              if (stock.notFound) {
                return (
                  <div
                    key={stock.symbol}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 opacity-60 font-mono text-xs"
                  >
                    <div className="font-bold text-white tracking-wider">{stock.symbol}</div>
                    <div className="text-[10px] text-slate-400">Symbol Not Found / Off-Market</div>
                  </div>
                );
              }

              return (
                <a
                  key={stock.symbol}
                  href={`https://www.tradingview.com/symbols/${tvSymbol}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Click to view ${tvSymbol} TradingView Chart`}
                  className="p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-500/50 hover:ring-2 hover:ring-indigo-500/30 transition-all space-y-3 shadow-lg hover:-translate-y-1 group cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 mr-2">
                      <span className="text-sm font-bold font-mono text-white tracking-wider group-hover:text-indigo-300 transition-colors block truncate">
                        {stock.symbol}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block truncate max-w-[130px]">
                        {stock.name}
                      </span>
                    </div>

                    <div
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 border shrink-0 ${
                        isPositive
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      }`}
                    >
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>
                        {isPositive ? "+" : ""}
                        {stock.percentChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="my-1">
                    <div className="text-xl font-bold font-mono text-slate-100 tracking-tight truncate">
                      {formatPrice(stock.current, stock.currency)}
                    </div>
                    <div className={`text-xs font-mono ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                      {isPositive ? "+" : ""}
                      {stock.change.toFixed(2)} {stock.currency} Today
                    </div>
                  </div>

                  {/* 7D Sparkline Chart */}
                  {stock.sparkline && stock.sparkline.length > 1 && (
                    <div className="w-full h-11 my-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <Sparkline data={stock.sparkline} isPositive={isPositive} height={44} />
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 space-y-1 text-[10px] font-mono text-slate-400">
                    <div className="flex justify-between">
                      <span>Day High:</span>
                      <span className="text-slate-200">{formatPrice(stock.high, stock.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Day Low:</span>
                      <span className="text-slate-200">{formatPrice(stock.low, stock.currency)}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Universal Market Sentiment Analyzer (AI Core + GNews) */}
      <SentimentWidget />

      {/* Market News Section */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-white tracking-wide uppercase">
                GLOBAL BUSINESS &amp; MARKET NEWS
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Financial News • 1 Hour Cache Revalidation
              </p>
            </div>
          </div>

          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 font-mono text-xs py-1 px-3">
            {newsArticles.length} STORIES
          </Badge>
        </div>

        {newsArticles.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-slate-500 bg-white/[0.02] rounded-3xl border border-white/10">
            Configure News API key in Settings to unlock market news stories.
          </div>
        ) : (
          <MarketNewsListClient articles={newsArticles} />
        )}
      </div>
    </div>
  );
}
