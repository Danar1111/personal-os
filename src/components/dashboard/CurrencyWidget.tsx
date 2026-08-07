import React from "react";
import { DollarSign, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

async function fetchCurrencyRates() {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const usdIdr = data?.rates?.IDR || 16250;
    const eur = data?.rates?.EUR || 0.92;
    const gbp = data?.rates?.GBP || 0.78;
    const sgd = data?.rates?.SGD || 1.34;
    const aud = data?.rates?.AUD || 1.52;
    const jpy = data?.rates?.JPY || 155;
    const cny = data?.rates?.CNY || 7.25;

    return {
      usdIdr,
      eurIdr: usdIdr / eur,
      gbpIdr: usdIdr / gbp,
      sgdIdr: usdIdr / sgd,
      audIdr: usdIdr / aud,
      jpyIdr: usdIdr / jpy,
      cnyIdr: usdIdr / cny,
      date: data?.date || new Date().toISOString().split("T")[0],
    };
  } catch (error) {
    console.error("[CurrencyWidget fetch error]:", error);
    return {
      usdIdr: 16250,
      eurIdr: 17650,
      gbpIdr: 20750,
      sgdIdr: 12150,
      audIdr: 10650,
      jpyIdr: 105.5,
      cnyIdr: 2240,
      date: "Fallback",
    };
  }
}

export async function CurrencyWidget() {
  const { usdIdr, eurIdr, gbpIdr, sgdIdr, audIdr, jpyIdr, cnyIdr, date } =
    await fetchCurrencyRates();

  const fmt = (num: number, decimals = 0) =>
    new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);

  const extraPairs = [
    { pair: "EUR / IDR", rate: `Rp ${fmt(eurIdr)}`, flag: "🇪🇺" },
    { pair: "GBP / IDR", rate: `Rp ${fmt(gbpIdr)}`, flag: "🇬🇧" },
    { pair: "SGD / IDR", rate: `Rp ${fmt(sgdIdr)}`, flag: "🇸🇬" },
    { pair: "AUD / IDR", rate: `Rp ${fmt(audIdr)}`, flag: "🇦🇺" },
    { pair: "JPY / IDR", rate: `Rp ${fmt(jpyIdr, 1)}`, flag: "🇯🇵" },
    { pair: "CNY / IDR", rate: `Rp ${fmt(cnyIdr)}`, flag: "🇨🇳" },
  ];

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col justify-between h-[495px] border border-white/10 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white font-mono tracking-wider uppercase truncate">
                EXCHANGE RATES
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Global Forex Pairs</p>
            </div>
          </div>

          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-mono text-[9px] px-1.5 py-0.5">
            LIVE
          </Badge>
        </div>

        {/* Primary Benchmark USD Rate */}
        <div className="my-2 space-y-0.5 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Primary Benchmark</span>
            <span className="text-emerald-400 font-bold">USD/IDR</span>
          </div>
          <div className="text-xs font-bold font-mono text-emerald-400">
            1 USD =
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            Rp {fmt(usdIdr)}
          </div>
        </div>

        {/* Multi-Pair Section (6 pairs filling remaining vertical space) */}
        <div className="mt-3 space-y-2">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Globe2 className="w-3 h-3 text-emerald-400" />
            <span>Multi-Pair Forex</span>
          </div>

          <div className="space-y-1.5">
            {extraPairs.map((p) => (
              <div
                key={p.pair}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-xs font-mono transition-colors"
              >
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span>{p.flag}</span>
                  <span className="font-semibold text-white">{p.pair}</span>
                </span>
                <span className="text-emerald-400 font-bold">{p.rate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-slate-400">
        <span>1H Revalidation</span>
        <span className="text-slate-500">{date}</span>
      </div>
    </div>
  );
}
