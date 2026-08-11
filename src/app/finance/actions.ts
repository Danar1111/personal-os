"use server";

import { db } from "@/db";
import { transactions, systemSettings, assets, notes, Transaction, Asset, Note } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function getFinanceSummary() {
  try {
    const allTransactions = await db.select().from(transactions).orderBy(desc(transactions.date));
    const allAssets = await db.select().from(assets).orderBy(desc(assets.createdAt));
    const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt));

    let totalIncome = 0;
    let totalExpense = 0;

    allTransactions.forEach((tx) => {
      const numericAmount = parseFloat(tx.amount.toString()) || 0;
      if (tx.type === "income") {
        totalIncome += numericAmount;
      } else {
        totalExpense += numericAmount;
      }
    });

    const netBalance = totalIncome - totalExpense;

    return {
      transactions: allTransactions,
      totalIncome,
      totalExpense,
      netBalance,
      assets: allAssets,
      notes: allNotes,
    };
  } catch (error) {
    console.error("Failed to fetch finance summary:", error);
    return {
      transactions: [],
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
      assets: [],
      notes: [],
    };
  }
}

export async function analyzeMarketSentiment(query: string) {
  if (!query || !query.trim()) {
    return { success: false, missingKey: false, message: "Query string is required." };
  }

  try {
    const newsApiKey = process.env.NEWSAPI_KEY || process.env.GNEWS_API_KEY;
    if (!newsApiKey) {
      return {
        success: false,
        missingKey: true,
        message: "News API Key (NEWSAPI_KEY / GNEWS_API_KEY) is not configured in .env.",
      };
    }


    const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
      query.trim()
    )}&max=5&apikey=${newsApiKey}`;

    const newsRes = await fetch(gnewsUrl, { next: { revalidate: 1800 } });
    if (!newsRes.ok) {
      return {
        success: false,
        missingKey: false,
        message: `GNews API request failed with status ${newsRes.status}.`,
      };
    }

    const newsData = await newsRes.json();
    const articles = (newsData?.articles || []).map((a: any) => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      source: a.source?.name || "News",
      publishedAt: a.publishedAt,
    }));

    if (articles.length === 0) {
      return {
        success: true,
        query,
        sentiment: "NEUTRAL" as const,
        summary: `No recent news articles found for "${query}". Market sentiment is neutral due to lack of news signals.`,
        articlesCount: 0,
        articles: [],
      };
    }

    const headlinesText = articles
      .map((a: any, i: number) => `${i + 1}. ${a.title} - ${a.description}`)
      .join("\n");

    const openaiKey = process.env.OPENAI_API_KEY;
    const settings = await db.select().from(systemSettings);
    let activeModel = "gpt-4o-mini";
    for (const s of settings) {
      if (s.key === "active_model" && s.value?.trim()) activeModel = s.value.trim();
    }


    if (!openaiKey) {
      return {
        success: true,
        query,
        sentiment: "BULLISH" as const,
        summary: `Found ${articles.length} news articles regarding ${query}. AI API Key not set for detailed LLM synthesis, showing raw article feed.`,
        articlesCount: articles.length,
        articles,
      };
    }

    const customOpenAI = createOpenAI({ apiKey: openaiKey });
    const prompt = `Analyze the sentiment of these recent news headlines about "${query}":

${headlinesText}

Task:
1. Classify the overall market sentiment as exactly one word: BULLISH, BEARISH, or NEUTRAL.
2. Provide a concise 2-sentence summary of the market sentiment explaining why.
If the input query or headlines are in Indonesian, provide the 2-sentence summary in Indonesian; otherwise in English.

Format your response strictly as:
SENTIMENT: [BULLISH | BEARISH | NEUTRAL]
SUMMARY: [2-sentence summary]`;

    const { text } = await generateText({
      model: customOpenAI(activeModel as any),
      prompt,
    });

    let sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (text.includes("BULLISH")) sentiment = "BULLISH";
    else if (text.includes("BEARISH")) sentiment = "BEARISH";

    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : text.trim();

    return {
      success: true,
      query,
      sentiment,
      summary,
      articlesCount: articles.length,
      articles,
    };
  } catch (error: any) {
    console.error("[analyzeMarketSentiment error]:", error);
    return {
      success: false,
      missingKey: false,
      message: error.message || "Failed to analyze market sentiment",
    };
  }
}

export async function createTransactionAction(data: {
  type: "income" | "expense";
  amount: number;
  category: string;
  description?: string;
  date?: string;
}) {
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  await db.insert(transactions).values({
    type: data.type,
    amount: data.amount.toFixed(2),
    category: data.category.trim() || "General",
    description: data.description?.trim() || null,
    date: data.date ? new Date(data.date) : new Date(),
  });

  revalidatePath("/finance");
  revalidatePath("/");
  return { success: true };
}

export async function deleteTransactionAction(id: number) {
  await db.delete(transactions).where(eq(transactions.id, id));

  revalidatePath("/finance");
  revalidatePath("/");
  return { success: true };
}

export async function updateTransactionAction(
  id: number,
  data: {
    type?: "income" | "expense";
    amount?: number;
    category?: string;
    description?: string;
    date?: string;
  }
) {
  const updateData: any = {};
  if (data.type) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2);
  if (data.category) updateData.category = data.category.trim();
  if (data.description !== undefined) updateData.description = data.description.trim() || null;
  if (data.date) updateData.date = new Date(data.date);

  await db.update(transactions).set(updateData).where(eq(transactions.id, id));

  revalidatePath("/finance");
  revalidatePath("/");
  return { success: true };
}

async function seedDefaultFinanceData() {
  await db.insert(transactions).values([
    {
      type: "income",
      amount: "5200.00",
      category: "Salary / Retainer",
      description: "Monthly Software Engineering Retainer",
      date: new Date("2026-07-01"),
    },
    {
      type: "income",
      amount: "1000.00",
      category: "Freelance",
      description: "Next.js Consulting Milestone",
      date: new Date("2026-07-10"),
    },
    {
      type: "expense",
      amount: "340.00",
      category: "Cloud Infrastructure",
      description: "Laragon Local VPS & Vercel Pro Hosting",
      date: new Date("2026-07-12"),
    },
    {
      type: "expense",
      amount: "185.00",
      category: "AI API Credits",
      description: "OpenAI & Anthropic API Credits",
      date: new Date("2026-07-15"),
    },
    {
      type: "expense",
      amount: "450.00",
      category: "Equipment",
      description: "Mechanical Keyboard & Monitor Stand",
      date: new Date("2026-07-20"),
    },
  ]);
}
