"use server";

import { db } from "@/db";
import { pinnedTickers, PinnedTicker } from "@/db/schema";
import { eq, asc, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface StockQuoteData {
  symbol: string;
  name: string;
  current: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  currency: string;
  notFound?: boolean;
  sparkline: { close: number }[];
}

export async function getPinnedTickers(): Promise<PinnedTicker[]> {
  try {
    let rows = await db
      .select()
      .from(pinnedTickers)
      .orderBy(asc(pinnedTickers.sortOrder), asc(pinnedTickers.id));

    if (rows.length === 0) {
      const defaultSymbols = ["AAPL", "NVDA", "MSFT", "TSLA", "GOOGL"];
      let order = 0;
      for (const symbol of defaultSymbols) {
        await db
          .insert(pinnedTickers)
          .values({ symbol, sortOrder: order++ })
          .onDuplicateKeyUpdate({ set: { symbol } });
      }
      rows = await db
        .select()
        .from(pinnedTickers)
        .orderBy(asc(pinnedTickers.sortOrder), asc(pinnedTickers.id));
    }

    return rows;
  } catch (error) {
    console.error("[getPinnedTickers error]:", error);
    return [];
  }
}

export async function fetchYahooStockQuotes(symbols: string[]): Promise<StockQuoteData[]> {
  const results: StockQuoteData[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const sym of symbols) {
    if (!sym || !sym.trim()) continue;
    const cleanSym = sym.trim().toUpperCase();

    try {
      const q: any = await yahooFinance.quote(cleanSym);

      let sparkline: { close: number }[] = [];
      try {
        const chartRes: any = await yahooFinance.chart(cleanSym, {
          period1: sevenDaysAgo,
          interval: "1d",
        });
        if (chartRes && Array.isArray(chartRes.quotes)) {
          sparkline = chartRes.quotes
            .filter((item: any) => typeof item.close === "number" && !isNaN(item.close))
            .map((item: any) => ({ close: Number(item.close.toFixed(2)) }));
        }
      } catch (chartErr) {
        sparkline = [];
      }

      if (q && (typeof q.regularMarketPrice === "number" || typeof q.postMarketPrice === "number")) {
        const current = q.regularMarketPrice ?? q.postMarketPrice ?? 0;
        const change = q.regularMarketChange ?? 0;
        const rawPct = q.regularMarketChangePercent ?? 0;
        const percentChange = Math.abs(rawPct) < 1 && rawPct !== 0 && Math.abs(change) > 0.01 ? rawPct * 100 : rawPct;

        results.push({
          symbol: cleanSym,
          name: q.shortName || q.longName || q.displayName || cleanSym,
          current,
          change,
          percentChange,
          high: q.regularMarketDayHigh ?? current,
          low: q.regularMarketDayLow ?? current,
          currency: q.currency || (cleanSym.endsWith(".JK") ? "IDR" : "USD"),
          notFound: false,
          sparkline,
        });
      } else {
        results.push({
          symbol: cleanSym,
          name: cleanSym,
          current: 0,
          change: 0,
          percentChange: 0,
          high: 0,
          low: 0,
          currency: "USD",
          notFound: true,
          sparkline: [],
        });
      }
    } catch (err) {
      console.warn(`[yahooFinance.quote error] for ${cleanSym}:`, err);
      results.push({
        symbol: cleanSym,
        name: cleanSym,
        current: 0,
        change: 0,
        percentChange: 0,
        high: 0,
        low: 0,
        currency: "USD",
        notFound: true,
        sparkline: [],
      });
    }
  }

  return results;
}

export async function addTickerAction(rawSymbol: string) {
  if (!rawSymbol || !rawSymbol.trim()) {
    return { success: false, message: "Ticker symbol is required." };
  }

  const symbol = rawSymbol.trim().toUpperCase();

  const existing = await db
    .select()
    .from(pinnedTickers)
    .where(eq(pinnedTickers.symbol, symbol));

  if (existing.length > 0) {
    return { success: false, message: `Ticker "${symbol}" is already pinned!` };
  }

  try {
    const q: any = await yahooFinance.quote(symbol);
    if (!q || (typeof q.regularMarketPrice !== "number" && typeof q.postMarketPrice !== "number")) {
      return { success: false, message: `Symbol "${symbol}" not found or invalid on Yahoo Finance.` };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Symbol "${symbol}" not found or invalid on Yahoo Finance.`,
    };
  }

  try {
    const maxResult = await db.select({ maxOrder: max(pinnedTickers.sortOrder) }).from(pinnedTickers);
    const maxOrder = maxResult[0]?.maxOrder ?? 0;
    const newSortOrder = maxOrder + 1;

    await db.insert(pinnedTickers).values({ symbol, sortOrder: newSortOrder });

    revalidatePath("/finance");
    revalidatePath("/");
    return { success: true, message: `Ticker "${symbol}" validated & pinned successfully!` };
  } catch (error: any) {
    console.error("[addTickerAction error]:", error);
    return { success: false, message: error.message || "Failed to add ticker" };
  }
}

export async function removeTickerAction(id: number) {
  try {
    await db.delete(pinnedTickers).where(eq(pinnedTickers.id, id));

    revalidatePath("/finance");
    revalidatePath("/");
    return { success: true, message: "Ticker unpinned successfully!" };
  } catch (error: any) {
    console.error("[removeTickerAction error]:", error);
    return { success: false, message: error.message || "Failed to remove ticker" };
  }
}

export async function updateTickerOrderAction(orderedIds: number[]) {
  try {
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index];
      await db
        .update(pinnedTickers)
        .set({ sortOrder: index })
        .where(eq(pinnedTickers.id, id));
    }

    revalidatePath("/finance");
    revalidatePath("/");
    return { success: true, message: "Ticker order updated!" };
  } catch (error: any) {
    console.error("[updateTickerOrderAction error]:", error);
    return { success: false, message: error.message || "Failed to update ticker order" };
  }
}
