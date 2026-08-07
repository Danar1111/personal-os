import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/db";
import { tasks, transactions, calendarEvents, systemSettings } from "@/db/schema";
import { desc } from "drizzle-orm";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // 1. Fetch settings & OpenAI API key from Laragon MySQL
    let activeModel = "gpt-4o-mini";
    let dbOpenaiKey = process.env.OPENAI_API_KEY;

    try {
      const dbSettings = await db.select().from(systemSettings);
      for (const item of dbSettings) {
        if (item.key === "active_model" && item.value) activeModel = item.value;
        if (
          item.key === "openai_key" &&
          item.value &&
          item.value.trim() !== "" &&
          !item.value.includes("your-openai-api-key")
        ) {
          dbOpenaiKey = item.value.trim();
        }
      }
    } catch (e) {
      console.warn("Using default briefing settings:", e);
    }

    const customOpenAI = createOpenAI({
      apiKey: dbOpenaiKey,
    });

    // 2. Fetch system context from local Laragon MySQL database
    const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    const allTransactions = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
    const allEvents = await db.select().from(calendarEvents).orderBy(desc(calendarEvents.startTime));

    const todoTasks = allTasks.filter((t) => t.status === "todo");
    const completedTasks = allTasks.filter((t) => t.status === "done");

    const totalIncome = allTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalExpense = allTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const contextSummary = `
SYSTEM CONTEXT DATA:
- Tasks Overview: ${todoTasks.length} pending todo tasks, ${completedTasks.length} completed tasks.
  Pending Task Titles: ${todoTasks.map((t) => `${t.title} [${t.priority}]`).join(", ") || "None"}
- Financial Overview: Total Income: $${totalIncome.toFixed(2)}, Total Expense: $${totalExpense.toFixed(2)}, Net Balance: $${(totalIncome - totalExpense).toFixed(2)}.
- Master Calendar Scheduled Events: ${allEvents.length} total events.
  Upcoming Events: ${allEvents.map((e) => `${e.title} (${e.eventType})`).join(", ") || "None"}
`;

    // 3. Stream AI Executive Briefing using customOpenAI instance
    const result = streamText({
      model: customOpenAI(activeModel as any),
      system:
        "You are the Personal OS Executive Intelligence Assistant. " +
        "Your task is to analyze the user's real-time system context data (tasks, finances, calendar) and stream a high-impact, motivational, executive morning briefing. " +
        "Structure the output in clean markdown with 4 sections: ☀️ Executive Overview, 🎯 Top Priority Focus, 📊 Financial Snapshot, and 📅 Schedule Roadmap.",
      prompt: `Generate the executive morning briefing based on this system context:\n${contextSummary}`,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Briefing generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
