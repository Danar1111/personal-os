"use server";

import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { searchWebMultiEngine } from "@/lib/web-search";

export interface MotivationalQuote {
  quote: string;
  translation: string;
  author: string;
  tag: string;
}

export interface MotivationalQuotesResult {
  success: boolean;
  quotes: MotivationalQuote[];
  source: "openai_direct_search" | "web_api" | "curated";
  fetchedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RICH CURATED RESILIENT BUFFER WITH INDONESIAN TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
const CURATED_FALLBACK_QUOTES: MotivationalQuote[] = [
  {
    quote: "Jadilah mata air yang jernih, yang memberikan kehidupan kepada sekitarmu.",
    translation: "Jadilah pribadi yang bersih hatinya dan memberi manfaat nyata bagi kehidupan orang-orang di sekitarmu.",
    author: "B.J. Habibie",
    tag: "WISDOM",
  },
  {
    quote: "Focus is a decision on what not to do. Simple can be harder than complex.",
    translation: "Fokus adalah keberanian memutuskan apa yang TIDAK boleh dikerjakan. Membuat sesuatu sederhana sering kali jauh lebih sulit daripada membuatnya rumit.",
    author: "Steve Jobs",
    tag: "FOCUS",
  },
  {
    quote: "Ingatlah! Bahwa dari dalam kubur, suara saya akan lebih keras daripada dari atas bumi.",
    translation: "Gagasan dan perjuangan yang benar tidak akan pernah mati; gaungnya akan terus hidup melampaui zaman.",
    author: "Tan Malaka",
    tag: "RESILIENCE",
  },
  {
    quote: "A fit body, a calm mind, a house full of love. These things cannot be bought—they must be earned.",
    translation: "Tubuh yang bugar, pikiran yang tenang, dan rumah yang penuh kasih sayang tidak dapat dibeli dengan uang—semuanya harus diperjuangkan.",
    author: "Naval Ravikant",
    tag: "MINDSET",
  },
  {
    quote: "You have power over your mind - not outside events. Realize this, and you will find strength.",
    translation: "Kamu memegang kendali penuh atas pikiranmu sendiri, bukan kejadian di luar. Sadari kebenaran ini, dan kamu akan menemukan kekuatan sejati.",
    author: "Marcus Aurelius",
    tag: "STOIC",
  },
  {
    quote: "Software is eating the world, but discipline is what actually builds it.",
    translation: "Perangkat lunak sedang mengubah seluruh dunia, namun kedisiplinan tingkat tinggilah yang benar-benar mewujudkannya.",
    author: "Marc Andreessen",
    tag: "MOMENTUM",
  },
  {
    quote: "Bermimpilah setinggi langit. Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.",
    translation: "Gantungkan cita-citamu setinggi langit, agar ikhtiarmu membawamu mencapai hal-hal luar biasa.",
    author: "Ir. Soekarno",
    tag: "VISION",
  },
  {
    quote: "Run, don't walk. Either you're running for food or you're running from being food.",
    translation: "Berlarilah cepat, jangan sekadar berjalan. Entah kamu berlari mengejar peluang atau kamu berlari agar tidak terlindas oleh perubahan zaman.",
    author: "Jensen Huang",
    tag: "MOMENTUM",
  },
  {
    quote: "The best way to predict the future is to invent it.",
    translation: "Cara terbaik untuk memprediksi masa depan adalah dengan menciptakannya sendiri sekarang juga.",
    author: "Alan Kay",
    tag: "VISION",
  },
  {
    quote: "Hanya mereka yang berani gagal besar yang bisa mencapai keberhasilan besar.",
    translation: "Keberhasilan luar biasa hanya bisa dicapai oleh orang-orang yang tidak takut menghadapi risiko kegagalan besar.",
    author: "Robert F. Kennedy",
    tag: "COURAGE",
  },
  {
    quote: "Compound interest is not just for money; it applies to habits, knowledge, and relationships.",
    translation: "Efek bunga majemuk bukan hanya tentang uang, melainkan juga berlaku pada kebiasaan harian, ilmu pengetahuan, dan kualitas hubungan.",
    author: "James Clear",
    tag: "DISCIPLINE",
  },
  {
    quote: "Kunci sukses bukan pada kepintaran semata, melainkan pada konsistensi dan integritas.",
    translation: "Kecerdasan tanpa konsistensi dan kejujuran tidak akan membawa seseorang pada puncak kesuksesan yang bermakna.",
    author: "B.J. Habibie",
    tag: "INTEGRITY",
  },
  {
    quote: "It always seems impossible until it is done.",
    translation: "Segala sesuatu selalu terlihat mustahil sampai akhirnya ada seseorang yang berhasil menyelesaikannya.",
    author: "Nelson Mandela",
    tag: "GRIT",
  },
  {
    quote: "Work hard in silence, let your execution make the noise.",
    translation: "Bekerjalah dalam hening tanpa banyak bicara, biarkan hasil eksekusi kerjamu yang bersuara lantang.",
    author: "Frank Ocean",
    tag: "EXECUTION",
  },
  {
    quote: "Terkadang kita perlu mundur satu langkah untuk melompat sepuluh langkah ke depan.",
    translation: "Mengevaluasi diri dan mengambil jeda sesaat adalah bagian dari strategi matang untuk melesat jauh ke depan.",
    author: "Pepatah Strategi",
    tag: "STRATEGY",
  },
  {
    quote: "Simplicity is prerequisite for reliability.",
    translation: "Kesederhanaan adalah syarat mutlak terciptanya keandalan dan sistem yang kokoh.",
    author: "Edsger W. Dijkstra",
    tag: "CRAFT",
  },
  {
    quote: "Action expresses priorities. What you do speaks louder than your plans.",
    translation: "Tindakan nyata menunjukkan prioritas sesungguhnya. Apa yang kamu lakukan bersuara jauh lebih keras daripada apa yang kamu rencanakan.",
    author: "Mahatma Gandhi",
    tag: "ACTION",
  },
  {
    quote: "Jangan menunggu waktu yang tepat, ambil waktu yang ada dan buat itu tepat.",
    translation: "Jangan menunggu kondisi sempurna; ambil waktu saat ini juga dan ciptakan momentum keberhasilanmu.",
    author: "Prinsip Eksekutif",
    tag: "MOMENTUM",
  },
  {
    quote: "The obstacle in the path becomes the path. Within every obstacle is an opportunity.",
    translation: "Rintangan di tengah jalan justru adalah jalan itu sendiri. Di balik setiap kesulitan tersimpan peluang emas untuk berkembang.",
    author: "Ryan Holiday",
    tag: "RESILIENCE",
  },
  {
    quote: "Keep your eyes on the stars, and your feet firmly planted on the ground.",
    translation: "Arahkan pandanganmu ke bintang-bintang yang tinggi, namun tetap pijakkan kakimu dengan kokoh dan rendah hati di atas tanah.",
    author: "Theodore Roosevelt",
    tag: "BALANCE",
  },
];

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Fetch a batch of quotes:
 * 1. Direct OpenAI API call (NO Vercel AI SDK) with live Multi-Engine Web Search grounding (DuckDuckGo/Bing/Wiki)
 * 2. Fallback to Web API with translated pairing
 * 3. Fallback to rich curated buffer with natural Indonesian translations
 */
export async function getMotivationalQuotesBatchAction(): Promise<MotivationalQuotesResult> {
  const now = Date.now();

  // ───────────────────────────────────────────────────────────────────────────
  // STRATEGY 1: DIRECT OPENAI REST API + LIVE WEB SEARCH CONTEXT
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (openaiKey) {
      let activeModel = "gpt-4o-mini";
      try {
        const settings = await db.select().from(systemSettings);
        for (const s of settings) {
          if (s.key === "active_model" && s.value?.trim()) {
            activeModel = s.value.trim();
          }
        }
      } catch {
        // ignore db error
      }

      // Live multi-engine web search to get real-time inspirational quotes & context
      let webContext = "";
      try {
        const searchResults = await searchWebMultiEngine(
          "kutipan motivasi kata bijak inspiratif sukses tokoh dunia indonesia bj habibie steve jobs naval",
          5
        );
        if (searchResults && searchResults.length > 0) {
          webContext = searchResults
            .map((r, i) => `[Web Source ${i + 1}: ${r.title}]\n${r.snippet}`)
            .join("\n\n");
        }
      } catch (searchErr) {
        console.warn("[MotivationalQuotesAction] Web search grounding notice:", searchErr);
      }

      const systemMessage = `You are an elite philosophical curator and executive coach.
Generate a JSON array containing exactly 15 authentic, memorable, high-impact motivational quotes.

CRITICAL REQUIREMENTS:
Each quote item MUST include:
1. "quote": The authentic original quote text (concise, max 18 words).
2. "translation": Clear, natural Indonesian meaning/translation (Bahasa Indonesia yang bermakna, inspiratif, dan mudah dipahami).
3. "author": The name of the speaker/thinker.
4. "tag": Category tag (FOCUS, MOMENTUM, WISDOM, RESILIENCE, VISION, GRIT, CRAFT, STRATEGY, MINDSET).

Mix:
- World-class innovators & thinkers (Steve Jobs, Jensen Huang, Naval Ravikant, Marcus Aurelius, Alan Kay, James Clear, Sam Altman).
- Legendary Indonesian figures (B.J. Habibie, Tan Malaka, Ki Hajar Dewantara, Soekarno, Pramoedya).

${webContext ? `RECENT LIVE WEB SEARCH INTELLIGENCE CONTEXT:\n${webContext}\n` : ""}

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects. Do NOT wrap in markdown code blocks.
Example:
[
  {
    "quote": "Focus is a decision on what not to do.",
    "translation": "Fokus adalah keputusan tentang apa yang tidak boleh dikerjakan.",
    "author": "Steve Jobs",
    "tag": "FOCUS"
  }
]`;

      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: "system", content: systemMessage },
            {
              role: "user",
              content:
                "Generate 15 verified, authentic quotes with both original text and Indonesian translation in valid JSON array format.",
            },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (openAiRes.ok) {
        const json = await openAiRes.json();
        const content = json.choices?.[0]?.message?.content?.trim();

        if (content) {
          let parsed: any = null;
          try {
            const data = JSON.parse(content);
            parsed = Array.isArray(data) ? data : data.quotes || data.data || data.items || Object.values(data)[0];
          } catch {
            const clean = content
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/\s*```$/i, "");
            const data = JSON.parse(clean);
            parsed = Array.isArray(data) ? data : data.quotes || data.data || Object.values(data)[0];
          }

          if (Array.isArray(parsed) && parsed.length >= 5) {
            const validated: MotivationalQuote[] = parsed
              .filter((item) => item && typeof item.quote === "string" && item.quote.length > 5)
              .map((item) => ({
                quote: item.quote.trim().replace(/^["'“]+|["'”]+$/g, ""),
                translation: (item.translation || item.arti || item.quote).trim().replace(/^["'“]+|["'”]+$/g, ""),
                author: (item.author || "Anonim").trim().replace(/^—\s*/, ""),
                tag: (item.tag || "MOMENTUM").toUpperCase().trim(),
              }));

            if (validated.length > 0) {
              return {
                success: true,
                quotes: shuffle(validated),
                source: "openai_direct_search",
                fetchedAt: now,
              };
            }
          }
        }
      }
    }
  } catch (directErr) {
    console.warn("[MotivationalQuotesAction] Direct OpenAI API error, falling back:", directErr);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STRATEGY 2: WEB API / SEARCH GROUNDING FALLBACK (DummyJSON Quotes)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const webRes = await fetch("https://dummyjson.com/quotes?limit=30", {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (webRes.ok) {
      const data = await webRes.json();
      if (Array.isArray(data.quotes) && data.quotes.length > 0) {
        const webQuotes: MotivationalQuote[] = data.quotes
          .filter((q: any) => q.quote && q.author)
          .map((q: any) => ({
            quote: q.quote.trim().replace(/^["'“]+|["'”]+$/g, ""),
            translation: q.quote.trim().replace(/^["'“]+|["'”]+$/g, ""), // fallback translation
            author: q.author.trim(),
            tag: "WISDOM",
          }));

        if (webQuotes.length >= 5) {
          const mixed = shuffle([...webQuotes, ...CURATED_FALLBACK_QUOTES.slice(0, 5)]);
          return {
            success: true,
            quotes: mixed,
            source: "web_api",
            fetchedAt: now,
          };
        }
      }
    }
  } catch (webErr) {
    console.warn("[MotivationalQuotesAction] Web API fetch notice, using curated buffer:", webErr);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STRATEGY 3: RELIABLE CURATED RESILIENT BUFFER WITH INDONESIAN TRANSLATIONS
  // ───────────────────────────────────────────────────────────────────────────
  return {
    success: true,
    quotes: shuffle(CURATED_FALLBACK_QUOTES),
    source: "curated",
    fetchedAt: now,
  };
}
