export interface LyricLine {
  timeMs: number;
  text: string;
}

export function parseLrc(lrcString: string): LyricLine[] {
  if (!lrcString || typeof lrcString !== "string") {
    return [];
  }

  const result: LyricLine[] = [];
  const lines = lrcString.split(/\r?\n/);

  // Regex to match timestamps like [00:33.25] or [01:02:50] or [00:15.123]
  const timestampRegex = /\[(\d{2,}):(\d{2})(?:[.:](\d{2,3}))?\]/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Ignore metadata tags like [ar:...], [ti:...], [al:...], [by:...], [offset:...]
    if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(trimmed)) {
      continue;
    }

    const matches = Array.from(trimmed.matchAll(timestampRegex));
    if (matches.length === 0) continue;

    // Extract text by removing all timestamp tags
    const text = trimmed.replace(timestampRegex, "").trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10) || 0;
      const seconds = parseInt(match[2], 10) || 0;
      const subSecStr = match[3] || "0";
      
      let milliseconds = 0;
      if (subSecStr.length === 2) {
        milliseconds = parseInt(subSecStr, 10) * 10;
      } else if (subSecStr.length === 3) {
        milliseconds = parseInt(subSecStr, 10);
      } else {
        milliseconds = parseInt(subSecStr, 10) * 100;
      }

      const timeMs = (minutes * 60 + seconds) * 1000 + milliseconds;
      result.push({ timeMs, text });
    }
  }

  // Sort lyrics chronologically by timeMs
  return result.sort((a, b) => a.timeMs - b.timeMs);
}
