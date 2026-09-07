/**
 * Robust Multi-Engine Web Search Utility
 * (DuckDuckGo HTML + Bing Fallback + Wikipedia Knowledge API)
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Decode Bing tracking URL
export function decodeBingUrl(rawUrl: string): string {
  try {
    const unescaped = rawUrl.replace(/&amp;/g, "&");
    if (unescaped.includes("&u=") || unescaped.includes("?u=")) {
      const match = unescaped.match(/[?&]u=([^&]+)/);
      if (match && match[1]) {
        let b64 = match[1];
        if (b64.startsWith("a1")) b64 = b64.slice(2);
        b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4 !== 0) b64 += "=";
        const decoded = Buffer.from(b64, "base64").toString("utf-8");
        if (decoded.startsWith("http")) return decoded;
      }
    }
  } catch {}
  return rawUrl;
}

// Decode DuckDuckGo tracking URL
export function decodeDdgUrl(rawUrl: string): string {
  if (rawUrl.includes("uddg=")) {
    const match = rawUrl.match(/uddg=([^&]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  if (rawUrl.startsWith("//")) return "https:" + rawUrl;
  return rawUrl;
}

/** Robust Multi-Engine Web Search (DuckDuckGo + Bing Fallback + Wikipedia Knowledge API) */
export async function searchWebMultiEngine(
  query: string,
  limit = 5
): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  // ── Engine 1: DuckDuckGo HTML ──────────────────────────────────────────────
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      body: new URLSearchParams({ q: cleanQ, b: "" }).toString(),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const html = await res.text();
      if (!html.includes("anomaly-modal")) {
        const blocks = html.split(/class="[^"]*result(?:__body|_links)[^"]*"/i);
        for (let i = 1; i < blocks.length && results.length < limit; i++) {
          const block = blocks[i];
          const titleMatch = block.match(
            /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
          );
          if (!titleMatch) continue;

          const rawUrl = decodeDdgUrl(titleMatch[1]);
          if (
            rawUrl.includes("duckduckgo.com/y.js") ||
            rawUrl.includes("ad_provider")
          )
            continue;

          const rawTitle = titleMatch[2];
          const snippetMatch = block.match(
            /<[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i
          );
          const rawSnippet = snippetMatch ? snippetMatch[1] : "";

          const title = rawTitle
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          const snippet = rawSnippet
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();

          if (
            title &&
            rawUrl.startsWith("http") &&
            !results.some((r) => r.url === rawUrl)
          ) {
            results.push({
              title,
              url: rawUrl,
              snippet: snippet || "Web search result",
            });
          }
        }
      }
    }
  } catch (e: any) {
    console.warn("[DDG Search Error]:", e?.message || e);
  }

  // ── Engine 2: Bing Search (Fallback if DDG returns < limit) ────────────────
  if (results.length < limit) {
    try {
      const bingRes = await fetch(
        `https://www.bing.com/search?q=${encodeURIComponent(cleanQ)}&setlang=id&count=10`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          },
          signal: AbortSignal.timeout(4000),
        }
      );

      if (bingRes.ok) {
        const bingHtml = await bingRes.text();
        const blocks = bingHtml.split(/<li[^>]*class="b_algo"[^>]*>/i);

        for (let i = 1; i < blocks.length && results.length < limit; i++) {
          const block = blocks[i].split(/<\/li>/i)[0];
          const h2Match = block.match(
            /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i
          );
          if (!h2Match) continue;

          let rawUrl = decodeBingUrl(h2Match[1]);
          if (
            rawUrl.includes("bing.com/aclick") ||
            rawUrl.includes("ad_domain")
          )
            continue;

          const title = h2Match[2]
            .replace(/<[^>]+>/g, "")
            .replace(/&#\d+;/g, "")
            .replace(/&[a-z]+;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const snippetMatch =
            block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
            block.match(/<div[^>]*class="b_caption"[^>]*>([\s\S]*?)<\/div>/i);
          const snippet = (snippetMatch ? snippetMatch[1] : "")
            .replace(/<[^>]+>/g, "")
            .replace(/&#\d+;/g, "")
            .replace(/&[a-z]+;/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (
            title &&
            rawUrl.startsWith("http") &&
            !results.some((r) => r.url === rawUrl)
          ) {
            results.push({
              title,
              url: rawUrl,
              snippet: snippet || "Web search result",
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[Bing Search Error]:", e?.message || e);
    }
  }

  // ── Engine 3: Wikipedia Knowledge API ──────────────────────────────────────
  if (results.length < 2) {
    try {
      const wikiRes = await fetch(
        `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&format=json&utf8=1`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const wikiItems = wikiData?.query?.search || [];
        for (const item of wikiItems) {
          if (results.length >= limit) break;
          const title = item.title;
          const url = `https://id.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
          const snippet = item.snippet
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (!results.some((r) => r.url === url)) {
            results.push({
              title: `Wikipedia: ${title}`,
              url,
              snippet,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[Wiki Search Error]:", e?.message || e);
    }
  }

  return results.slice(0, limit);
}
