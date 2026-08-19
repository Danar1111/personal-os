export interface UnifiedCalendarEvent {
  id: string; // e.g. 'local-1' | 'gcal-xxxx' | 'task-xxxx'
  localId?: number;
  taskId?: number;
  title: string;
  description?: string | null;
  start: string; // ISO string
  end: string; // ISO string
  source: "LOCAL" | "GCAL" | "KANBAN";
  eventType?: "task" | "learning" | "general";
  taskStatus?: string; // 'todo' | 'in_progress' | 'done'
  taskPriority?: string; // 'low' | 'medium' | 'high'
  isAllDay: boolean;
  htmlLink?: string;
  location?: string;
}

export interface WeekEventSpan {
  event: UnifiedCalendarEvent;
  startColumn: number; // 1-7 (1 = Monday, 7 = Sunday)
  colSpan: number; // 1-7
  isStartEdge: boolean; // True if event starts in this week (gets rounded left edge)
  isEndEdge: boolean; // True if event ends in this week (gets rounded right edge)
  trackIndex: number; // Vertical stacking slot index (0, 1, 2, ...)
}

/**
 * Checks if two dates represent the exact same calendar day (ignoring time)
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Checks if d1 is calendar day on or before d2
 */
export function isSameDayOrBefore(d1: Date, d2: Date): boolean {
  const day1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const day2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return day1 <= day2;
}

/**
 * Checks if d1 is calendar day on or after d2
 */
export function isSameDayOrAfter(d1: Date, d2: Date): boolean {
  const day1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const day2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return day1 >= day2;
}

/**
 * Checks if an event is multi-day or marked as all-day
 */
export function isMultiDayEvent(event: UnifiedCalendarEvent): boolean {
  if (event.isAllDay) return true;
  const start = new Date(event.start);
  const end = new Date(event.end);
  return !isSameDay(start, end) && end.getTime() > start.getTime();
}

/**
 * Generates a full month calendar grid divided into rows of 7 days (Monday-first: Mon=0 ... Sun=6)
 */
export function getCalendarMonthGrid(year: number, month: number): Date[][] {
  const firstDayOfMonth = new Date(year, month, 1);
  // In JS getDay(): Sun = 0, Mon = 1, Tue = 2... Sat = 6
  // We want Monday = 0, Sunday = 6
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const startDate = new Date(year, month, 1 - startingDayOfWeek);
  const weeks: Date[][] = [];

  let currentDay = new Date(startDate);

  // We generate 5 or 6 weeks to ensure all month days + boundary padding days are covered
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    weeks.push(week);

    // If we've finished the month and the next week is completely in the next month, stop
    if (week[6].getMonth() !== month && currentDay.getMonth() !== month && w >= 4) {
      break;
    }
  }

  return weeks;
}

/**
 * Calculates continuous horizontal spanning blocks and vertical track stacking slots
 * for multi-day events in a given 7-day week row.
 */
