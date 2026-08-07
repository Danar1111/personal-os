import React, { Suspense } from "react";
import { getFinanceSummary } from "./actions";
import { FinanceManager } from "@/components/finance-manager";
import { MarketDashboard } from "@/components/finance/market-dashboard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, Activity, Receipt, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0; // Live DB data fetching for Personal Ledger

async function fetchUsdIdrRate() {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.IDR || 16250;
      return new Intl.NumberFormat("id-ID").format(Math.round(rate));
    }
  } catch (e) {
    console.error("USD/IDR fetch error:", e);
  }
  return "16.250";
}

function MarketSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-3">
            <div className="w-20 h-4 bg-white/10 rounded" />
            <div className="w-28 h-7 bg-white/10 rounded" />
            <div className="w-full h-3 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-3xl bg-white/[0.03] border border-white/10 p-6" />
    </div>
  );
}

export default async function FinancePage() {
  const {
    transactions: initialTransactions,
    totalIncome,
    totalExpense,
    netBalance,
    assets: initialAssets,
    notes: initialNotes,
  } = await getFinanceSummary();
  const usdRate = await fetchUsdIdrRate();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3 font-mono">
            <Wallet className="w-7 h-7 text-indigo-400" />
            <span>FINANCE CONTROL CENTER</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Market-First Equities Dashboard • Personal Ledger &amp; Drizzle ORM Sync
          </p>
        </div>

        {/* Top Right: USD / IDR Exchange Rate Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 shadow-md">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">USD / IDR:</span>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/20 font-mono text-xs font-bold px-2 py-0.5">
              1 USD = Rp {usdRate}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs Layout: Market Overview (Default) vs Personal Ledger */}
      <Tabs defaultValue="market">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="market">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Market Overview</span>
            </TabsTrigger>
            <TabsTrigger value="ledger">
              <Receipt className="w-3.5 h-3.5 text-purple-400" />
              <span>Personal Ledger</span>
            </TabsTrigger>
          </TabsList>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
            Yahoo Finance &amp; GNews Real-time Feed
          </span>
        </div>

        {/* Tab 1: Market Overview (Default) */}
        <TabsContent value="market" className="pt-2">
          <Suspense fallback={<MarketSkeleton />}>
            <MarketDashboard />
          </Suspense>
        </TabsContent>

        {/* Tab 2: Personal Ledger */}
        <TabsContent value="ledger" className="pt-2">
          <FinanceManager
            initialTransactions={initialTransactions}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            netBalance={netBalance}
            initialAssets={initialAssets}
            initialNotes={initialNotes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
