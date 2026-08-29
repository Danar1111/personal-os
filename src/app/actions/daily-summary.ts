"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { getIndonesianHoliday } from "@/lib/calendar-utils";

export interface ActiveProjectBrief {
  id: number;
  name: string;
  status?: string;
  currentPhaseTitle?: string | null;
  progress?: number | null;
}

export interface DailySummaryPayload {
  userName?: string;
  pendingTasksCount: number;
  totalTasksCount: number;
  completionRate: number;
  topTaskTitles?: string[];
  nextEvent?: {
    title: string;
    startTime: string | Date;
    source?: string;
  } | null;
  activeProjects?: ActiveProjectBrief[];
}

export interface DailySummaryResult {
  success: boolean;
  summary: string;
  isAiGenerated: boolean;
  holidayName?: string | null;
}

/**
 * Fallback summary generator using casual, friendly Indonesian templates
 */
function generateFallbackSummary(payload: DailySummaryPayload, holidayName: string | null): string {
  const name = payload.userName || "Danar";
  const now = new Date();
  const hour = now.getHours();
  const timeGreeting =
    hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";

  const nextEventTimeStr = payload.nextEvent?.startTime
    ? new Date(payload.nextEvent.startTime).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const topList = payload.topTaskTitles || [];
  let taskSnippet = "";
  if (topList.length > 0) {
    const formattedList = topList.slice(0, 3).map((t) => `"${t}"`).join(", ");
    taskSnippet = ` seperti ${formattedList}`;
  }

  const projList = payload.activeProjects || [];
  let projectSnippet = "";
  if (projList.length > 0) {
    const p = projList[0];
    const phaseInfo = p.currentPhaseTitle ? ` (fase ${p.currentPhaseTitle})` : "";
    projectSnippet = ` Pantau juga progres project "${p.name}"${phaseInfo} yang sedang berjalan.`;
  }

  if (holidayName) {
    if (payload.nextEvent) {
      return `Halo ${name}, selamat ${timeGreeting.toLowerCase()}! Hari ini tanggal merah (${holidayName}) pas banget buat santai sejenak. Tetap ada agenda "${payload.nextEvent.title}" jam ${nextEventTimeStr} dan ${payload.pendingTasksCount} tugas aktif di kanban${taskSnippet} yang menunggu ya~${projectSnippet}`;
    }
    return `Halo ${name}, selamat hari libur (${holidayName})! Waktunya rileks dan recharge energi. Personal OS tetap terpantau aman dengan ${payload.pendingTasksCount} tugas aktif di kanban.${projectSnippet}`;
  }

  if (payload.nextEvent) {
    return `Semangat ${timeGreeting.toLowerCase()} ${name}! Ada ${payload.pendingTasksCount} tugas aktif di kanban${taskSnippet}, plus agenda "${payload.nextEvent.title}" jam ${nextEventTimeStr}.${projectSnippet} Gas selesaikan satu-satu dengan santai!`;
  }

  if (payload.pendingTasksCount === 0) {
    return `Keren banget ${name}! Semua tugas di antrean kanban sudah beres 100%.${projectSnippet} Nikmati waktu luang kamu dan tetap semangat!`;
  }

  return `Halo ${name}, selamat ${timeGreeting.toLowerCase()}! Personal OS berjalan lancar dengan ${payload.pendingTasksCount} tugas aktif di kanban${taskSnippet}.${projectSnippet} Tetap fokus dan enjoy hari ini!`;
}

export async function getSmartDailySummaryAction(
  payload: DailySummaryPayload
): Promise<DailySummaryResult> {
  const now = new Date();
  const holiday = getIndonesianHoliday(now);
  const holidayName = holiday?.isHoliday ? holiday.name : null;

  const fallback = generateFallbackSummary(payload, holidayName);

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return {
        success: true,
        summary: fallback,
        isAiGenerated: false,
        holidayName,
      };
    }

    let activeModel = "gpt-4o-mini";
    try {
      const settings = await db.select().from(systemSettings);
      for (const s of settings) {
        if (s.key === "active_model" && s.value?.trim()) {
          activeModel = s.value.trim();
        }
      }
    } catch {
      // Ignore DB setting error and fallback to default model
    }

    const nextEventTimeStr = payload.nextEvent?.startTime
      ? new Date(payload.nextEvent.startTime).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const hour = now.getHours();
    const timeOfDay = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";

    const isGCal = payload.nextEvent?.source === "GCAL" || payload.nextEvent?.source === "google";

    const projectContextStr =
      payload.activeProjects && payload.activeProjects.length > 0
        ? payload.activeProjects
            .map(
              (p) =>
                `Project "${p.name}" (Fase saat ini: ${p.currentPhaseTitle || "In Progress"}, Progress: ${p.progress || 0}%)`
            )
            .join("; ")
        : "Tidak ada project strategis aktif";

    const prompt = `Kamu adalah asisten pribadi pintar di Personal OS milik ${payload.userName || "Danar"}.
Tugasmu: Buat 2-3 kalimat sapaan & ringkasan yang sangat santai, akrab, dan berisi (bahasa Indonesia kasual/gaul modern).
Data konteks hari ini:
- Nama Pengguna: ${payload.userName || "Danar"}
- Waktu: Selamat ${timeOfDay} (${now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })})
- Hari Libur / Tanggal Merah: ${holidayName ? `🎉 ${holidayName}` : "Tidak ada (hari kerja biasa)"}
- Tugas Kanban Aktif: ${payload.pendingTasksCount} tugas aktif menunggu. ${payload.topTaskTitles && payload.topTaskTitles.length > 0 ? `Daftar tugas aktif & info deadline: ${payload.topTaskTitles.join("; ")}.` : ""}
- Event Berikutnya: ${payload.nextEvent ? `"${payload.nextEvent.title}" pada jam ${nextEventTimeStr} (${isGCal ? "Google Calendar" : "Local Calendar"})` : "Tidak ada event scheduled"}
- Project & Strategy Hub (Makro): ${projectContextStr}

Aturan Ketat:
1. Buat 2-3 kalimat santai berisi & berbobot (sekitar 40-60 kata). Jangan terlalu singkat atau kaku.
2. Gaya bahasa: Santai banget, bersahabat, cerdas, akrab (sebut nama ${payload.userName || "Danar"}).
3. Masukkan kombinasi sapaan nama, tugas harian aktif (prioritaskan yang ada deadline), event berikutnya/libur, dan selipkan ringkasan santai tentang project strategis yang sedang aktif bila relevan.
4. JANGAN PERNAH sebutkan angka total keseluruhan semua tugas (misal "dari 23 total" atau "% beres"), CUKUP sebutkan jumlah tugas aktif yang belum selesai.
5. JANGAN gunakan format markdown, bullet points, atau tanda kutip pembungkus. Tulis teks polos saja.`;

    const customOpenAI = createOpenAI({ apiKey: openaiKey });
    const { text } = await generateText({
      model: customOpenAI(activeModel as any),
      prompt,
      temperature: 0.7,
    });

    const cleanText = text?.trim();
    if (!cleanText) {
      return {
        success: true,
        summary: fallback,
        isAiGenerated: true,
        holidayName,
      };
    }

    return {
      success: true,
      summary: cleanText,
      isAiGenerated: true,
      holidayName,
    };
  } catch (error) {
    console.error("[getSmartDailySummaryAction Error]:", error);
    return {
      success: true,
      summary: fallback,
      isAiGenerated: false,
      holidayName,
    };
  }
}