export function calculateEventSpans(
  events: UnifiedCalendarEvent[],
  weekDates: Date[]
): WeekEventSpan[] {
  if (!weekDates || weekDates.length !== 7) return [];

  const weekStart = new Date(
    weekDates[0].getFullYear(),
    weekDates[0].getMonth(),
    weekDates[0].getDate(),
    0,
    0,
    0,
    0
  );
  const weekEnd = new Date(
    weekDates[6].getFullYear(),
    weekDates[6].getMonth(),
    weekDates[6].getDate(),
    23,
    59,
    59,
    999
  );

  // Filter only multi-day or all-day events that intersect this week
  const intersectingSpans: Array<{
    event: UnifiedCalendarEvent;
    startColumn: number;
    endColumn: number;
    colSpan: number;
    isStartEdge: boolean;
    isEndEdge: boolean;
  }> = [];

  for (const event of events) {
    if (!isMultiDayEvent(event)) continue;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    // Check overlap: eventEnd >= weekStart and eventStart <= weekEnd
    if (eventEnd.getTime() < weekStart.getTime() || eventStart.getTime() > weekEnd.getTime()) {
      continue;
    }

    // Determine start column in this week (1 to 7)
    let startCol = 1;
    if (eventStart.getTime() <= weekStart.getTime()) {
      startCol = 1;
    } else {
      for (let i = 0; i < 7; i++) {
        if (isSameDayOrAfter(weekDates[i], eventStart)) {
          startCol = i + 1;
          break;
        }
      }
    }

    // Determine end column in this week (1 to 7)
    let endCol = 7;
    if (eventEnd.getTime() >= weekEnd.getTime()) {
      endCol = 7;
    } else {
      for (let i = 6; i >= 0; i--) {
        if (isSameDayOrBefore(weekDates[i], eventEnd)) {
          endCol = i + 1;
          break;
        }
      }
    }

    // Clamp values
    startCol = Math.max(1, Math.min(7, startCol));
    endCol = Math.max(startCol, Math.min(7, endCol));
    const colSpan = endCol - startCol + 1;

    // Visual edge continuity flags
    const isStartEdge =
      isSameDay(eventStart, weekDates[startCol - 1]) || eventStart.getTime() >= weekStart.getTime();
    const isEndEdge =
      isSameDay(eventEnd, weekDates[endCol - 1]) || eventEnd.getTime() <= weekEnd.getTime();

    intersectingSpans.push({
      event,
      startColumn: startCol,
      endColumn: endCol,
      colSpan,
      isStartEdge,
      isEndEdge,
    });
  }

  // Sort spanning blocks for clean track stacking:
  // 1. Earlier start column
  // 2. Larger colSpan (longer spans get prioritized lower track indices)
  // 3. Earliest start date
  intersectingSpans.sort((a, b) => {
    if (a.startColumn !== b.startColumn) {
      return a.startColumn - b.startColumn;
    }
    if (b.colSpan !== a.colSpan) {
      return b.colSpan - a.colSpan;
    }
    return new Date(a.event.start).getTime() - new Date(b.event.start).getTime();
  });

  // Track allocation (matrix of boolean tracks: trackMatrix[trackIndex][colIndex])
  const trackMatrix: boolean[][] = [];
  const result: WeekEventSpan[] = [];

  for (const span of intersectingSpans) {
    let assignedTrack = -1;

    for (let t = 0; t < trackMatrix.length; t++) {
      let isAvailable = true;
      for (let c = span.startColumn - 1; c <= span.endColumn - 1; c++) {
        if (trackMatrix[t][c]) {
          isAvailable = false;
          break;
        }
      }
      if (isAvailable) {
        assignedTrack = t;
        break;
      }
    }

    // If no existing track is open, create a new track row
    if (assignedTrack === -1) {
      assignedTrack = trackMatrix.length;
      trackMatrix.push(new Array(7).fill(false));
    }

    // Mark columns as occupied in assigned track
    for (let c = span.startColumn - 1; c <= span.endColumn - 1; c++) {
      trackMatrix[assignedTrack][c] = true;
    }

    result.push({
      event: span.event,
      startColumn: span.startColumn,
      colSpan: span.colSpan,
      isStartEdge: span.isStartEdge,
      isEndEdge: span.isEndEdge,
      trackIndex: assignedTrack,
    });
  }

  return result;
}

/**
 * Formats time string (e.g. "09:30 AM" or "14:00")
 */
export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

/**
 * Formats date range for display in detail panels and badges
 */
export function formatDateRange(startIso: string, endIso: string, isAllDay: boolean): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);

    if (isNaN(start.getTime())) return "";

    const startFormatted = start.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });

    if (isAllDay) {
      if (isSameDay(start, end)) {
        return `${startFormatted} (All day)`;
      }
      const endFormatted = end.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
      return `${startFormatted} - ${endFormatted} (All day)`;
    }

    const timeStart = formatTime(startIso);
    const timeEnd = formatTime(endIso);

    if (isSameDay(start, end)) {
      return `${startFormatted} • ${timeStart} - ${timeEnd}`;
    }

    const endFormatted = end.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });

    return `${startFormatted} ${timeStart} - ${endFormatted} ${timeEnd}`;
  } catch {
    return "";
  }
}

/**
 * Indonesian National Holidays (Hari Libur Nasional / Tanggal Merah) Dataset
 */
