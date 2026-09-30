/**
 * Loose date entry: "8 oct", "8th October", "oct 8", "8/10", "tomorrow",
 * "next fri", "+7" all become an ISO date. Typing a date should never mean
 * fighting a picker.
 *
 * Deliberately not a natural-language library — those pull in a megabyte and
 * guess at things nobody typed. This handles the shapes a South African
 * business actually types, day-first, and returns null for anything it is not
 * sure about so the field can say so rather than saving a wrong date.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** Days in a month, leap years included. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftDays(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A two-digit year is this century: "26" is 2026. Nothing in this app deals in
 * dates before 2000, so the usual 50-year pivot would only cause surprises.
 */
function fullYear(value: number): number {
  if (value >= 1000) return value;
  if (value >= 100) return NaN;
  return 2000 + value;
}

/**
 * With no year typed, assume the current one — unless that puts the date more
 * than three months in the past, which almost always means the next one.
 * Typing "8 Jan" in December means next January; typing "15 Sep" in October
 * means the September just gone.
 */
function inferYear(today: string, month: number, day: number): number {
  const thisYear = Number(today.slice(0, 4));
  const candidate = iso(thisYear, month, day);
  if (!candidate) return thisYear;

  const cutoff = shiftDays(today, -92);
  return candidate < cutoff ? thisYear + 1 : thisYear;
}

export interface ParsedDate {
  iso: string;
  /** How it was read back, for the hint under the field. */
  label: string;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-ZA", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function describeDate(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return DAY_LABEL.format(d);
}

/**
 * Returns the ISO date, or null if the text is not a date this understands.
 * `today` is passed in rather than read from the clock so it is testable and
 * so the server and the browser never disagree about what "tomorrow" means.
 */
export function parseLooseDate(input: string, today: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  // Already ISO — the native picker and the database both speak this.
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (isoMatch) {
    return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // Words for a day near today.
  if (raw === "today" || raw === "now") return today;
  if (raw === "tomorrow" || raw === "tmr" || raw === "tom") return shiftDays(today, 1);
  if (raw === "yesterday") return shiftDays(today, -1);

  // "+7", "-3", "in 7 days", "7 days", "7d".
  const offset = /^(?:in\s+)?([+-]?\d{1,4})\s*(?:d|days?)?$/.exec(raw);
  if (offset && /[+-]|d/.test(raw)) {
    return shiftDays(today, Number(offset[1]));
  }

  // A bare number is a day of the month, which is how people type "the 8th".
  const bareDay = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(raw);
  if (bareDay) {
    const day = Number(bareDay[1]);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const thisMonth = iso(year, month, day);
    if (!thisMonth) return null;
    // The 8th when it is already the 20th means next month.
    if (thisMonth >= today) return thisMonth;
    const next = month === 12 ? iso(year + 1, 1, day) : iso(year, month + 1, day);
    return next ?? thisMonth;
  }

  // "next friday", "friday", "fri".
  const weekdayMatch = /^(?:(next|this|last)\s+)?([a-z]+)$/.exec(raw);
  if (weekdayMatch && WEEKDAYS[weekdayMatch[2]] !== undefined) {
    const target = WEEKDAYS[weekdayMatch[2]];
    const current = new Date(`${today}T00:00:00Z`).getUTCDay();
    const qualifier = weekdayMatch[1];

    if (qualifier === "last") {
      let back = current - target;
      if (back <= 0) back += 7;
      return shiftDays(today, -back);
    }
    let forward = target - current;
    if (forward <= 0) forward += 7;
    // "next friday" means the one after this coming Friday only when this week
    // still has one left; otherwise both readings land on the same day.
    if (qualifier === "next" && forward < 7) forward += 7;
    return shiftDays(today, forward);
  }

  // "8 oct", "8th october 2026", "oct 8", "october 8th 26".
  const words = raw.replace(/(\d)(st|nd|rd|th)\b/g, "$1").split(/[\s,./-]+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 3) {
    let day: number | null = null;
    let month: number | null = null;
    let year: number | null = null;

    for (const word of words) {
      if (MONTHS[word] !== undefined) {
        month = MONTHS[word];
      } else if (/^\d+$/.test(word)) {
        const n = Number(word);
        if (word.length === 4) year = n;
        else if (day === null && n >= 1 && n <= 31) day = n;
        else if (year === null) year = fullYear(n);
      } else {
        return null;
      }
    }

    if (month !== null && day !== null) {
      const resolved = year ?? inferYear(today, month, day);
      return iso(resolved, month, day);
    }
  }

  // Numeric, day first: "8/10", "08-10-2026", "8.10.26".
  const numeric = /^(\d{1,2})[\s./-](\d{1,2})(?:[\s./-](\d{2,4}))?$/.exec(raw);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = numeric[3] ? fullYear(Number(numeric[3])) : inferYear(today, month, day);
    if (!Number.isFinite(year)) return null;
    return iso(year, month, day);
  }

  return null;
}
