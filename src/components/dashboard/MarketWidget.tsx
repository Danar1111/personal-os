import React from "react";
import { getPinnedTickers, fetchYahooStockQuotes } from "@/lib/actions/tickerActions";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { ManageTickersModal } from "./ManageTickersModal";
import { Sparkline } from "./Sparkline";

export async function MarketWidget() {
  const pinned = await getPinnedTickers();
  const symbols = pinned.map((p) => p.symbol);
  const stocks = await fetchYahooStockQuotes(symbols);

  const formatPrice = (val: number, currency: string) => {
    if (currency === "IDR" || currency === "Rp") {
      return `Rp ${val.toLocaleString("id-ID")}`;
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(val);
  };

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col h-full border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-mono tracking-wider">MARKET TRACKER</h3>
            <p className="text-[10px] text-slate-400 font-mono">Yahoo Finance • 7D Sparklines</p>
          </div>
        </div>

        <ManageTickersModal initialTickers={pinned} />
      </div>

      {/* Body */}
      {stocks.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-slate-500 bg-white/[0.02] rounded-xl border border-white/5 p-4 space-y-2 flex-1 flex flex-col items-center justify-center">
          <p>No market symbols currently pinned.</p>
          <ManageTickersModal initialTickers={pinned} />
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[360px] pr-1">
          {stocks.map((stock) => {
            const isPositive = stock.change >= 0;

            if (stock.notFound) {
              return (
                <div
                  key={stock.symbol}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between font-mono text-xs opacity-60"
                >
                  <div className="font-bold text-white">{stock.symbol}</div>
                  <div className="text-[10px] text-slate-400">Symbol Not Found / Off-Market</div>
                </div>
              );
            }

            const tvSymbol = stock.symbol.split(".")[0];

            return (
              <a
                key={stock.symbol}
                href={`https://www.tradingview.com/symbols/${tvSymbol}/`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Click to view ${tvSymbol} TradingView Chart`}
                className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-indigo-500/40 hover:ring-2 hover:ring-indigo-500/30 flex items-center justify-between font-mono transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex-1 mr-2 min-w-0 z-10">
                  <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 truncate">
                    <span className="shrink-0">{stock.symbol}</span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal truncate">
                      {stock.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    High: {formatPrice(stock.high, stock.currency)} | Low: {formatPrice(stock.low, stock.currency)}
                  </div>
                </div>

                {/* Sparkline trend chart in center/bg */}
                {stock.sparkline && stock.sparkline.length > 1 && (
                  <div className="w-20 sm:w-24 h-9 mx-2 z-10 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Sparkline data={stock.sparkline} isPositive={isPositive} height={36} />
                  </div>
                )}

                <div className="text-right shrink-0 z-10">
                  <div className="text-xs font-bold text-slate-100">{formatPrice(stock.current, stock.currency)}</div>
                  <div
                    className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${
                      isPositive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>
                      {isPositive ? "+" : ""}
                      {stock.change.toFixed(2)} ({isPositive ? "+" : ""}
                      {stock.percentChange.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
