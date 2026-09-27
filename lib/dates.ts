export const TIMEZONE = "Africa/Johannesburg";

/** "today" in Africa/Johannesburg as an ISO date string (YYYY-MM-DD). */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function weekStartIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/**
 * FNB statement month: the cycle runs from the 4th of a month to the 3rd of the
 * next, and is labelled with the month it starts in. Shifting the date back three
 * days and truncating to the month reproduces Dan's statement totals exactly.
 */
export const STATEMENT_DAY_OFFSET = 3;

export function statementMonth(iso: string): string {
  return addDaysIso(iso, -STATEMENT_DAY_OFFSET).slice(0, 7);
}

export function calendarMonth(iso: string): string {
  return iso.slice(0, 7);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-06" -> "Jun" */
export function monthLabel(month: string): string {
  const m = Number(month.slice(5, 7));
  return MONTHS[m - 1] ?? month;
}

/** "2026-06" -> "Jun 2026" */
export function monthLabelLong(month: string): string {
  return `${monthLabel(month)} ${month.slice(0, 4)}`;
}

export function prevMonth(month: string, n = 1): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 - n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

/** The n statement months ending with `month`, oldest first. */
export function monthRange(month: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => prevMonth(month, n - 1 - i));
}

export function formatDate(iso: string | null | undefined, style: "short" | "long" = "short"): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getUTCDate();
  const mon = MONTHS[d.getUTCMonth()];
  if (style === "long") {
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
    const monthFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ][d.getUTCMonth()];
    return `${weekday} ${day} ${monthFull} ${d.getUTCFullYear()}`;
  }
  return `${day} ${mon} ${d.getUTCFullYear()}`;
}

export function formatDateCompact(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hour12: false }).format(now),
  );
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/** Days from today until a deadline; negative once it has passed. */
export function daysToDeadline(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  return daysBetween(todayIso(), deadline);
}
