import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import YahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

export async function GET() {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // 1. Check DB Settings Keys
  try {
    const settingsRows = await db.select().from(systemSettings);
    const keysFound = settingsRows.map((s) => ({
      key: s.key,
      hasValue: Boolean(s.value && s.value.trim()),
      preview: s.value ? `${s.value.trim().slice(0, 4)}...${s.value.trim().slice(-4)}` : "EMPTY",
    }));
    report.dbSettings = { success: true, totalKeys: keysFound.length, keysFound };
  } catch (err: any) {
    report.dbSettings = { success: false, error: err?.message || String(err) };
  }

  // 2. Check TMDB API
  try {
    const [tmdbRow] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "tmdb_api_key"));
    const tmdbKey = tmdbRow?.value?.trim();

    if (!tmdbKey) {
      report.tmdbApi = { status: "SKIPPED", reason: "tmdb_api_key is empty or missing in system_settings table." };
    } else {
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      const text = await res.text();
      report.tmdbApi = {
        httpStatus: res.status,
        statusText: res.statusText,
        ok: res.ok,
        sampleResponse: text.slice(0, 300),
      };
    }
  } catch (err: any) {
    report.tmdbApi = { status: "ERROR", error: err?.message || String(err) };
  }

  // 3. Check News API (GNews / NewsAPI)
  try {
    const [newsRow] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "newsapi_key"));
    const newsKey = newsRow?.value?.trim();

    if (!newsKey) {
      report.newsApi = { status: "SKIPPED", reason: "newsapi_key is empty or missing in system_settings table." };
    } else {
      const res = await fetch(
        `https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=3&apikey=${newsKey}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      const text = await res.text();
      report.newsApi = {
        httpStatus: res.status,
        statusText: res.statusText,
        ok: res.ok,
        sampleResponse: text.slice(0, 300),
      };
    }
  } catch (err: any) {
    report.newsApi = { status: "ERROR", error: err?.message || String(err) };
  }

  // 4. Check Stock API (Yahoo Finance)
  try {
    const yahooFinance = new YahooFinance({
      suppressNotices: ["yahooSurvey"],
      fetchOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      },
    });
    const quote: any = await yahooFinance.quote("AAPL");
    report.stockYahooApi = {
      ok: Boolean(quote && quote.regularMarketPrice),
      symbol: quote?.symbol || "AAPL",
      price: quote?.regularMarketPrice || 0,
    };
  } catch (err: any) {
    report.stockYahooApi = { ok: false, error: err?.message || String(err) };
  }

  // 5. Check Forex API
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { cache: "no-store" });
    const data = await res.json();
    report.forexApi = { ok: res.ok, usdIdr: data?.rates?.IDR };
  } catch (err: any) {
    report.forexApi = { ok: false, error: err?.message || String(err) };
  }

  return NextResponse.json(report);
}
