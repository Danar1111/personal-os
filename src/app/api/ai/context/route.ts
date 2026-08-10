import { NextResponse } from "next/server";
import { db } from "@/db";
import { knowledgeVault } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch only non-sensitive entries to prevent accidental LLM data leaks
    const entries = await db
      .select()
      .from(knowledgeVault)
      .where(eq(knowledgeVault.isSensitive, false))
      .orderBy(desc(knowledgeVault.createdAt));

    // Group entries by category
    const grouped: Record<string, typeof entries> = {};
    for (const item of entries) {
      const cat = item.category || "General";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    // Build structured context string
    const lines: string[] = [];
    lines.push("=== USER PERSONAL KNOWLEDGE VAULT CONTEXT ===");

    if (entries.length === 0) {
      lines.push("No non-sensitive knowledge vault entries configured.");
    } else {
      for (const [category, items] of Object.entries(grouped)) {
        lines.push(`\n[Category: ${category}]`);
        for (const item of items) {
          lines.push(`• ${item.title}: ${item.content}`);
        }
      }
    }

    lines.push("\n=== END KNOWLEDGE VAULT CONTEXT ===");
    const contextString = lines.join("\n");

    return NextResponse.json({
      success: true,
      count: entries.length,
      contextString,
      entries,
    });
  } catch (error: any) {
    console.error("[API_AI_CONTEXT] Error fetching knowledge context:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch AI knowledge context.",
      },
      { status: 500 }
    );
  }
}
