"use server";

import { db } from "@/db";
import { applications } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getApplications() {
  try {
    const apps = await db.select().from(applications).orderBy(desc(applications.createdAt));
    if (apps.length === 0) {
      return [
        { id: 1, name: "TradingView", url: "https://www.tradingview.com", iconName: "LineChart", category: "Markets", useFavicon: false },
        { id: 2, name: "GitHub", url: "https://github.com", iconName: "Code2", category: "Code", useFavicon: false },
        { id: 3, name: "ChatGPT AI", url: "https://chatgpt.com", iconName: "Bot", category: "AI", useFavicon: false },
        { id: 4, name: "Vercel", url: "https://vercel.com", iconName: "Zap", category: "Cloud", useFavicon: false },
        { id: 5, name: "Finance", url: "/finance", iconName: "Wallet", category: "System", useFavicon: false },
        { id: 6, name: "Movie Watchlist", url: "/watchlist", iconName: "Film", category: "Media", useFavicon: false },
        { id: 7, name: "Second Brain", url: "/vault", iconName: "Brain", category: "Vault", useFavicon: false },
        { id: 8, name: "Settings", url: "/settings", iconName: "Settings", category: "System", useFavicon: false },
      ];
    }
    return apps;
  } catch (error) {
    console.error("[getApplications error]:", error);
    return [
      { id: 1, name: "TradingView", url: "https://www.tradingview.com", iconName: "LineChart", category: "Markets", useFavicon: false },
      { id: 2, name: "GitHub", url: "https://github.com", iconName: "Code2", category: "Code", useFavicon: false },
      { id: 3, name: "ChatGPT AI", url: "https://chatgpt.com", iconName: "Bot", category: "AI", useFavicon: false },
      { id: 4, name: "Vercel", url: "https://vercel.com", iconName: "Zap", category: "Cloud", useFavicon: false },
      { id: 5, name: "Finance", url: "/finance", iconName: "Wallet", category: "System", useFavicon: false },
      { id: 6, name: "Movie Watchlist", url: "/watchlist", iconName: "Film", category: "Media", useFavicon: false },
      { id: 7, name: "Second Brain", url: "/vault", iconName: "Brain", category: "Vault", useFavicon: false },
      { id: 8, name: "Settings", url: "/settings", iconName: "Settings", category: "System", useFavicon: false },
    ];
  }
}
