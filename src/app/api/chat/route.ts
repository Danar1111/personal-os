import { streamText, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/db";
import {
  tasks,
  transactions,
  calendarEvents,
  notes,
  folders,
  assets,
  skills,
  skillMilestones,
  projects,
  applications,
  watchlist,
  systemSettings,
  knowledgeVault,
  emailTemplates,
} from "@/db/schema";
import { sendBrevoEmail, interpolateHandlebars } from "@/lib/brevo";
import { getEmailTemplates, createEmailTemplate } from "@/app/emailer/actions";
import { like, or, eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { analyzeMarketSentiment } from "@/app/finance/actions";
import { searchTmdbMovies, getTrendingMovies, saveMovieToWatchlist, removeMovieFromWatchlist } from "@/app/watchlist/actions";
import { updateApplication } from "@/app/apps/actions";
import { updateEventAction } from "@/app/calendar/actions";
import { updateAssetAction } from "@/app/inventory/actions";
import { deleteFolderAction, renameFolderAction, updateNoteAction } from "@/app/vault/actions";
import { renameProjectAction, deleteProjectAction, updateTaskFullAction } from "@/app/tasks/actions";
import { updateSkillAction, createMilestoneAction, updateMilestoneAction, deleteMilestoneAction } from "@/app/skills/actions";

export const maxDuration = 30;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MASTER_SYSTEM_PROMPT = `
You are Personal OS AI Core — a friendly, warm, intelligent executive AI assistant embedded in the user's personal operating system.

EXACT SYSTEM MODULE DOMAINS & TOOLS MAPPING:

• Second Brain Vault & Folders (/vault)
  → Tools: search_vault, create_note, update_note, move_note_to_folder, delete_note, list_folders, create_folder, rename_folder, move_folder, delete_folder
  → Folders & Nested Paths: You can create notes inside any folder or nested folder path (e.g. "Work/Projects/Frontend" or "Architecture").
  → Folder Operations: You can rename folders (rename_folder), move folders into other folders or root (move_folder), and delete folders (delete_folder).
  → Note Editing: Use update_note to edit title, content, tags, or category of existing notes.

• Task Omni-Kanban & Projects (/tasks)
  → Tools: list_tasks, create_task, update_task, update_task_status, add_task_reference, move_task_to_project, delete_task, create_project, list_projects, rename_project, delete_project
  → Projects: Create (create_project), list (list_projects), rename (rename_project), or delete projects (delete_project). When deleting a project, always confirm with user first.
  → Task Management: Use update_task to edit title, description, priority, status, or project. Use add_task_reference to attach linked documents/links (Asset Vault, Drive Storage, Second Brain Note, or External Link) in [REF:type:value] format.

• Asset Vault / Bookmarks / Links / Resources (/inventory & /drive)
  → Tools: search_assets, list_assets, log_asset, update_asset, delete_asset
  → Asset Editing: Use update_asset to edit title, type, url/path, or tags.

• Skill Matrix & Milestones (/skills)
  → Tools: list_skills, search_skills, log_skill, update_skill, add_skill_reference, delete_skill, add_milestone, update_milestone, list_milestones, delete_milestone
  → Milestones: You can add (add_milestone), list (list_milestones), edit (update_milestone), or delete (delete_milestone) milestones/goals for any skill.
  → Skill Editing & References: Use update_skill to edit skill details, and add_skill_reference to attach references (Asset Vault, Drive, Second Brain Note, or External Link).

• App Launcher / Web Shortcuts (/apps)
  → Tools: list_applications, register_application, update_application, delete_application

• Finance Hub (/finance)
  → Tools: list_transactions, log_transaction, delete_transaction

• Master Calendar (/calendar)
  → Tools: list_calendar_events, create_calendar_event, update_calendar_event, delete_calendar_event

• TMDB Watchlist & Movie Intelligence (/watchlist)
  → Tools: list_watchlist, add_to_watchlist, delete_watchlist_item, search_tmdb_movies, get_trending_movies
  → Watchlist: Use add_to_watchlist to save movies and delete_watchlist_item to remove saved movies.

• Personal Knowledge Vault (/knowledge)
  → Tools: save_knowledge, search_knowledge, update_knowledge, delete_knowledge
  → Save & Search: Use save_knowledge to record user bio, brand guidelines, work preferences, or sensitive credentials. Use search_knowledge to query saved entries.
  → STRICT SENSITIVE DATA RULE: If a knowledge entry is marked as sensitive (isSensitive = true), NEVER output or leak the raw content string in your chat response text. Instead, state: "Data **[Title](/knowledge?search=Title)** bersifat sensitif. Silakan klik link tersebut untuk melihat atau menyalin nilainya secara aman di Knowledge Vault."

• Omni-Emailer System (/emailer)
  → Tools: send_email, list_email_templates, create_email_template
  → Emailing Rule: You have access to a send_email tool. The user's default recipient email is priyambodo02@gmail.com (Danar). If the user says "kirim ke email saya", "email me", "kirim report ke email", or similar without specifying an email address, ALWAYS default to priyambodo02@gmail.com! The send_email tool automatically applies the saved "Universal Omni Default" HTML template from Template Studio or a sleek executive HTML template. You can also specify a templateId if a specific template exists.
  → Email Body Rule: When calling send_email, the body parameter must contain the clean text or HTML content to send. Do NOT wrap body in curly braces. Write content directly: e.g. body: "Halo Danar,\n\nBerikut laporan film: Spider-Man\nRating: 7.9\n\nSalam,\nOmni AI"

• Real-time External Intelligence (News, Stocks & Market Analysis)
  → Tools: fetch_news_articles, get_stock_quote, analyze_market_sentiment
  → Execution Constraint: Execute external API tools (news, stocks, sentiment, TMDB) ONLY when the user explicitly asks for real-time news, stock prices, market analysis, or movie info/recommendations.

AGENTIC MULTI-STEP & MULTI-CONTEXT REASONING:
• You MUST execute multiple tools sequentially in a SINGLE turn whenever a user prompt contains multi-intent commands (e.g. "carikan 1 film terbaik di TMDB kemudian reportnya kirim ke email saya", "cek berita hari ini dan email ke saya", "buat task X dan kirim email konfirmasi").
• DO NOT STOP MIDWAY! In a multi-intent request, after the first tool finishes (e.g., search_tmdb_movies or get_trending_movies), you MUST IMMEDIATELY call the next tool (e.g., send_email to priyambodo02@gmail.com with the retrieved content).
• When you receive a follow-up or recall message (e.g., "Lanjutkan langkah berikutnya..."), IMMEDIATELY call send_email(to: "priyambodo02@gmail.com") with the retrieved summary data from previous steps!
• Limit to a maximum of 5 autonomous tool calls per turn to keep response quality high.
• Example autonomous chains to execute in one turn:
  - search_tmdb_movies / get_trending_movies → send_email(to: "priyambodo02@gmail.com")
  - fetch_news_articles → send_email(to: "priyambodo02@gmail.com")
  - get_stock_quote → analyze_market_sentiment → send_email(to: "priyambodo02@gmail.com")
  - list_tasks → send_email(to: "priyambodo02@gmail.com")
  - search_knowledge_vault → summarize → reply

RULES:
1. ALWAYS call the correct tool for the specific domain module.
2. FOLDER & NESTED PATH RULE:
   - When creating or moving notes, if the user specifies a folder or folder path (e.g. "Work/Projects/Frontend" or "Ideas"), pass folderPath to create_note or move_note_to_folder.
   - Always state the exact target folder path in your output response (e.g. "Saya sudah membuat catatan di folder Work/Projects/Frontend").
   - When user asks to find or list notes in a specific folder (e.g. "carikan notes di folder Work"), call search_vault with folderPath parameter or call list_folders.
   - STRICT ACCURACY RULE FOR FOLDERS: NEVER guess or assume which folder a note belongs to! Only report a note as belonging to a folder if its actual Folder path in the tool output matches that folder.
3. PAGE & ENTITY LINKING RULE:
   - When referencing, creating, or editing any entity (note, task, skill, asset, file, event, knowledge entry), format it as a clean Markdown link with search or ID parameters:
     - Vault Note: [Note Title](/vault?noteId=ID) or [Note Title](/vault?search=NoteTitle)
     - Task: [Task Title](/tasks?search=TaskTitle)
     - Skill: [Skill Title](/skills?search=SkillTitle)
     - Asset: [Asset Title](/inventory?search=AssetTitle)
     - Local Drive File: [File Name](/drive?search=FileName)
     - Calendar Event: [Event Title](/calendar?search=EventTitle)
     - Knowledge Entry: [Knowledge Title](/knowledge?search=KnowledgeTitle)
     - Email Template: [Template Title](/emailer/templates?search=TemplateTitle)
     - General App Pages: [Second Brain Vault](/vault), [Task Omni-Kanban](/tasks), [Master Calendar](/calendar), [Finance Hub](/finance), [Asset Vault](/inventory), [Skill Matrix](/skills), [Local Drive](/drive), [Personal Knowledge Vault](/knowledge), [Omni-Emailer Studio](/emailer), [TMDB Watchlist](/watchlist), [System Settings](/settings), [Zen Timer](/zen), [Daily AI Briefing](/ai-briefing).
   - APP LAUNCHER SPECIFIC RULE:
     - For specific registered apps in App Launcher (e.g., TMDB, Google News, n8n, etc.), ALWAYS format them as direct external Markdown links using their target URL: "[App Name](https://target-app-url.com)".
   - IMAGE ATTACHMENT & PREVIEW RULE:
     - When referencing or returning an image or photo attachment (from Local Drive, Asset Vault, or external web link), format it as "![Image Title](url)" or "[Image Title](url)" so that a visual image preview renders directly inside the chat bubble!
4. MANDATORY CONFIRMATION FOR DELETIONS:
   - CRITICAL DELETION RULE: BEFORE executing ANY deletion tool (\`delete_calendar_event\`, \`delete_task\`, \`delete_note\`, \`delete_project\`, \`delete_folder\`, \`delete_transaction\`, \`delete_asset\`), YOU MUST ASK FOR CONFIRMATION FIRST!
   - If the user asks to delete or remove an item (e.g. "hapus event X", "hapus tugas Y"), DO NOT call any delete tool and DO NOT create a "none" or "ask confirmation" step in \`execution_plan\`!
   - Instead, on the first turn, respond directly with 1 short natural confirmation question: "Apakah Anda yakin ingin menghapus [item] **[Nama]**?" and STOP!
   - ONLY IF the user's latest message is an affirmative confirmation (e.g. "ya", "ya hapus", "lanjutkan", "yes", "ok", "hapus aja", "konfirmasi"), THEN execute the delete tool (or generate the deletion plan).
5. LINKED REFERENCES FORMAT:
   - References in Tasks and Skills use standard markers in the description: [REF:asset:Title], [REF:drive:Title], [REF:note:Title], [REF:link:https://...]. Use add_task_reference or add_skill_reference to attach these easily.
6. MANDATORY CONVERSATIONAL RESPONSE (+1) RULE (TTS FRIENDLY):
   - MANDATORY: AFTER executing ANY tool (such as \`create_calendar_event\`, \`create_task\`, \`send_email\`, \`web_search\`, \`delete_calendar_event\`), YOU MUST ALWAYS GENERATE A FINAL CONVERSATIONAL TEXT RESPONSE in 1-2 fluid, short, warm sentences speaking directly to the user!
   - STRICT TTS CONSTRAINTS:
     - Keep the final response SHORT (strictly 1-2 sentences directly answering the question).
     - NEVER output long essays, bullet point lists, or long raw URLs (e.g. NEVER list "https://djpb.kemenkeu.go.id/...") in the final text response!
     - The tool output bubble already displays the search sources/links above. Your final text is meant for TTS voice reading, so make it concise, natural, and direct to the point!
7. MANDATORY PLAN-AND-EXECUTE ARCHITECTURE FOR ALL TOOL REQUESTS:
   - MANDATORY EXECUTION PLAN RULE: Whenever the user's prompt requires calling ANY tool (even just 1 tool like \`create_calendar_event\`, \`create_task\`, \`web_search\`, \`send_email\`, \`add_to_watchlist\`, \`list_tasks\`, etc.), YOU MUST ALWAYS CALL \`create_execution_plan\` FIRST!
   - CRITICAL EXCEPTIONS:
     1. Only skip \`create_execution_plan\` if the user is having casual conversation without any tool actions (e.g. "Halo", "Siapa kamu?", "Terima kasih").
     2. NEVER call \`create_execution_plan\` if you are currently responding to a prompt starting with \`[SYSTEM_STEPPER]\`!
   - FOR SINGLE-TOOL REQUESTS (e.g. "buatkan event jam 3 lari sore" or "apa sih MBG itu?"):
     - You MUST call \`create_execution_plan\` with exactly 2 steps:
       - Step 1: \`create_calendar_event\` or \`web_search\` (Target Tool: target tool name)
       - Step 2 (+1): \`final_response\` (Target Tool: \`final_response\`)
   - FOR MULTI-TOOL REQUESTS (e.g. "buat event X kemudian kirim email Y"):
     - You MUST call \`create_execution_plan\` with N+1 steps:
       - Step 1: \`create_calendar_event\` (Target Tool: \`create_calendar_event\`)
       - Step 2: \`send_email\` (Target Tool: \`send_email\`)
       - Step 3 (+1): \`final_response\` (Target Tool: \`final_response\`)
   - DO NOT CREATE A STEP FOR ASKING DELETION CONFIRMATION! \`execution_plan\` steps MUST only be direct tool actions or \`final_response\`. If deletion confirmation is needed, ask for confirmation BEFORE generating \`create_execution_plan\`!
   - CRITICAL: When calling \`create_execution_plan\`, YOU MUST STOP IMMEDIATELY. Do NOT call any other tool or generate action text in the same turn!
   - STEPPER INSTRUCTIONS: When you receive a step prompt starting with \`[SYSTEM_STEPPER]\` (e.g. \`[SYSTEM_STEPPER] Langkah X dari Y: ... (MUST use tool: Z)\`), DO NOT CALL \`create_execution_plan\`! Execute ONLY the specified target tool (e.g. \`web_search\`, \`create_calendar_event\`) for that step directly! Read outputs of previous steps from chat history to extract any needed titles, IDs, or text. Do NOT re-run tools from previous steps!
   - FINAL CONVERSATIONAL SYNTHESIS STEP: For the final step (\`target_tool: 'final_response'\`), DO NOT call any tools! Respond in 1-2 short, fluid, conversational sentences directly answering the user's question (ideal for TTS voice reading). Do NOT use bullet points, list items, raw URLs, report headers, or meta-phrases.

8. TOOL SELECTION PRIORITY & WEB SEARCH FALLBACK HIERARCHY:
   - PRIMARY PRIORITY: ALWAYS use specific dedicated domain tools FIRST whenever a matching tool exists in Personal OS:
     - Stock prices & market quotes: MUST use \`get_stock_quote\` (e.g. ticker: "SPY", "AAPL", "BBCA").
     - Latest news & headlines: MUST use \`fetch_news_articles\`.
     - Movies & trending shows: MUST use \`search_tmdb_movies\` or \`get_trending_movies\`.
     - Tasks & Kanban: MUST use \`list_tasks\`, \`create_task\`, \`list_projects\`, etc.
     - Second Brain Vault: MUST use \`search_vault\`, \`create_note\`, \`list_folders\`, etc.
     - Calendar & Events: MUST use \`list_calendar_events\`, \`create_calendar_event\`, etc.
     - Knowledge Vault: MUST use \`search_knowledge\`, \`save_knowledge\`.
   - FALLBACK PRIORITY (\`web_search\`): Use \`web_search\` ONLY as a last-resort fallback when NO dedicated domain tool exists for the request (e.g. asking about general real-world facts, acronyms like "MBG", general web tutorials, or broad internet information that is NOT covered by stock quotes, news, movies, vault notes, tasks, or calendar).
   - NEVER ask the user "Apakah mau saya carikan di internet?". If no dedicated domain tool exists, directly execute \`create_execution_plan\` with Step 1: \`web_search\` and Step 2: \`final_response\`!


`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Scrape web search results using DuckDuckGo HTML endpoint (free, no API key required) */
async function searchDuckDuckGo(query: string, limit = 5) {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      body: new URLSearchParams({ q: query, b: "" }).toString(),
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];

    // Match result blocks in DuckDuckGo HTML structure
    const resultBlockRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    while ((match = resultBlockRegex.exec(html)) !== null && results.length < limit) {
      let rawUrl = match[1];
      const rawTitle = match[2];
      const rawSnippet = match[3];

      // Decode DDG redirected URL (uddg=...)
      if (rawUrl.includes("uddg=")) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch && uddgMatch[1]) {
          rawUrl = decodeURIComponent(uddgMatch[1]);
        }
      } else if (rawUrl.startsWith("//")) {
        rawUrl = "https:" + rawUrl;
      }

      // Clean HTML tags from title and snippet
      const cleanTitle = rawTitle.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const cleanSnippet = rawSnippet.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      if (cleanTitle && rawUrl.startsWith("http")) {
        results.push({
          title: cleanTitle,
          url: rawUrl,
          snippet: cleanSnippet,
        });
      }
    }

    // Fallback: If result__a regex didn't match, parse result__url links
    if (results.length === 0) {
      const altRegex = /<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let altMatch;
      while ((altMatch = altRegex.exec(html)) !== null && results.length < limit) {
        let rawUrl = altMatch[1];
        if (rawUrl.includes("uddg=")) {
          const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
          if (uddgMatch && uddgMatch[1]) rawUrl = decodeURIComponent(uddgMatch[1]);
        }
        const text = altMatch[2].replace(/<[^>]+>/g, "").trim();
        if (rawUrl.startsWith("http")) {
          results.push({ title: text || rawUrl, url: rawUrl, snippet: "Web search result" });
        }
      }
    }

    return results;
  } catch (e: any) {
    console.error("[DDG Search Error]:", e?.message || e);
    return [];
  }
}