const INDONESIAN_HOLIDAYS_MAP: Record<string, string> = {
  // Fixed annual dates (MM-DD)
  "01-01": "Tahun Baru Masehi",
  "05-01": "Hari Buruh Internasional",
  "06-01": "Hari Lahir Pancasila",
  "08-17": "Hari Kemerdekaan RI (HUT RI)",
  "12-25": "Hari Raya Natal",

  // 2025 Dynamic / Religious Holidays (YYYY-MM-DD)
  "2025-01-27": "Isra Mi'raj Nabi Muhammad SAW",
  "2025-01-29": "Tahun Baru Imlek 2576 Kongzili",
  "2025-03-29": "Hari Suci Nyepi (Saka 1947)",
  "2025-03-31": "Hari Raya Idul Fitri 1446 H",
  "2025-04-01": "Hari Raya Idul Fitri 1446 H",
  "2025-04-18": "Wafat Yesus Kristus (Jumat Agung)",
  "2025-04-20": "Hari Paskah",
  "2025-05-12": "Hari Raya Waisak 2569 BE",
  "2025-05-29": "Kenaikan Yesus Kristus",
  "2025-06-06": "Hari Raya Idul Adha 1446 H",
  "2025-06-27": "Tahun Baru Islam 1447 H (1 Muharram)",
  "2025-09-05": "Maulid Nabi Muhammad SAW",

  // 2026 Dynamic / Religious Holidays (YYYY-MM-DD)
  "2026-01-16": "Isra Mi'raj Nabi Muhammad SAW",
  "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
  "2026-03-20": "Hari Raya Idul Fitri 1447 H",
  "2026-03-21": "Hari Raya Idul Fitri 1447 H / Hari Suci Nyepi",
  "2026-04-03": "Wafat Isa Almasih (Jumat Agung)",
  "2026-04-05": "Hari Paskah",
  "2026-05-14": "Kenaikan Isa Almasih",
  "2026-05-27": "Hari Raya Idul Adha 1447 H",
  "2026-05-31": "Hari Raya Waisak 2570 BE",
  "2026-06-17": "Tahun Baru Islam 1448 H (1 Muharram)",
  "2026-08-25": "Maulid Nabi Muhammad SAW",

  // 2027 Dynamic / Religious Holidays (YYYY-MM-DD)
  "2027-02-05": "Isra Mi'raj Nabi Muhammad SAW",
  "2027-02-06": "Tahun Baru Imlek 2578 Kongzili",
  "2027-03-10": "Hari Raya Idul Fitri 1448 H",
  "2027-03-11": "Hari Raya Idul Fitri 1448 H",
  "2027-03-26": "Wafat Yesus Kristus (Jumat Agung)",
  "2027-04-09": "Hari Suci Nyepi (Saka 1949)",
  "2027-05-06": "Kenaikan Yesus Kristus",
  "2027-05-16": "Hari Raya Idul Adha 1448 H",
  "2027-05-20": "Hari Raya Waisak 2571 BE",
  "2027-06-06": "Tahun Baru Islam 1449 H",
  "2027-08-15": "Maulid Nabi Muhammad SAW",
};

/**
 * Returns the holiday name if the date is an Indonesian National Holiday
 */
export function getIndonesianHoliday(date: Date): { name: string; isHoliday: boolean } | null {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  const fullKey = `${yyyy}-${mm}-${dd}`;
  const fixedKey = `${mm}-${dd}`;

  if (INDONESIAN_HOLIDAYS_MAP[fullKey]) {
    return { name: INDONESIAN_HOLIDAYS_MAP[fullKey], isHoliday: true };
  }
  if (INDONESIAN_HOLIDAYS_MAP[fixedKey]) {
    return { name: INDONESIAN_HOLIDAYS_MAP[fixedKey], isHoliday: true };
  }

  return null;
}

/**
 * Determines whether a date is considered a "Tanggal Merah" (Sunday or Public Holiday)
 */
export function isRedDate(date: Date): { isRed: boolean; isHoliday: boolean; name?: string } {
  const holiday = getIndonesianHoliday(date);
  const isSunday = date.getDay() === 0;

  if (holiday) {
    return { isRed: true, isHoliday: true, name: holiday.name };
  }
  if (isSunday) {
    return { isRed: true, isHoliday: false, name: "Hari Minggu" };
  }

  return { isRed: false, isHoliday: false };
}