/** Extract plain text from any AI SDK UIMessage format (parts[] or content string) */
function getMessageText(m: any): string {
  if (Array.isArray(m?.parts)) {
    const texts: string[] = [];
    for (const part of m.parts) {
      if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
        texts.push(part.text.trim());
      } else if (typeof part?.text === "string" && part.text.trim()) {
        texts.push(part.text.trim());
      } else if (typeof part === "string" && part.trim()) {
        texts.push(part.trim());
      } else if (part?.type?.startsWith("tool-") || part?.type === "dynamic-tool" || part?.toolName) {
        const toolName = part.toolName || (typeof part.type === "string" ? part.type.replace(/^tool-/, "") : "tool");
        const rawOutput = part.output ?? part.result;
        const outStr = typeof rawOutput === "string" ? rawOutput : (rawOutput?.message || JSON.stringify(rawOutput || {}));
        if (outStr) {
          texts.push(`[Executed tool ${toolName}: ${outStr}]`);
        }
      }
    }
    const joined = texts.join("\n").trim();
    if (joined) return joined;
  }
  if (typeof m?.content === "string" && m.content.trim()) return m.content.trim();
  if (typeof m?.text === "string" && m.text.trim()) return m.text.trim();
  return "";
}

/** Sanitize Drizzle query outputs (converts Date instances to ISO strings) */
function sanitizeData(data: any): any {
  if (!data) return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    return data;
  }
}

/** Build an AI SDK v7 tool object using inputSchema */
function makeTool(opts: {
  description: string;
  inputSchema: ReturnType<typeof jsonSchema>;
  execute: (args: any) => Promise<any>;
}) {
  return {
    type: "function" as const,
    description: opts.description,
    inputSchema: opts.inputSchema,
    execute: opts.execute,
  };
}

function safePriority(val: any): "low" | "medium" | "high" {
  const p = String(val || "medium").toLowerCase().trim();
  return (["low", "medium", "high"].includes(p) ? p : "medium") as any;
}

/** Resolves or recursively creates a nested folder path e.g. "Work/Projects/Frontend" and returns the final folder id */
async function resolveOrCreateFolderPath(folderPath: string): Promise<{ folderId: number; fullPath: string }> {
  const cleanPath = folderPath.trim().replace(/^[\/\\]+|[\/\\]+$/g, "");
  if (!cleanPath || cleanPath.toLowerCase() === "root" || cleanPath.toLowerCase() === "none" || cleanPath.toLowerCase() === "unassigned") {
    return { folderId: 0, fullPath: "Unassigned / Root" };
  }

  const segments = cleanPath.split(/[\/\\]+/).map((s) => s.trim()).filter(Boolean);
  let currentParentId: number | null = null;
  const pathParts: string[] = [];

  const allFolders = await db.select().from(folders);

  for (const seg of segments) {
    let existing = allFolders.find(
      (f) => f.name.toLowerCase() === seg.toLowerCase() && (f.parentId === currentParentId || (!f.parentId && !currentParentId))
    );

    if (!existing) {
      const res: any = await db.insert(folders).values({
        name: seg,
        parentId: currentParentId,
      });
      const newId = Number(res[0]?.insertId || res?.insertId || 0);
      existing = { id: newId, name: seg, parentId: currentParentId, createdAt: new Date() };
      allFolders.push(existing);
    }

    currentParentId = existing.id;
    pathParts.push(existing.name);
  }

  return { folderId: currentParentId || 0, fullPath: pathParts.join("/") };
}

/** Builds full folder path string from a folderId */
async function getFolderPathString(folderId: number | null): Promise<string> {
  if (!folderId) return "Unassigned / Root";
  const allFolders = await db.select().from(folders);
  type FolderItem = typeof folders.$inferSelect;
  const folderMap = new Map<number, FolderItem>(allFolders.map((f) => [f.id, f]));

  const pathParts: string[] = [];
  let currId: number | null = folderId;

  while (currId && folderMap.has(currId)) {
    const f: FolderItem = folderMap.get(currId)!;
    pathParts.unshift(f.name);
    currId = f.parentId;
  }

  return pathParts.length > 0 ? pathParts.join("/") : "Unassigned / Root";
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { messages } = await req.json();

  const modelMessages = (messages || [])
    .map((m: any) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: getMessageText(m),
    }))
    .filter((m: { role: string; content: string }) => m.content.length > 0);

  // Read settings from MySQL
  let activeModel = "gpt-4o-mini";
  let systemPrompt = DEFAULT_MASTER_SYSTEM_PROMPT;
  const dbOpenaiKey = process.env.OPENAI_API_KEY;

  try {
    const dbSettings = await db.select().from(systemSettings);
    for (const item of dbSettings) {
      if (item.key === "active_model" && item.value) activeModel = item.value;
      if (item.key === "system_prompt" && item.value) systemPrompt = item.value;
    }


    // Dynamic Context Injection from Knowledge Vault (Non-Sensitive Only)
    const kvEntries = await db
      .select()
      .from(knowledgeVault)
      .where(eq(knowledgeVault.isSensitive, false))
      .orderBy(desc(knowledgeVault.createdAt));

    if (kvEntries.length > 0) {
      const kvLines = kvEntries.map(
        (k) => `• [${k.category}] ${k.title}: ${k.content}`
      );
      systemPrompt += `\n\n=== USER PERSONAL KNOWLEDGE VAULT (PREFERENCES & BIO) ===\n${kvLines.join("\n")}\n=== END KNOWLEDGE VAULT ===`;
    }
  } catch (e) {
    console.warn("[CHAT] Using default settings:", e);
  }

  const customOpenAI = createOpenAI({ apiKey: dbOpenaiKey });

  const result = (streamText as any)({
    model: customOpenAI(activeModel as any),
    system: systemPrompt,
    messages: modelMessages,
    maxSteps: 6,

    onError: (err: any) => {
      console.error("[CHAT] streamText error:", err?.message || err);
    },

    tools: {
      // ── ORCHESTRATION ────────────────────────────────────────────────────────────
      create_execution_plan: makeTool({
        description: "Creates a structured execution plan for ANY request that requires calling tools (whether 1 tool or multiple tools). MUST be called first before executing ANY tool. Single tool requests MUST generate 2 steps (Step 1: target tool, Step 2: final_response). DO NOT call for casual chatting without tools.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            is_chain: { type: "boolean", description: "Set true if request requires multiple steps" },
            total_steps: { type: "number", description: "Total number of steps" },
            execution_plan: {
              type: "array",
              description: "Array of step objects",
              items: {
                type: "object",
                properties: {
                  step_id: { type: "number", description: "Step number starting from 1" },
                  action_type: { type: "string", description: "Type of action (e.g. tool_call, reasoning)" },
                  target_tool: { type: "string", description: "Name of target tool for this step" },
                  instruction: { type: "string", description: "Clear, detailed instruction for executing this step" },
                  requires_previous_context: { type: "boolean", description: "True if this step relies on outputs of previous steps" }
                },
                required: ["step_id", "instruction"]
              }
            }
          },
          required: ["is_chain", "total_steps", "execution_plan"],
        }),
        execute: async (args: any) => {
          const planList = args.execution_plan || args.steps || [];
          return {
            success: true,
            is_chain: args.is_chain ?? true,
            total_steps: args.total_steps || planList.length,
            execution_plan: planList,
            message: `Structured execution plan generated with ${planList.length} steps. Frontend engine will now orchestrate execution step-by-step.`
          };
        },
      }),

      // ── TASKS ────────────────────────────────────────────────────────────
      create_task: makeTool({
        description: "Creates a new task in Omni-Kanban. Accepts optional projectName or category to assign task.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Exact task title verbatim from user" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level" },
            description: { type: "string", description: "Optional task description" },
            projectName: { type: "string", description: "Optional project name to assign task to" },
          },
          required: ["title", "priority"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "New Task").trim();
            const priority = safePriority(args?.priority);
            const projectNameArg = args?.projectName ? String(args.projectName).trim() : null;

            let projectId: number | null = null;
            let projectLabel = "Default Project";

            if (projectNameArg) {
              const existingProj = await db.select().from(projects).where(like(projects.name, `%${projectNameArg}%`)).limit(1);
              if (existingProj.length) {
                projectId = existingProj[0].id;
                projectLabel = existingProj[0].name;
              } else {
                const [ins] = await db.insert(projects).values({ name: projectNameArg, status: "active" });
                projectId = (ins as any).insertId;
                projectLabel = projectNameArg;
              }
            }

            await db.insert(tasks).values({ title, priority, status: "todo", description: args?.description || null, projectId });
            revalidatePath("/tasks"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Task "${title}" [${priority.toUpperCase()}] created under project "${projectLabel}" in [Task Omni-Kanban](/tasks).`,
              pageUrl: "/tasks",
              data: sanitizeData({ title, priority, status: "todo", project: projectLabel }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to create task: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      move_task_to_project: makeTool({
        description: "Assigns or moves a task to a project in Omni-Kanban.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Task title or partial title to move" },
            projectName: { type: "string", description: "Target project name" },
          },
          required: ["title", "projectName"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const projName = String(args?.projectName || "").trim();

            const found = await db.select().from(tasks).where(like(tasks.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No task matching "${title}" found to move.`, pageUrl: "/tasks" };

            let projectId: number | null = null;
            let projectLabel = "None";

            if (projName && projName.toLowerCase() !== "none") {
              const existingProj = await db.select().from(projects).where(like(projects.name, `%${projName}%`)).limit(1);
              if (existingProj.length) {
                projectId = existingProj[0].id;
                projectLabel = existingProj[0].name;
              } else {
                const [ins] = await db.insert(projects).values({ name: projName, status: "active" });
                projectId = (ins as any).insertId;
                projectLabel = projName;
              }
            }

            await db.update(tasks).set({ projectId }).where(eq(tasks.id, found[0].id));
            revalidatePath("/tasks"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Task "${found[0].title}" moved to project "${projectLabel}" in [Task Omni-Kanban](/tasks).`,
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to move task: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      list_tasks: makeTool({
        description: "Lists tasks from Omni-Kanban. Use when user asks 'show tasks', 'what are my tasks', 'list todos', 'show todo list', 'show completed tasks', 'show done tasks'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            status: { type: "string", enum: ["todo", "in_progress", "completed", "done", "all"], description: "Filter by status" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            let filterCondition = undefined;
            if (args?.status && args.status !== "all") {
              const s = String(args.status).toLowerCase().trim();
              if (s === "completed" || s === "done" || s === "complete") {
                filterCondition = or(eq(tasks.status, "done"), eq(tasks.status, "completed"));
              } else if (s === "in_progress" || s === "doing" || s === "progress") {
                filterCondition = or(eq(tasks.status, "in_progress"), eq(tasks.status, "doing"));
              } else if (s === "todo" || s === "pending") {
                filterCondition = eq(tasks.status, "todo");
              }
            }

            const rows = filterCondition
              ? await db.select().from(tasks).where(filterCondition).orderBy(desc(tasks.createdAt)).limit(20)
              : await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(20);

            if (!rows.length) {
              const statusLabel = args?.status ? `[${args.status.toUpperCase()}] ` : "";
              return {
                success: true,
                message: `No ${statusLabel}tasks found in Omni-Kanban.`,
                pageUrl: "/tasks",
                count: 0,
                data: [],
              };
            }

            const list = rows.map((t) => `• [${t.priority?.toUpperCase()}] ${t.title} (status: ${t.status})`).join("\n");
            return {
              success: true,
              message: `📋 Omni-Kanban Tasks (${rows.length}):\n\n${list}`,
              pageUrl: "/tasks",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list tasks: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      update_task_status: makeTool({
        description: "Updates a task's status. Use when user says 'mark task as done', 'move task to in progress', 'complete task'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Partial or full task title to match" },
            status: { type: "string", enum: ["todo", "in_progress", "completed", "done"], description: "New status" },
          },
          required: ["title", "status"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            let status = String(args?.status || "todo").toLowerCase().trim();
            if (status === "completed") status = "done";

            const found = await db.select().from(tasks).where(like(tasks.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No task matching "${title}" found.`, pageUrl: "/tasks" };

            await db.update(tasks).set({ status }).where(eq(tasks.id, found[0].id));
            revalidatePath("/tasks"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Task "${found[0].title}" status updated to [${status.toUpperCase()}].`,
              pageUrl: "/tasks",
              data: sanitizeData({ id: found[0].id, title: found[0].title, status }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update task: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      delete_task: makeTool({
        description: "Deletes a task from Omni-Kanban after user confirmation. Use when user says 'delete task', 'remove task'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Task title or partial title to delete" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const found = await db.select().from(tasks).where(like(tasks.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No task matching "${title}" found to delete.`, pageUrl: "/tasks" };

            await db.delete(tasks).where(eq(tasks.id, found[0].id));
            revalidatePath("/tasks"); revalidatePath("/");
            return {
              success: true,
              message: `🗑️ Task "${found[0].title}" deleted from [Task Omni-Kanban](/tasks).`,
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete task: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      update_task: makeTool({
        description: "Edits full details of a task (title, description, priority, status, or project) in Omni-Kanban. Use when user says 'edit task', 'update task', 'change task'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentTitle: { type: "string", description: "Existing task title or partial title to find" },
            newTitle: { type: "string", description: "New task title" },
            description: { type: "string", description: "New task description" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "New priority level" },
            status: { type: "string", enum: ["todo", "in_progress", "done"], description: "New status" },
            projectName: { type: "string", description: "Project name to move task to" },
          },
          required: ["currentTitle"],
        }),
        execute: async (args: any) => {
          try {
            const currentTitle = String(args?.currentTitle || "").trim();
            const found = await db.select().from(tasks).where(like(tasks.title, `%${currentTitle}%`)).limit(1);
            if (!found.length) return { success: false, message: `No task matching "${currentTitle}" found to update.`, pageUrl: "/tasks" };

            const targetTask = found[0];
            let projectId = targetTask.projectId;

            if (args?.projectName) {
              const pName = String(args.projectName).trim();
              const existingProj = await db.select().from(projects).where(like(projects.name, `%${pName}%`)).limit(1);
              if (existingProj.length) {
                projectId = existingProj[0].id;
              } else {
                const [ins] = await db.insert(projects).values({ name: pName, status: "active" });
                projectId = (ins as any).insertId;
              }
            }

            await updateTaskFullAction(targetTask.id, {
              title: args?.newTitle || targetTask.title,
              description: args?.description !== undefined ? args.description : (targetTask.description || undefined),
              status: args?.status || targetTask.status as any,
              priority: args?.priority || targetTask.priority as any,
              projectId,
            });

            return {
              success: true,
              message: `✓ Task "${targetTask.title}" updated in [Task Omni-Kanban](/tasks).`,
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update task: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      add_task_reference: makeTool({
        description: "Adds a reference link (Asset Vault, Drive Storage, Second Brain Note, or External Link) to a task description in [REF:type:value] format.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            taskTitle: { type: "string", description: "Task title or partial title" },
            type: { type: "string", enum: ["asset", "drive", "note", "link"], description: "Reference type: 'asset' (Asset Vault), 'drive' (Drive Storage), 'note' (Second Brain Note), or 'link' (External Link)" },
            value: { type: "string", description: "Item title or external URL link" },
          },
          required: ["taskTitle", "type", "value"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.taskTitle || "").trim();
            const type = String(args?.type || "link").trim();
            const value = String(args?.value || "").trim();

            const found = await db.select().from(tasks).where(like(tasks.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No task matching "${title}" found to add reference.`, pageUrl: "/tasks" };

            const target = found[0];
            const refMarker = `[REF:${type.toUpperCase()}:${value}]`;
            const updatedDesc = target.description ? `${target.description}\n${refMarker}` : refMarker;

            await db.update(tasks).set({ description: updatedDesc }).where(eq(tasks.id, target.id));
            revalidatePath("/tasks"); revalidatePath("/");

            return {
              success: true,
              message: `✓ Attached reference (${type}: ${value}) to task "${target.title}" in [Task Omni-Kanban](/tasks).`,
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to add task reference: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      rename_project: makeTool({
        description: "Renames an existing project in Task Omni-Kanban. All tasks linked to the project will remain safely linked.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentName: { type: "string", description: "Current project name or partial name" },
            newName: { type: "string", description: "New project name" },
          },
          required: ["currentName", "newName"],
        }),
        execute: async (args: any) => {
          try {
            const currentName = String(args?.currentName || "").trim();
            const newName = String(args?.newName || "").trim();

            const found = await db.select().from(projects).where(like(projects.name, `%${currentName}%`)).limit(1);
            if (!found.length) return { success: false, message: `No project matching "${currentName}" found to rename.`, pageUrl: "/tasks" };

            await renameProjectAction(found[0].id, newName);
            return {
              success: true,
              message: `✓ Renamed project from "${found[0].name}" to **"${newName}"** in [Task Omni-Kanban](/tasks). All linked tasks remain safe.`,
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to rename project: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      delete_project: makeTool({
        description: "Deletes a project and ALL tasks linked to it after user confirmation.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            projectName: { type: "string", description: "Project name or partial name to delete" },
          },
          required: ["projectName"],
        }),
        execute: async (args: any) => {
          try {
            const projName = String(args?.projectName || "").trim();
            const found = await db.select().from(projects).where(like(projects.name, `%${projName}%`)).limit(1);
            if (!found.length) return { success: false, message: `No project matching "${projName}" found to delete.`, pageUrl: "/tasks" };

            await deleteProjectAction(found[0].id);
            return {
              success: true,
              message: `🗑️ Project **"${found[0].name}"** and all its tasks were deleted from [Task Omni-Kanban](/tasks).`,
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete project: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      // ── FINANCE ──────────────────────────────────────────────────────────
      log_transaction: makeTool({
        description: "Logs an income or expense in Finance Hub. Use when user says 'log expense', 'add income', 'spent', 'earned', 'bought', 'received'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            type: { type: "string", enum: ["income", "expense"], description: "Transaction type" },
            amount: { type: "number", description: "Amount in currency units" },
            category: { type: "string", description: "Category e.g. Food, Transport, Salary, Freelance" },
            description: { type: "string", description: "What the transaction was for" },
          },
          required: ["type", "amount"],
        }),
        execute: async (args: any) => {
          try {
            const type = String(args?.type || "expense");
            const amount = String(args?.amount || 0);
            const category = String(args?.category || "General").trim();
            const description = String(args?.description || "").trim();
            await db.insert(transactions).values({ type, amount, category, description });
            revalidatePath("/finance"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Logged ${type} of $${amount} under [${category}] in Finance Hub.`,
              pageUrl: "/finance",
              data: sanitizeData({ type, amount, category, description }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to log transaction: ${e.message}`, pageUrl: "/finance" };
          }
        },
      }),

      list_transactions: makeTool({
        description: "Shows recent transactions from Finance Hub. Use when user says 'show expenses', 'show my finances', 'recent transactions'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            type: { type: "string", enum: ["income", "expense", "all"], description: "Filter by type" },
            limit: { type: "number", description: "Number of transactions to show (default 10)" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const filter = args?.type && args.type !== "all" ? args.type : null;
            const limit = Math.min(Number(args?.limit || 10), 50);
            const rows = filter
              ? await db.select().from(transactions).where(eq(transactions.type, filter)).orderBy(desc(transactions.createdAt)).limit(limit)
              : await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(limit);

            if (!rows.length) {
              return {
                success: true,
                message: "No transactions found in Finance Hub.",
                pageUrl: "/finance",
                count: 0,
                data: [],
              };
            }

            const list = rows.map((t) => `• [${t.type.toUpperCase()}] $${t.amount} — ${t.category}: ${t.description || "—"}`).join("\n");
            return {
              success: true,
              message: `💰 Finance Transactions (${rows.length}):\n\n${list}`,
              pageUrl: "/finance",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list transactions: ${e.message}`, pageUrl: "/finance" };
          }
        },
      }),

      // ── CALENDAR ─────────────────────────────────────────────────────────
      create_calendar_event: makeTool({
        description: "Schedules an event in Master Calendar. Use when user says 'schedule', 'add event', 'remind me', 'put on calendar'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Event title" },
            eventType: { type: "string", enum: ["task", "learning", "general"], description: "Event type" },
            startTime: { type: "string", description: "ISO date-time string for start e.g. 2025-08-01T09:00:00" },
            durationMinutes: { type: "number", description: "Duration in minutes (default 60)" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "New Event").trim();
            const eventType = String(args?.eventType || "general");
            const start = args?.startTime ? new Date(args.startTime) : new Date();
            const validStart = isNaN(start.getTime()) ? new Date() : start;
            const durationMs = (Number(args?.durationMinutes) || 60) * 60 * 1000;
            const end = new Date(validStart.getTime() + durationMs);
            await db.insert(calendarEvents).values({ title, startTime: validStart, endTime: end, eventType });
            revalidatePath("/calendar"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Event "${title}" scheduled for ${validStart.toLocaleString()} in Master Calendar.`,
              pageUrl: "/calendar",
              data: sanitizeData({ title, startTime: validStart, eventType }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to schedule event: ${e.message}`, pageUrl: "/calendar" };
          }
        },
      }),

      list_calendar_events: makeTool({
        description: "Lists upcoming calendar events. Use when user says 'show calendar', 'what is scheduled', 'upcoming events'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of events to show (default 5)" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const limit = Math.min(Number(args?.limit || 5), 20);
            const rows = await db.select().from(calendarEvents).orderBy(desc(calendarEvents.startTime)).limit(limit);

            if (!rows.length) {
              return {
                success: true,
                message: "No upcoming events found in Master Calendar.",
                pageUrl: "/calendar",
                count: 0,
                data: [],
              };
            }

            const list = rows.map((e) => `• [${e.eventType}] ${e.title} — ${new Date(e.startTime).toLocaleString()}`).join("\n");
            return {
              success: true,
              message: `📅 Master Calendar Events (${rows.length}):\n\n${list}`,
              pageUrl: "/calendar",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list events: ${e.message}`, pageUrl: "/calendar" };
          }
        },
      }),

      delete_calendar_event: makeTool({
        description: "Deletes an event from Master Calendar after user confirmation. Use when user says 'delete event', 'remove event', 'cancel event'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Event title or partial title to delete" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const found = await db.select().from(calendarEvents).where(like(calendarEvents.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No event matching "${title}" found to delete.`, pageUrl: "/calendar" };

            await db.delete(calendarEvents).where(eq(calendarEvents.id, found[0].id));
            revalidatePath("/calendar"); revalidatePath("/");
            return {
              success: true,
              message: `🗑️ Event "${found[0].title}" deleted from [Master Calendar](/calendar).`,
              pageUrl: "/calendar",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete event: ${e.message}`, pageUrl: "/calendar" };
          }
        },
      }),

      update_calendar_event: makeTool({
        description: "Edits details of an existing event (title, start time, end time, or event type) in Master Calendar.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentTitle: { type: "string", description: "Existing event title or partial title" },
            newTitle: { type: "string", description: "New event title" },
            eventType: { type: "string", enum: ["task", "learning", "general"], description: "New event type" },
            startTime: { type: "string", description: "New ISO start time string" },
            durationMinutes: { type: "number", description: "New duration in minutes" },
          },
          required: ["currentTitle"],
        }),
        execute: async (args: any) => {
          try {
            const currentTitle = String(args?.currentTitle || "").trim();
            const found = await db.select().from(calendarEvents).where(like(calendarEvents.title, `%${currentTitle}%`)).limit(1);
            if (!found.length) return { success: false, message: `No event matching "${currentTitle}" found to update.`, pageUrl: "/calendar" };

            const target = found[0];
            const newTitle = args?.newTitle || target.title;
            const eventType = args?.eventType || target.eventType;
            const start = args?.startTime ? new Date(args.startTime) : new Date(target.startTime);
            const durationMs = (Number(args?.durationMinutes) || 60) * 60 * 1000;
            const end = args?.startTime || args?.durationMinutes ? new Date(start.getTime() + durationMs) : new Date(target.endTime);

            await updateEventAction(target.id, {
              title: newTitle,
              eventType,
              startTime: start,
              endTime: end,
            });

            return {
              success: true,
              message: `✓ Event "${target.title}" updated in [Master Calendar](/calendar).`,
              pageUrl: "/calendar",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update event: ${e.message}`, pageUrl: "/calendar" };
          }
        },
      }),

      // ── SECOND BRAIN / NOTES & FOLDERS ──────────────────────────────────
      list_folders: makeTool({
        description: "Lists all folders and nested folder structure in Second Brain Vault. Use when user asks 'show folders', 'list folders', 'browse folders', 'what folders do I have?'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {},
          required: [],
        }),
        execute: async () => {
          try {
            const allFolders = await db.select().from(folders);
            const allNotes = await db.select().from(notes);

            if (!allFolders.length) {
              return {
                success: true,
                message: "📁 Second Brain Vault currently has no folders created (all notes are unassigned/root).",
                pageUrl: "/vault",
                count: 0,
                data: [],
              };
            }

            const noteCounts = new Map<number, number>();
            allNotes.forEach((n) => {
              if (n.folderId) {
                noteCounts.set(n.folderId, (noteCounts.get(n.folderId) || 0) + 1);
              }
            });

            type FolderWithPath = typeof folders.$inferSelect & { fullPath: string };
            const folderMap = new Map<number, FolderWithPath>(allFolders.map((f) => [f.id, { ...f, fullPath: "" }]));
            
            const buildPath = (id: number): string => {
              const item = folderMap.get(id);
              if (!item) return "";
              if (!item.parentId) return item.name;
              return `${buildPath(item.parentId)}/${item.name}`;
            };

            allFolders.forEach((f) => {
              const item = folderMap.get(f.id);
              if (item) item.fullPath = buildPath(f.id);
            });

            const sortedList = Array.from(folderMap.values()).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
            const listStr = sortedList
              .map((f) => {
                const folderNotes = allNotes.filter((n) => n.folderId === f.id);
                const notesDetail =
                  folderNotes.length > 0
                    ? folderNotes.map((n) => `    - [${n.title}](/vault?noteId=${n.id})`).join("\n")
                    : "    - (No notes in this folder)";
                return `• 📁 **${f.fullPath}** (${folderNotes.length} notes):\n${notesDetail}`;
              })
              .join("\n\n");

            return {
              success: true,
              message: `📁 Second Brain Vault Folders & Contents (${sortedList.length}):\n\n${listStr}`,
              pageUrl: "/vault",
              count: sortedList.length,
              data: sanitizeData(sortedList),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list folders: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      create_folder: makeTool({
        description: "Creates a new folder or nested folder path e.g. 'Work/Projects/Frontend' in Second Brain Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            folderPath: { type: "string", description: "Folder name or nested path string e.g. 'Work/Projects/Frontend'" },
          },
          required: ["folderPath"],
        }),
        execute: async (args: any) => {
          try {
            const folderPathArg = String(args?.folderPath || "").trim();
            const res = await resolveOrCreateFolderPath(folderPathArg);
            revalidatePath("/vault"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Folder path "${res.fullPath}" confirmed & created in [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
              data: sanitizeData({ folderPath: res.fullPath, folderId: res.folderId }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to create folder: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      create_note: makeTool({
        description: "Creates a new note in the Second Brain Vault. Accepts optional folderPath e.g. 'Work/Projects/Frontend' or 'Architecture'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Note title" },
            content: { type: "string", description: "Note body content" },
            category: { type: "string", enum: ["idea", "reference", "project", "journal", "learning"], description: "Note category" },
            tags: { type: "string", description: "Comma-separated tags" },
            folderPath: { type: "string", description: "Target folder name or nested path e.g. 'Work/Projects/Frontend' or 'Architecture'" },
          },
          required: ["title", "content"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "Untitled").trim();
            const content = String(args?.content || "").trim();
            const category = String(args?.category || "idea");
            const tags = String(args?.tags || "");
            const folderPathArg = String(args?.folderPath || "").trim();

            let targetFolderId: number | null = null;
            let targetPathString = "Unassigned / Root";

            if (folderPathArg) {
              const res = await resolveOrCreateFolderPath(folderPathArg);
              targetFolderId = res.folderId || null;
              targetPathString = res.fullPath;
            }

            await db.insert(notes).values({
              title,
              content,
              category,
              tags,
              folderId: targetFolderId,
            });

            revalidatePath("/vault"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Note "${title}" created inside folder path [${targetPathString}] in [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
              data: sanitizeData({ title, content, category, tags, folderPath: targetPathString }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to create note: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      move_note_to_folder: makeTool({
        description: "Moves an existing note to a target folder or nested folder path (e.g. 'Work/Projects' or 'none' for root/unassigned).",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Note title or partial title to move" },
            targetFolderPath: { type: "string", description: "Target folder path e.g. 'Work/Projects' or 'none'" },
          },
          required: ["title", "targetFolderPath"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const targetPath = String(args?.targetFolderPath || "").trim();

            const found = await db.select().from(notes).where(like(notes.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No note matching "${title}" found to move.`, pageUrl: "/vault" };

            const res = await resolveOrCreateFolderPath(targetPath);
            const targetFolderId = res.folderId || null;

            await db.update(notes).set({ folderId: targetFolderId }).where(eq(notes.id, found[0].id));
            revalidatePath("/vault"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Note "${found[0].title}" moved to target location: [${res.fullPath}] in [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
              data: sanitizeData({ noteId: found[0].id, title: found[0].title, targetFolder: res.fullPath }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to move note: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      search_vault: makeTool({
        description: "Searches or lists notes in Second Brain Vault by keyword, title, or folder name/path e.g. 'Work' or 'Architecture & Specs'. Use when user asks 'find note', 'notes in Work folder', 'search vault'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Search query keyword or title (optional)" },
            folderPath: { type: "string", description: "Filter by folder name or folder path e.g. 'Work' or 'Architecture & Specs' (optional)" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "").trim();
            const folderPathArg = String(args?.folderPath || "").trim();

            const allFolders = await db.select().from(folders);
            const allNotes = await db.select().from(notes);

            const folderMap = new Map<number, string>();
            const buildPath = (id: number): string => {
              const item = allFolders.find((f) => f.id === id);
              if (!item) return "";
              if (!item.parentId) return item.name;
              return `${buildPath(item.parentId)}/${item.name}`;
            };
            allFolders.forEach((f) => folderMap.set(f.id, buildPath(f.id)));

            let filteredNotes = allNotes;

            if (folderPathArg) {
              const matchedFolderIds = allFolders
                .filter((f) => {
                  const fullP = folderMap.get(f.id) || "";
                  return fullP.toLowerCase().includes(folderPathArg.toLowerCase()) || f.name.toLowerCase().includes(folderPathArg.toLowerCase());
                })
                .map((f) => f.id);

              filteredNotes = filteredNotes.filter((n) => n.folderId && matchedFolderIds.includes(n.folderId));
            }

            if (query) {
              filteredNotes = filteredNotes.filter(
                (n) =>
                  n.title.toLowerCase().includes(query.toLowerCase()) ||
                  (n.content && n.content.toLowerCase().includes(query.toLowerCase())) ||
                  (n.tags && n.tags.toLowerCase().includes(query.toLowerCase()))
              );
            }

            if (!filteredNotes.length) {
              return {
                success: true,
                message: `No notes found matching query "${query}" ${folderPathArg ? `in folder "${folderPathArg}"` : ""} in Second Brain Vault.`,
                pageUrl: "/vault",
                count: 0,
                data: [],
              };
            }

            const list = filteredNotes
              .map((n) => {
                const folderName = n.folderId ? folderMap.get(n.folderId) || "Unassigned" : "Unassigned / Root";
                return `• [${n.title}](/vault?noteId=${n.id}) — Folder: **${folderName}** (Category: ${n.category || "General"})`;
              })
              .join("\n");

            return {
              success: true,
              message: `🧠 Second Brain Vault Results (${filteredNotes.length}):\n\n${list}`,
              pageUrl: "/vault",
              count: filteredNotes.length,
              data: sanitizeData(filteredNotes),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to search vault: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      delete_note: makeTool({
        description: "Deletes a note from Second Brain Vault after user confirmation. Use when user says 'delete note', 'remove note'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Note title or partial title to delete" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const found = await db.select().from(notes).where(like(notes.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No note matching "${title}" found to delete.`, pageUrl: "/vault" };

            await db.delete(notes).where(eq(notes.id, found[0].id));
            revalidatePath("/vault"); revalidatePath("/");
            return {
              success: true,
              message: `🗑️ Note "${found[0].title}" deleted from [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete note: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      update_note: makeTool({
        description: "Edits full details of a note (title, content, tags, category, or folder) in Second Brain Vault. Use when user says 'edit note', 'update note', 'modify note'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentTitle: { type: "string", description: "Existing note title or partial title to find" },
            newTitle: { type: "string", description: "New note title" },
            content: { type: "string", description: "New note body content" },
            category: { type: "string", enum: ["idea", "reference", "project", "journal", "learning"], description: "New category" },
            tags: { type: "string", description: "New comma-separated tags" },
            folderPath: { type: "string", description: "Folder path to move note to" },
          },
          required: ["currentTitle"],
        }),
        execute: async (args: any) => {
          try {
            const currentTitle = String(args?.currentTitle || "").trim();
            const found = await db.select().from(notes).where(like(notes.title, `%${currentTitle}%`)).limit(1);
            if (!found.length) return { success: false, message: `No note matching "${currentTitle}" found to update.`, pageUrl: "/vault" };

            const target = found[0];
            let folderId = target.folderId;

            if (args?.folderPath !== undefined) {
              const res = await resolveOrCreateFolderPath(String(args.folderPath));
              folderId = res.folderId || null;
            }

            await updateNoteAction(target.id, {
              title: args?.newTitle || target.title,
              content: args?.content !== undefined ? args.content : target.content,
              category: args?.category || target.category as any,
              tags: args?.tags !== undefined ? args.tags : target.tags,
              folderId,
            });

            return {
              success: true,
              message: `✓ Note "${target.title}" updated in [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update note: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      rename_folder: makeTool({
        description: "Renames an existing folder in Second Brain Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentName: { type: "string", description: "Current folder name or path segment" },
            newName: { type: "string", description: "New folder name" },
          },
          required: ["currentName", "newName"],
        }),
        execute: async (args: any) => {
          try {
            const currentName = String(args?.currentName || "").trim();
            const newName = String(args?.newName || "").trim();

            const found = await db.select().from(folders).where(like(folders.name, `%${currentName}%`)).limit(1);
            if (!found.length) return { success: false, message: `No folder matching "${currentName}" found to rename.`, pageUrl: "/vault" };

            await renameFolderAction(found[0].id, newName);
            return {
              success: true,
              message: `✓ Renamed folder from "${found[0].name}" to **"${newName}"** in [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to rename folder: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      move_folder: makeTool({
        description: "Moves a folder into another target folder (subfolder) or to root ('none' or 'root') in Second Brain Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            folderName: { type: "string", description: "Name of folder to move" },
            targetParentFolderPath: { type: "string", description: "Target parent folder path or 'root'/'none'" },
          },
          required: ["folderName", "targetParentFolderPath"],
        }),
        execute: async (args: any) => {
          try {
            const fName = String(args?.folderName || "").trim();
            const targetP = String(args?.targetParentFolderPath || "").trim();

            const found = await db.select().from(folders).where(like(folders.name, `%${fName}%`)).limit(1);
            if (!found.length) return { success: false, message: `No folder matching "${fName}" found to move.`, pageUrl: "/vault" };

            const targetFolder = found[0];
            let newParentId: number | null = null;

            if (targetP && targetP.toLowerCase() !== "root" && targetP.toLowerCase() !== "none") {
              const res = await resolveOrCreateFolderPath(targetP);
              newParentId = res.folderId || null;
            }

            if (newParentId === targetFolder.id) {
              return { success: false, message: "Cannot move a folder into itself.", pageUrl: "/vault" };
            }

            await db.update(folders).set({ parentId: newParentId }).where(eq(folders.id, targetFolder.id));
            revalidatePath("/vault"); revalidatePath("/");

            return {
              success: true,
              message: `✓ Folder "${targetFolder.name}" moved in [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to move folder: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      delete_folder: makeTool({
        description: "Deletes a folder and ALL subfolders + notes inside it after user confirmation in Second Brain Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            folderName: { type: "string", description: "Folder name or partial name to delete" },
          },
          required: ["folderName"],
        }),
        execute: async (args: any) => {
          try {
            const fName = String(args?.folderName || "").trim();
            const found = await db.select().from(folders).where(like(folders.name, `%${fName}%`)).limit(1);
            if (!found.length) return { success: false, message: `No folder matching "${fName}" found to delete.`, pageUrl: "/vault" };

            await deleteFolderAction(found[0].id);
            return {
              success: true,
              message: `🗑️ Folder **"${found[0].name}"** and all its notes/subfolders were deleted from [Second Brain Vault](/vault).`,
              pageUrl: "/vault",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete folder: ${e.message}`, pageUrl: "/vault" };
          }
        },
      }),

      // ── SKILLS TRACKER ───────────────────────────────────────────────────
      list_skills: makeTool({
        description: "Lists all skills currently tracked or being learned in Skill Matrix. Use when user asks 'what skill am I learning', 'list skills', 'show skills', 'learning status'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            category: { type: "string", description: "Filter by category optional e.g. hard_skill, soft_skill, language, hobby" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const cat = args?.category ? String(args.category).trim() : null;
            const rows = cat
              ? await db.select().from(skills).where(eq(skills.category, cat)).orderBy(desc(skills.createdAt))
              : await db.select().from(skills).orderBy(desc(skills.createdAt));

            if (!rows.length) {
              return {
                success: true,
                message: "No skills currently logged in Skill Matrix.",
                pageUrl: "/skills",
                count: 0,
                data: [],
              };
            }

            const list = rows
              ? rows.map((s) => `• ${s.title} — [${s.proficiency.toUpperCase()}] (${s.category}, status: ${s.status})`).join("\n")
              : "";

            return {
              success: true,
              message: `🧠 Skills Matrix (${rows.length} Skills Tracked):\n\n${list}`,
              pageUrl: "/skills",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list skills: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      search_skills: makeTool({
        description: "Searches skills in Skill Matrix by keyword or name. Use when user asks about a specific skill (e.g., 'TypeScript', 'Piano').",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Skill search keyword" },
          },
          required: ["query"],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "").trim();
            const found = await db
              .select()
              .from(skills)
              .where(or(like(skills.title, `%${query}%`), like(skills.category, `%${query}%`)));

            if (!found.length) {
              return {
                success: true,
                message: `No skill found matching "${query}" in Skill Matrix.`,
                pageUrl: "/skills",
                count: 0,
                data: [],
              };
            }

            const list = found.map((s) => `• ${s.title} — Level: ${s.proficiency.toUpperCase()} [${s.category}]`).join("\n");
            return {
              success: true,
              message: `🧠 Skill Matrix Search Results for "${query}":\n\n${list}`,
              pageUrl: "/skills",
              count: found.length,
              data: sanitizeData(found),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to search skills: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      log_skill: makeTool({
        description: "Adds a skill to the Skills Tracker. Use when user says 'add skill', 'I am learning', 'track skill'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Skill name e.g. TypeScript, Piano, Spanish" },
            category: { type: "string", enum: ["hard_skill", "soft_skill", "language", "hobby"], description: "Skill category" },
            proficiency: { type: "string", enum: ["beginner", "intermediate", "advanced", "expert"], description: "Current proficiency level" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const category = String(args?.category || "hard_skill");
            const proficiency = String(args?.proficiency || "beginner");
            await db.insert(skills).values({ title, category, proficiency, status: "learning" });
            revalidatePath("/skills"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Skill "${title}" added as [${proficiency.toUpperCase()}] ${category} in Skills Tracker.`,
              pageUrl: "/skills",
              data: sanitizeData({ title, category, proficiency }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to log skill: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      delete_skill: makeTool({
        description: "Deletes a skill from Skill Matrix after user confirmation. Use when user says 'delete skill', 'remove skill'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Skill name or partial name to delete" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const found = await db.select().from(skills).where(like(skills.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No skill matching "${title}" found to delete.`, pageUrl: "/skills" };

            await db.delete(skills).where(eq(skills.id, found[0].id));
            revalidatePath("/skills"); revalidatePath("/");
            return {
              success: true,
              message: `🗑️ Skill "${found[0].title}" deleted from [Skill Matrix](/skills).`,
              pageUrl: "/skills",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete skill: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      update_skill: makeTool({
        description: "Edits full details of a skill (title, description, category, proficiency, or status) in Skill Matrix.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentTitle: { type: "string", description: "Existing skill title or partial title to find" },
            newTitle: { type: "string", description: "New skill title" },
            description: { type: "string", description: "New skill description" },
            category: { type: "string", enum: ["hard_skill", "creative", "language", "soft_skill"], description: "New category" },
            proficiency: { type: "string", enum: ["beginner", "intermediate", "advanced", "mastery"], description: "New proficiency" },
            status: { type: "string", enum: ["learning", "paused", "completed"], description: "New status" },
          },
          required: ["currentTitle"],
        }),
        execute: async (args: any) => {
          try {
            const currentTitle = String(args?.currentTitle || "").trim();
            const found = await db.select().from(skills).where(like(skills.title, `%${currentTitle}%`)).limit(1);
            if (!found.length) return { success: false, message: `No skill matching "${currentTitle}" found to update.`, pageUrl: "/skills" };

            const target = found[0];
            await updateSkillAction(target.id, {
              title: args?.newTitle || target.title,
              description: args?.description !== undefined ? args.description : (target.description || undefined),
              category: args?.category || target.category as any,
              proficiency: args?.proficiency || target.proficiency as any,
              status: args?.status || target.status as any,
            });

            return {
              success: true,
              message: `✓ Skill "${target.title}" updated in [Skill Matrix](/skills).`,
              pageUrl: "/skills",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update skill: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      add_skill_reference: makeTool({
        description: "Adds a reference link (Asset Vault, Drive Storage, Second Brain Note, or External Link) to a skill description in [REF:type:value] format.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            skillTitle: { type: "string", description: "Skill title or partial title" },
            type: { type: "string", enum: ["asset", "drive", "note", "link"], description: "Reference type: 'asset' (Asset Vault), 'drive' (Drive Storage), 'note' (Second Brain Note), or 'link' (External Link)" },
            value: { type: "string", description: "Item title or external URL link" },
          },
          required: ["skillTitle", "type", "value"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.skillTitle || "").trim();
            const type = String(args?.type || "link").trim();
            const value = String(args?.value || "").trim();

            const found = await db.select().from(skills).where(like(skills.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No skill matching "${title}" found to add reference.`, pageUrl: "/skills" };

            const target = found[0];
            const refMarker = `[REF:${type.toUpperCase()}:${value}]`;
            const updatedDesc = target.description ? `${target.description}\n${refMarker}` : refMarker;

            await updateSkillAction(target.id, { description: updatedDesc });
            return {
              success: true,
              message: `✓ Attached reference (${type}: ${value}) to skill "${target.title}" in [Skill Matrix](/skills).`,
              pageUrl: "/skills",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to add skill reference: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      add_milestone: makeTool({
        description: "Adds a new milestone goal to a skill in Skill Matrix.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            skillTitle: { type: "string", description: "Skill title or partial title" },
            description: { type: "string", description: "Milestone goal description" },
          },
          required: ["skillTitle", "description"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.skillTitle || "").trim();
            const descStr = String(args?.description || "").trim();

            const found = await db.select().from(skills).where(like(skills.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No skill matching "${title}" found to add milestone.`, pageUrl: "/skills" };

            await createMilestoneAction(found[0].id, descStr);
            return {
              success: true,
              message: `✓ Milestone "${descStr}" added to skill **"${found[0].title}"** in [Skill Matrix](/skills).`,
              pageUrl: "/skills",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to add milestone: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      update_milestone: makeTool({
        description: "Edits the text description or completion status of an existing skill milestone.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentMilestoneText: { type: "string", description: "Current milestone text or partial text to find" },
            newDescription: { type: "string", description: "New milestone text" },
            isCompleted: { type: "boolean", description: "Mark completed (true) or uncompleted (false)" },
          },
          required: ["currentMilestoneText"],
        }),
        execute: async (args: any) => {
          try {
            const textToFind = String(args?.currentMilestoneText || "").trim();
            const foundMs = await db.select().from(skillMilestones).where(like(skillMilestones.description, `%${textToFind}%`)).limit(1);

            if (!foundMs.length) return { success: false, message: `No milestone matching "${textToFind}" found.`, pageUrl: "/skills" };

            const targetMs = foundMs[0];

            if (args?.newDescription) {
              await updateMilestoneAction(targetMs.id, String(args.newDescription));
            }
            if (args?.isCompleted !== undefined) {
              await db.update(skillMilestones).set({ isCompleted: Boolean(args.isCompleted) }).where(eq(skillMilestones.id, targetMs.id));
              revalidatePath("/skills"); revalidatePath("/");
            }

            return {
              success: true,
              message: `✓ Milestone updated in [Skill Matrix](/skills).`,
              pageUrl: "/skills",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update milestone: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      list_milestones: makeTool({
        description: "Lists all milestones and completion statuses for a skill in Skill Matrix.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            skillTitle: { type: "string", description: "Skill title or partial title" },
          },
          required: ["skillTitle"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.skillTitle || "").trim();
            const found = await db.select().from(skills).where(like(skills.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No skill matching "${title}" found.`, pageUrl: "/skills" };

            const msList = await db.select().from(skillMilestones).where(eq(skillMilestones.skillId, found[0].id));
            if (!msList.length) {
              return { success: true, message: `Skill "${found[0].title}" has no milestones configured yet.`, pageUrl: "/skills" };
            }

            const strList = msList.map((m) => `${m.isCompleted ? "[x]" : "[ ]"} ${m.description}`).join("\n");
            return {
              success: true,
              message: `🎯 Milestones for **${found[0].title}**:\n\n${strList}`,
              pageUrl: "/skills",
              data: msList,
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list milestones: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      delete_milestone: makeTool({
        description: "Deletes a milestone from a skill in Skill Matrix.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            milestoneText: { type: "string", description: "Milestone text description to delete" },
          },
          required: ["milestoneText"],
        }),
        execute: async (args: any) => {
          try {
            const textToFind = String(args?.milestoneText || "").trim();
            const foundMs = await db.select().from(skillMilestones).where(like(skillMilestones.description, `%${textToFind}%`)).limit(1);
            if (!foundMs.length) return { success: false, message: `No milestone matching "${textToFind}" found to delete.`, pageUrl: "/skills" };

            await deleteMilestoneAction(foundMs[0].id);
            return {
              success: true,
              message: `🗑️ Milestone "${foundMs[0].description}" deleted from [Skill Matrix](/skills).`,
              pageUrl: "/skills",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete milestone: ${e.message}`, pageUrl: "/skills" };
          }
        },
      }),

      // ── DRIVE / ASSET VAULT ──────────────────────────────────────────────
      list_assets: makeTool({
        description: "Lists bookmarks, web links, resources, and saved media in Asset Vault / Drive / Inventory. Use when user says 'show bookmarks', 'list assets', 'show links', 'my bookmarks', 'show resources'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            type: { type: "string", description: "Filter by asset type optional e.g. link, pdf, image, video" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const filterType = args?.type ? String(args.type).trim() : null;
            const rows = filterType
              ? await db.select().from(assets).where(eq(assets.type, filterType)).orderBy(desc(assets.createdAt))
              : await db.select().from(assets).orderBy(desc(assets.createdAt));

            if (!rows.length) {
              return {
                success: true,
                message: "No bookmarks or assets found in Asset Vault.",
                pageUrl: "/inventory",
                count: 0,
                data: [],
              };
            }

            const list = rows.map((a) => `• [${a.type.toUpperCase()}] ${a.title} — ${a.urlOrPath}`).join("\n");
            return {
              success: true,
              message: `📁 Asset Vault & Bookmarks (${rows.length}):\n\n${list}`,
              pageUrl: "/inventory",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list assets: ${e.message}`, pageUrl: "/inventory" };
          }
        },
      }),

      search_assets: makeTool({
        description: "Searches bookmarks, web links, resources, and saved media in Asset Vault / Inventory / Drive by title, keyword, or URL (e.g. 'moon', 'wikipedia'). Use when user asks for a specific bookmark, link, resource, or asset.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Search keyword e.g. moon, docs, video" },
          },
          required: ["query"],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "").trim();
            const found = await db
              .select()
              .from(assets)
              .where(
                or(
                  like(assets.title, `%${query}%`),
                  like(assets.urlOrPath, `%${query}%`),
                  like(assets.tags, `%${query}%`)
                )
              );

            if (!found.length) {
              return {
                success: true,
                message: `No bookmark or asset found matching "${query}" in Asset Vault.`,
                pageUrl: "/inventory",
                count: 0,
                data: [],
              };
            }

            const list = found.map((a) => `• [${a.type.toUpperCase()}] ${a.title}\n  URL: ${a.urlOrPath}`).join("\n");
            return {
              success: true,
              message: `📁 Asset Vault Search Results for "${query}":\n\n${list}`,
              pageUrl: "/inventory",
              count: found.length,
              data: sanitizeData(found),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to search assets: ${e.message}`, pageUrl: "/inventory" };
          }
        },
      }),

      log_asset: makeTool({
        description: "Saves a link, file reference, or resource to the Drive / Asset Vault. Use when user says 'save link', 'bookmark', 'save resource', 'add to drive'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Asset title or description" },
            url: { type: "string", description: "URL or file path" },
            type: { type: "string", enum: ["link", "pdf", "image", "video"], description: "Asset type" },
            tags: { type: "string", description: "Comma-separated tags" },
          },
          required: ["title", "url"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const urlOrPath = String(args?.url || "").trim();
            const type = String(args?.type || "link");
            const tags = String(args?.tags || "");
            await db.insert(assets).values({ title, urlOrPath, type, tags });
            revalidatePath("/inventory"); revalidatePath("/drive"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Asset "${title}" saved to Asset Vault.`,
              pageUrl: "/inventory",
              data: sanitizeData({ title, urlOrPath, type, tags }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to save asset: ${e.message}`, pageUrl: "/inventory" };
          }
        },
      }),

      delete_asset: makeTool({
        description: "Deletes a bookmark or asset from Asset Vault / Drive after user confirmation. Use when user says 'delete bookmark', 'remove asset', 'delete link'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Asset title or partial title to delete" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const found = await db.select().from(assets).where(like(assets.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No asset matching "${title}" found to delete.`, pageUrl: "/inventory" };

            await db.delete(assets).where(eq(assets.id, found[0].id));
            revalidatePath("/inventory"); revalidatePath("/drive"); revalidatePath("/");
            return {
              success: true,
              message: `🗑️ Asset "${found[0].title}" deleted from [Asset Vault](/inventory).`,
              pageUrl: "/inventory",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete asset: ${e.message}`, pageUrl: "/inventory" };
          }
        },
      }),

      update_asset: makeTool({
        description: "Edits details of an existing bookmark or resource (title, type, url, tags) in Asset Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentTitle: { type: "string", description: "Existing asset title or partial title" },
            newTitle: { type: "string", description: "New title" },
            type: { type: "string", enum: ["link", "pdf", "image", "video"], description: "New type" },
            url: { type: "string", description: "New URL or file path" },
            tags: { type: "string", description: "New comma-separated tags" },
          },
          required: ["currentTitle"],
        }),
        execute: async (args: any) => {
          try {
            const currentTitle = String(args?.currentTitle || "").trim();
            const found = await db.select().from(assets).where(like(assets.title, `%${currentTitle}%`)).limit(1);
            if (!found.length) return { success: false, message: `No asset matching "${currentTitle}" found to update.`, pageUrl: "/inventory" };

            const target = found[0];
            await updateAssetAction(target.id, {
              title: args?.newTitle || target.title,
              type: args?.type || target.type as any,
              urlOrPath: args?.url !== undefined ? args.url : target.urlOrPath,
              tags: args?.tags !== undefined ? args.tags : target.tags,
            });

            return {
              success: true,
              message: `✓ Asset "${target.title}" updated in [Asset Vault](/inventory).`,
              pageUrl: "/inventory",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update asset: ${e.message}`, pageUrl: "/inventory" };
          }
        },
      }),

      delete_transaction: makeTool({
        description: "Deletes a transaction from Finance Hub after user confirmation. Use when user says 'delete transaction', 'remove expense', 'delete income'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            description: { type: "string", description: "Transaction description or category to delete" },
          },
          required: ["description"],
        }),
        execute: async (args: any) => {
          try {
            const term = String(args?.description || "").trim();
            const found = await db.select().from(transactions).where(or(like(transactions.description, `%${term}%`), like(transactions.category, `%${term}%`))).limit(1);
            if (!found.length) return { success: false, message: `No transaction matching "${term}" found to delete.`, pageUrl: "/finance" };

            await db.delete(transactions).where(eq(transactions.id, found[0].id));
            revalidatePath("/finance"); revalidatePath("/");
            return {
              success: true,
              message: `🗑️ Transaction of $${found[0].amount} (${found[0].category}) deleted from [Finance Hub](/finance).`,
              pageUrl: "/finance",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to delete transaction: ${e.message}`, pageUrl: "/finance" };
          }
        },
      }),

      // ── PROJECTS ─────────────────────────────────────────────────────────
      create_project: makeTool({
        description: "Creates a new project. Use when user says 'create project', 'start project', 'new project'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            status: { type: "string", enum: ["active", "paused", "completed"], description: "Initial project status" },
          },
          required: ["name"],
        }),
        execute: async (args: any) => {
          try {
            const name = String(args?.name || "New Project").trim();
            const status = String(args?.status || "active");
            await db.insert(projects).values({ name, status });
            revalidatePath("/"); revalidatePath("/tasks");
            return {
              success: true,
              message: `✓ Project "${name}" created with status [${status.toUpperCase()}].`,
              pageUrl: "/tasks",
              data: sanitizeData({ name, status }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to create project: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      list_projects: makeTool({
        description: "Lists all projects in Task Omni-Kanban with status and task count statistics.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {},
        }),
        execute: async () => {
          try {
            const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
            const allTasks = await db.select().from(tasks);
            
            const result = allProjects.map((p) => {
              const linkedTasks = allTasks.filter((t) => t.projectId === p.id);
              const doneCount = linkedTasks.filter((t) => t.status === "done").length;
              return {
                id: p.id,
                name: p.name,
                status: p.status,
                totalTasks: linkedTasks.length,
                completedTasks: doneCount,
              };
            });

            const listStr = result
              .map((p) => `• **[${p.name}](/tasks)** — Status: ${p.status} (${p.completedTasks}/${p.totalTasks} tasks completed)`)
              .join("\n");

            return {
              success: true,
              count: result.length,
              projects: result,
              message: result.length
                ? `📁 **Task Omni-Kanban Projects** (${result.length}):\n\n${listStr}`
                : "No projects found in [Task Omni-Kanban](/tasks).",
              pageUrl: "/tasks",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list projects: ${e.message}`, pageUrl: "/tasks" };
          }
        },
      }),

      // ── APP LAUNCHER ─────────────────────────────────────────────────────
      list_applications: makeTool({
        description: "Lists registered applications and web shortcuts in App Launcher. Use when user says 'show apps', 'list applications', 'app shortcuts', 'show launchpad'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            category: { type: "string", description: "Filter by category (optional)" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const filterCategory = args?.category ? String(args.category).trim() : null;
            const rows = filterCategory
              ? await db.select().from(applications).where(like(applications.category, `%${filterCategory}%`)).orderBy(desc(applications.createdAt))
              : await db.select().from(applications).orderBy(desc(applications.createdAt));

            if (!rows.length) {
              return {
                success: true,
                message: "No applications registered in App Launcher.",
                pageUrl: "/apps",
                count: 0,
                data: [],
              };
            }

            const list = rows
              .map((a) => {
                const targetUrl = a.url.startsWith("http://") || a.url.startsWith("https://") ? a.url : `https://${a.url}`;
                return `• [${a.category.toUpperCase()}] [${a.name}](${targetUrl})`;
              })
              .join("\n");
            return {
              success: true,
              message: `🚀 App Launcher Applications (${rows.length}):\n\n${list}`,
              pageUrl: "/apps",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list applications: ${e.message}`, pageUrl: "/apps" };
          }
        },
      }),

      register_application: makeTool({
        description: "Registers a new web application, local service, or shortcut in App Launcher. Use when user says 'add app', 'register app', 'add shortcut', 'save app link'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            name: { type: "string", description: "Application name e.g. n8n Automation" },
            url: { type: "string", description: "URL e.g. http://localhost:5678" },
            iconName: { type: "string", description: "Lucide icon name e.g. Zap, Server, Database, Globe" },
            category: { type: "string", description: "Category e.g. Local Services, Development, Productivity" },
          },
          required: ["name", "url"],
        }),
        execute: async (args: any) => {
          try {
            const name = String(args?.name || "New App").trim();
            let url = String(args?.url || "").trim();
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
              url = `https://${url}`;
            }
            const iconName = String(args?.iconName || "Globe").trim();
            const category = String(args?.category || "General").trim();

            await db.insert(applications).values({ name, url, iconName, category });
            revalidatePath("/apps"); revalidatePath("/");
            return {
              success: true,
              message: `✓ Application "${name}" registered under [${category}] in App Launcher.`,
              pageUrl: "/apps",
              data: sanitizeData({ name, url, iconName, category }),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to register application: ${e.message}`, pageUrl: "/apps" };
          }
        },
      }),

      update_application: makeTool({
        description: "Edits details of an existing registered app or web shortcut (name, url, icon, or category) in App Launcher.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            currentName: { type: "string", description: "Current application name or partial name" },
            newName: { type: "string", description: "New application name" },
            url: { type: "string", description: "New target URL" },
            iconName: { type: "string", description: "New Lucide icon name" },
            category: { type: "string", description: "New category" },
          },
          required: ["currentName"],
        }),
        execute: async (args: any) => {
          try {
            const currentName = String(args?.currentName || "").trim();
            const found = await db.select().from(applications).where(like(applications.name, `%${currentName}%`)).limit(1);
            if (!found.length) return { success: false, message: `No application matching "${currentName}" found to update.`, pageUrl: "/apps" };

            const target = found[0];
            let url = args?.url ? String(args.url).trim() : target.url;
            if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
              url = `https://${url}`;
            }

            await updateApplication(target.id, {
              name: args?.newName || target.name,
              url,
              iconName: args?.iconName || target.iconName,
              category: args?.category || target.category,
            });

            return {
              success: true,
              message: `✓ Application "${target.name}" updated in App Launcher.`,
              pageUrl: "/apps",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to update application: ${e.message}`, pageUrl: "/apps" };
          }
        },
      }),

      // ── TMDB WATCHLIST ───────────────────────────────────────────────────
      list_watchlist: makeTool({
        description: "Lists saved movies in TMDB Watchlist. Use when user says 'show movies', 'my watchlist', 'saved movies', 'show watchlist'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {},
          required: [],
        }),
        execute: async () => {
          try {
            const rows = await db.select().from(watchlist).orderBy(desc(watchlist.createdAt));

            if (!rows.length) {
              return {
                success: true,
                message: "No movies currently saved in your TMDB Watchlist.",
                pageUrl: "/watchlist",
                count: 0,
                data: [],
              };
            }

            const list = rows.map((m) => `• ${m.title} (Rating: ${m.rating || "N/A"})`).join("\n");
            return {
              success: true,
              message: `🎬 TMDB Watchlist (${rows.length} Movies Saved):\n\n${list}`,
              pageUrl: "/watchlist",
              count: rows.length,
              data: sanitizeData(rows),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to list watchlist: ${e.message}`, pageUrl: "/watchlist" };
          }
        },
      }),

      add_to_watchlist: makeTool({
        description: "Searches TMDB for a movie and saves it to TMDB Watchlist. Use when user says 'add movie to watchlist', 'save movie', 'bookmark movie'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Movie title e.g. Inception, Interstellar, Dune" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const tmdbRes = await searchTmdbMovies(title);
            if (tmdbRes.missingKey) {
              return { success: false, message: "TMDB API key missing. Configure key in System Settings (/settings).", pageUrl: "/watchlist" };
            }
            if (!tmdbRes.results || !tmdbRes.results.length) {
              return { success: false, message: `No movie matching "${title}" found on TMDB.`, pageUrl: "/watchlist" };
            }

            const topMatch = tmdbRes.results[0];
            await saveMovieToWatchlist(topMatch);

            return {
              success: true,
              message: `🎬 Saved **"${topMatch.title}"** (Rating: ${topMatch.rating}) to [TMDB Watchlist](/watchlist).`,
              pageUrl: "/watchlist",
              data: topMatch,
            };
          } catch (e: any) {
            return { success: false, message: `Failed to add movie to watchlist: ${e.message}`, pageUrl: "/watchlist" };
          }
        },
      }),

      delete_watchlist_item: makeTool({
        description: "Removes a movie from TMDB Watchlist after user confirmation. Use when user says 'remove movie', 'delete watchlist item'.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Movie title or partial title to remove" },
          },
          required: ["title"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const found = await db.select().from(watchlist).where(like(watchlist.title, `%${title}%`)).limit(1);
            if (!found.length) return { success: false, message: `No movie matching "${title}" found in Watchlist.`, pageUrl: "/watchlist" };

            await removeMovieFromWatchlist(found[0].id);
            return {
              success: true,
              message: `🗑️ Movie **"${found[0].title}"** removed from [TMDB Watchlist](/watchlist).`,
              pageUrl: "/watchlist",
            };
          } catch (e: any) {
            return { success: false, message: `Failed to remove movie: ${e.message}`, pageUrl: "/watchlist" };
          }
        },
      }),

      // ── EXTERNAL INTELLIGENCE SKILLS (NEWS, STOCKS, SENTIMENT, MOVIES) ─────
      fetch_news_articles: makeTool({
        description: "Fetches real-time news headlines on any topic. Can be chained with send_email or create_task. Accepts limit parameter for number of items (e.g. 1 for 'top 1 berita').",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Search term e.g. 'artificial intelligence', 'technology', 'markets'" },
            limit: { type: "number", description: "Number of articles to fetch (default 5, e.g. 1 if user asks for 1 news item)" },
          },
          required: ["query"],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "technology").trim();
            const limit = Math.min(Math.max(Number(args?.limit || 5), 1), 10);
            const newsApiKey = process.env.NEWSAPI_KEY || process.env.GNEWS_API_KEY;

            if (!newsApiKey) {
              return {
                success: false,
                missingKey: true,
                message: "News API key (NEWSAPI_KEY / GNEWS_API_KEY) is not configured in environment variables (.env).",
              };
            }


            const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&max=${limit}&apikey=${newsApiKey}`;
            const res = await fetch(gnewsUrl, { next: { revalidate: 1800 } });
            if (!res.ok) {
              return { success: false, message: `News API request failed with status ${res.status}.` };
            }
            const data = await res.json();
            const articles = (data?.articles || []).map((a: any) => ({
              title: a.title,
              description: a.description || "",
              url: a.url,
              source: a.source?.name || "GNews",
              image: a.image || null,
              publishedAt: a.publishedAt,
            }));

            const listStr = articles.map((a: any) => `• [${a.title}](${a.url}) — ${a.source}\n  ${a.description}`).join("\n\n");
            return {
              success: true,
              message: `📰 Latest News for "${query}" (${articles.length} articles):\n\n${listStr}`,
              count: articles.length,
              data: articles,
            };
          } catch (e: any) {
            return { success: false, message: `Failed to fetch news: ${e.message}` };
          }
        },
      }),

      get_stock_quote: makeTool({
        description: "Fetches real-time stock price or crypto ticker quote (e.g. AAPL, NVDA, TSLA, BTC, ETH, BBCA). Can be chained with analyze_market_sentiment or send_email.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            symbol: { type: "string", description: "Stock symbol or ticker e.g. AAPL, NVDA, TSLA, BTC, BBCA.JK" },
          },
          required: ["symbol"],
        }),
        execute: async (args: any) => {
          try {
            let symbol = String(args?.symbol || "AAPL").trim().toUpperCase();
            if (symbol === "BBCA") symbol = "BBCA.JK";
            if (symbol === "TLKM") symbol = "TLKM.JK";

            const res = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
              {
                headers: { "User-Agent": "Mozilla/5.0" },
                next: { revalidate: 300 },
              }
            );

            if (res.ok) {
              const data = await res.json();
              const meta = data?.chart?.result?.[0]?.meta;
              if (meta && meta.regularMarketPrice !== undefined) {
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose || price;
                const change = price - prevClose;
                const changePercent = (change / prevClose) * 100;
                const currency = meta.currency || "USD";
                const formatted = {
                  symbol: meta.symbol || symbol,
                  price: Number(price).toFixed(2),
                  change: Number(change).toFixed(2),
                  changePercent: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
                  currency,
                  high: meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh).toFixed(2) : "N/A",
                  low: meta.regularMarketDayLow ? Number(meta.regularMarketDayLow).toFixed(2) : "N/A",
                };

                return {
                  success: true,
                  message: `📈 Stock Quote for **${formatted.symbol}**:\n• Price: **${formatted.price} ${formatted.currency}** (${formatted.changePercent})\n• Day High: ${formatted.high} | Day Low: ${formatted.low}`,
                  data: formatted,
                };
              }
            }

            return { success: false, message: `Could not fetch quote for ticker symbol "${symbol}".` };
          } catch (e: any) {
            return { success: false, message: `Failed to fetch stock quote: ${e.message}` };
          }
        },
      }),

      analyze_market_sentiment: makeTool({
        description: "Analyzes real-time market sentiment (BULLISH/BEARISH/NEUTRAL) and synthesizes news for any stock, sector, or company. Can be chained with send_email.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Target stock or market topic e.g. 'Apple', 'NVIDIA', 'Indonesian Market', 'AI Stocks'" },
          },
          required: ["query"],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "").trim();
            const result = await analyzeMarketSentiment(query);
            return result;
          } catch (e: any) {
            return { success: false, message: `Failed to analyze market sentiment: ${e.message}` };
          }
        },
      }),

      search_tmdb_movies: makeTool({
        description: "Searches movies on TMDB with posters, rating, overview, and release date. Can be chained with send_email, add_to_watchlist, or create_task. Accepts limit parameter for number of results.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Movie title e.g. 'Inception', 'Interstellar', 'Batman'" },
            limit: { type: "number", description: "Number of search results to return (default 5, e.g. 1 if user asks for 1 movie)" },
          },
          required: ["query"],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "").trim();
            const limit = Math.min(Math.max(Number(args?.limit || 5), 1), 10);
            const res = await searchTmdbMovies(query);
            if (res.missingKey) {
              return { success: false, message: "TMDB API key is missing. Please configure TMDB key in System Settings (/settings)." };
            }
            if (res.error) {
              return { success: false, message: `TMDB Search error: ${res.error}` };
            }

            const listStr = (res.results || [])
              .slice(0, limit)
              .map((m: any) => {
                const poster = m.posterPath ? `![${m.title}](${m.posterPath})\n` : "";
                return `${poster}🎬 **[${m.title}](/watchlist?search=${encodeURIComponent(m.title)})** (Rating: ${m.rating})\nRelease: ${m.releaseDate}\n${m.overview}`;
              })
              .join("\n\n");

            return {
              success: true,
              message: `🎥 TMDB Movie Search Results for "${query}" (${Math.min(res.results.length, limit)}):\n\n${listStr}`,
              data: res.results.slice(0, limit),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to search TMDB movies: ${e.message}` };
          }
        },
      }),

      get_trending_movies: makeTool({
        description: "Fetches trending movies of the week on TMDB. Can be chained with send_email, add_to_watchlist, or create_task. Accepts limit parameter for number of items (e.g. 1 for 'top 1 film').",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of trending movies to return (default 6, e.g. 1 if user asks for 1 movie)" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const limit = Math.min(Math.max(Number(args?.limit || 6), 1), 10);
            const res = await getTrendingMovies();
            if (res.missingKey) {
              return { success: false, message: "TMDB API key is missing. Please configure TMDB key in System Settings (/settings)." };
            }
            if (res.error) {
              return { success: false, message: `Trending movies error: ${res.error}` };
            }

            const listStr = (res.results || [])
              .slice(0, limit)
              .map((m: any, i: number) => {
                const poster = m.posterPath ? `![${m.title}](${m.posterPath})\n` : "";
                return `${i + 1}. ${poster}🎬 **[${m.title}](/watchlist?search=${encodeURIComponent(m.title)})** (Rating: ${m.rating})\nRelease: ${m.releaseDate}\n${m.overview}`;
              })
              .join("\n\n");

            return {
              success: true,
              message: `🔥 Top Trending Movies of the Week on TMDB:\n\n${listStr}`,
              data: res.results.slice(0, limit),
            };
          } catch (e: any) {
            return { success: false, message: `Failed to fetch trending movies: ${e.message}` };
          }
        },
      }),

      // ── KNOWLEDGE VAULT ──────────────────────────────────────────────────
      save_knowledge: makeTool({
        description: "Saves a new knowledge entry (bio, brand voice, preferences, guidelines, or sensitive credentials) into Personal Knowledge Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            title: { type: "string", description: "Title of entry (e.g. National ID (NIK), Forge25 Brand Voice)" },
            content: { type: "string", description: "Body/value of the entry" },
            category: { type: "string", description: "Category (e.g. Bio, Work, Finance, Preferences)" },
            isSensitive: { type: "boolean", description: "Set true if entry contains sensitive secret/key/ID that must be masked in UI and excluded from bulk AI prompt injection" },
          },
          required: ["title", "content"],
        }),
        execute: async (args: any) => {
          try {
            const title = String(args?.title || "").trim();
            const content = String(args?.content || "").trim();
            const category = String(args?.category || "Preferences").trim();
            const isSensitive = Boolean(args?.isSensitive);

            if (!title || !content) {
              return { success: false, message: "Title and content are required." };
            }

            const id = crypto.randomUUID();
            await db.insert(knowledgeVault).values({ id, title, category, content, isSensitive });
            revalidatePath("/knowledge");
            revalidatePath("/");

            return {
              success: true,
              message: `✓ Entri **[${title}](/knowledge?search=${encodeURIComponent(title)})** berhasil disimpan di Personal Knowledge Vault (${isSensitive ? "Sensitif & Terkunci" : "Biasa - Auto AI Context"}).`,
            };
          } catch (e: any) {
            return { success: false, message: `Gagal menyimpan entri Knowledge Vault: ${e.message}` };
          }
        },
      }),

      search_knowledge: makeTool({
        description: "Searches or lists entries stored in Personal Knowledge Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Search query for title, category, or non-sensitive content" },
            category: { type: "string", description: "Filter by category" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const q = String(args?.query || "").trim().toLowerCase();
            const cat = String(args?.category || "").trim().toLowerCase();

            const allEntries = await db.select().from(knowledgeVault).orderBy(desc(knowledgeVault.createdAt));
            const filtered = allEntries.filter((item) => {
              const matchesSearch =
                !q ||
                item.title.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q) ||
                (!item.isSensitive && item.content.toLowerCase().includes(q));
              const matchesCat = !cat || item.category.toLowerCase() === cat;
              return matchesSearch && matchesCat;
            });

            if (filtered.length === 0) {
              return { success: true, message: `Tidak ada entri Knowledge Vault yang cocok dengan "${q || cat}".` };
            }

            const itemsStr = filtered
              .map((k) => {
                if (k.isSensitive) {
                  return `• **[${k.title}](/knowledge?search=${encodeURIComponent(k.title)})** [Category: ${k.category}] 🔒 *Sensitive Data* — Nilai dirahasiakan di AI chat. Silakan klik link tersebut untuk melihat/menyalin di Knowledge Vault.`;
                }
                return `• **[${k.title}](/knowledge?search=${encodeURIComponent(k.title)})** [Category: ${k.category}]:\n  ${k.content}`;
              })
              .join("\n\n");

            return {
              success: true,
              message: `🧠 Found ${filtered.length} Knowledge Vault entries:\n\n${itemsStr}`,
            };
          } catch (e: any) {
            return { success: false, message: `Gagal mencari Knowledge Vault: ${e.message}` };
          }
        },
      }),

      update_knowledge: makeTool({
        description: "Updates an existing entry in Personal Knowledge Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            id: { type: "string", description: "ID of knowledge entry" },
            title: { type: "string", description: "Title or existing title of knowledge entry to match" },
            newTitle: { type: "string", description: "New title" },
            content: { type: "string", description: "New content/value" },
            category: { type: "string", description: "New category" },
            isSensitive: { type: "boolean", description: "New sensitive status" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const id = String(args?.id || "").trim();
            const searchTitle = String(args?.title || "").trim();

            let targetId = id;
            if (!targetId && searchTitle) {
              const matches = await db.select().from(knowledgeVault).where(like(knowledgeVault.title, `%${searchTitle}%`));
              if (matches.length > 0) targetId = matches[0].id;
            }

            if (!targetId) {
              return { success: false, message: "Entri Knowledge Vault tidak ditemukan." };
            }

            const updatePayload: any = {};
            if (args?.newTitle) updatePayload.title = String(args.newTitle).trim();
            if (args?.content) updatePayload.content = String(args.content).trim();
            if (args?.category) updatePayload.category = String(args.category).trim();
            if (args?.isSensitive !== undefined) updatePayload.isSensitive = Boolean(args.isSensitive);

            await db.update(knowledgeVault).set(updatePayload).where(eq(knowledgeVault.id, targetId));
            revalidatePath("/knowledge");
            revalidatePath("/");

            return {
              success: true,
              message: `✓ Entri Knowledge Vault berhasil diperbarui.`,
            };
          } catch (e: any) {
            return { success: false, message: `Gagal memperbarui Knowledge Vault: ${e.message}` };
          }
        },
      }),

      delete_knowledge: makeTool({
        description: "Deletes an entry from Personal Knowledge Vault.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            id: { type: "string", description: "ID of knowledge entry" },
            title: { type: "string", description: "Title or partial title of knowledge entry to delete" },
          },
          required: [],
        }),
        execute: async (args: any) => {
          try {
            const id = String(args?.id || "").trim();
            const searchTitle = String(args?.title || "").trim();

            let targetId = id;
            let targetTitle = searchTitle;

            if (!targetId && searchTitle) {
              const matches = await db.select().from(knowledgeVault).where(like(knowledgeVault.title, `%${searchTitle}%`));
              if (matches.length > 0) {
                targetId = matches[0].id;
                targetTitle = matches[0].title;
              }
            }

            if (!targetId) {
              return { success: false, message: "Entri Knowledge Vault tidak ditemukan." };
            }

            await db.delete(knowledgeVault).where(eq(knowledgeVault.id, targetId));
            revalidatePath("/knowledge");
            revalidatePath("/");

            return {
              success: true,
              message: `🗑️ Entri Knowledge Vault **${targetTitle}** telah berhasil dihapus.`,
            };
          } catch (e: any) {
            return { success: false, message: `Gagal menghapus entri Knowledge Vault: ${e.message}` };
          }
        },
      }),

      // ── OMNI-EMAILER SYSTEM ─────────────────────────────────────────────
      send_email: makeTool({
        description: "Sends an email to a specified recipient via Brevo SMTP API. If recipient email is omitted or user says 'kirim ke email saya', defaults to priyambodo02@gmail.com.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address (e.g. priyambodo02@gmail.com)" },
            subject: { type: "string", description: "Email subject line" },
            body: { type: "string", description: "Email message body in HTML or plain text" },
            recipientName: { type: "string", description: "Optional name of recipient" },
            templateId: { type: "string", description: "Optional template ID or template name to use" },
            variables: { type: "object", description: "Optional key-value record of template variables (e.g. { client_name: 'Danar' })" },
          },
          required: ["subject"],
        }),
        execute: async (args: any) => {
          try {
            let to = String(args?.to || "").trim();
            if (!to || !to.includes("@")) {
              to = "priyambodo02@gmail.com";
            }
            let subject = String(args?.subject || "").trim();
            let body = String(args?.body || "").trim();
            const recipientName = args?.recipientName ? String(args.recipientName).trim() : "Danar";
            const templateId = args?.templateId ? String(args.templateId).trim() : undefined;
            const variables = args?.variables && typeof args.variables === "object" ? args.variables : {};

            const allTemplates = await getEmailTemplates();

            // 1. If templateId is provided, find matching template
            let targetTemplate = null;
            if (templateId) {
              targetTemplate = allTemplates.find(
                (t) => t.id === templateId || t.name.toLowerCase().includes(templateId.toLowerCase())
              );
            }

            // 2. If no templateId specified, check if "Universal Omni Default" or any template exists
            if (!targetTemplate && !args?.bodyHtml) {
              targetTemplate = allTemplates.find(
                (t) => t.name.toLowerCase() === "universal omni default" || t.name.toLowerCase().includes("default")
              );
            }

            if (targetTemplate) {
              if (!subject) subject = targetTemplate.subject;
              body = targetTemplate.bodyHtml;

              // Populate default template variables if not explicitly provided
              const mergedVars = {
                subject: subject,
                recipient_name: recipientName || to.split("@")[0],
                main_message: String(args?.body || args?.message || "").replace(/\n/g, "<br/>"),
                call_to_action_text: args?.callToActionText || "Open Personal OS",
                call_to_action_url: args?.callToActionUrl || "https://personal-os.local",
                ...variables,
              };

              subject = interpolateHandlebars(subject, mergedVars);
              body = interpolateHandlebars(body, mergedVars);
            } else {
              // 3. Fallback: Wrap raw body or plain text in Sleek Executive HTML Template
              if (Object.keys(variables).length > 0) {
                subject = interpolateHandlebars(subject, variables);
                body = interpolateHandlebars(body, variables);
              }

              if (!body) {
                body = subject;
              }

              // Clean stray curly braces the AI might accidentally include
              body = body.replace(/^\s*\{/, "").replace(/\}\s*$/, "").trim();

              // Convert markdown images ![alt](url) → <img> tags for email rendering
              body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_: string, alt: string, url: string) => {
                if (!url.startsWith("http")) return "";
                return `<div style="text-align:center;margin:16px 0;"><img src="${url}" alt="${alt}" style="max-width:220px;border-radius:10px;display:block;margin:0 auto;" /></div>`;
              });

              // Convert markdown links [text](url) → <a> tags
              body = body.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#4f46e5;">$1</a>');

              // Convert **bold** → <strong>
              body = body.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

              const formattedText = body.toLowerCase().includes("<p") || body.toLowerCase().includes("<div") || body.toLowerCase().includes("<table")
                ? body
                : body.replace(/\n/g, "<br/>");

              body = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 0; color: #3f3f46; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e4e4e7;">
    <!-- HEADER -->
    <tr>
      <td style="padding: 28px 36px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); text-align: left;">
        <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.5px; font-family: monospace;">⚡ PERSONAL OS</h1>
        <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 11px; font-family: monospace; text-transform: uppercase;">Omni AI Executive Notification</p>
      </td>
    </tr>
    <!-- BODY CONTENT -->
    <tr>
      <td style="padding: 32px 36px; font-size: 14px; line-height: 1.7; color: #27272a;">
        ${formattedText}
      </td>
    </tr>
    <!-- FOOTER -->
    <tr>
      <td style="padding: 20px 36px; background-color: #fafafa; border-top: 1px solid #f4f4f5; font-size: 11px; color: #a1a1aa; font-family: monospace; text-align: center;">
        Sent automatically by <strong>Personal OS Omni AI Assistant</strong> via Brevo SMTP.<br/>
        &copy; ${new Date().getFullYear()} Personal OS Executive System.
      </td>
    </tr>
  </table>
</body>
</html>`;
            }

            const sendRes = await sendBrevoEmail({
              to,
              name: recipientName,
              subject,
              htmlContent: body,
            });

            return sendRes;
          } catch (e: any) {
            return { success: false, message: `Gagal mengirim email via Brevo: ${e.message}` };
          }
        },
      }),

      list_email_templates: makeTool({
        description: "Lists all saved email templates in Omni-Emailer Studio.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {},
          required: [],
        }),
        execute: async () => {
          try {
            const templates = await getEmailTemplates();
            if (templates.length === 0) {
              return { success: true, message: "Belum ada template email yang tersimpan di [Omni-Emailer Studio](/emailer/templates)." };
            }

            const listStr = templates
              .map((t) => {
                const vars = t.variables ? JSON.parse(t.variables) : [];
                const varStr = vars.length > 0 ? ` (Variables: ${vars.map((v: string) => `{{${v}}}`).join(", ")})` : "";
                return `• **[${t.name}](/emailer/templates)** — Subject: "${t.subject}"${varStr}`;
              })
              .join("\n");

            return {
              success: true,
              message: `✉️ Saved Email Templates (${templates.length}):\n\n${listStr}`,
              data: templates,
            };
          } catch (e: any) {
            return { success: false, message: `Gagal mengambil daftar template email: ${e.message}` };
          }
        },
      }),

      create_email_template: makeTool({
        description: "Creates a new email template in Omni-Emailer Studio.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            name: { type: "string", description: "Template name" },
            subject: { type: "string", description: "Subject line (supports {{variables}})" },
            bodyHtml: { type: "string", description: "Body HTML (supports {{variables}})" },
          },
          required: ["name", "subject", "bodyHtml"],
        }),
        execute: async (args: any) => {
          try {
            const name = String(args?.name || "").trim();
            const subject = String(args?.subject || "").trim();
            const bodyHtml = String(args?.bodyHtml || "").trim();

            const res = await createEmailTemplate({ name, subject, bodyHtml });
            return res;
          } catch (e: any) {
            return { success: false, message: `Gagal membuat template email: ${e.message}` };
          }
        },
      }),

      // ── WEB SEARCH ──────────────────────────────────────────────────────────────
      web_search: makeTool({
        description: "Searches the web via DuckDuckGo for live facts, current events, technical documentation, tutorial links, or web references. MUST be called when user asks about external web information not in local system.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "Search keywords or topic verbatim" },
            limit: { type: "number", description: "Number of search results to return (default 5)" },
          },
          required: ["query"],
        }),
        execute: async (args: any) => {
          try {
            const query = String(args?.query || "").trim();
            const limit = Number(args?.limit) || 5;
            if (!query) return { success: false, message: "Query search tidak boleh kosong." };

            const results = await searchDuckDuckGo(query, limit);
            if (results.length === 0) {
              return { success: true, message: `Pencarian web untuk "${query}" tidak menemukan hasil relevan.` };
            }

            const formatted = results.map((r, i) =>
              `${i + 1}. 🌐 **[${r.title}](${r.url})**\n${r.snippet}`
            ).join("\n\n");

            return {
              success: true,
              message: `🔍 Web Search Results for "${query}" (${results.length} sources):\n\n${formatted}`,
              data: results,
            };
          } catch (e: any) {
            return { success: false, message: `Gagal melakukan web search: ${e.message}` };
          }
        },
      }),
    },
  });


  return result.toUIMessageStreamResponse();
}
