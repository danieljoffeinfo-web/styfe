/**
 * Money is stored as numeric(12,2) in Postgres and arrives over PostgREST as a
 * JSON number or a string. Every calculation in the app runs on integer cents so
 * that no float rounding ever reaches a total the user reads.
 */

export type MoneyInput = number | string | null | undefined;

/** Parse any money value into integer cents. Returns 0 for null/blank/NaN. */
export function toCents(value: MoneyInput): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[\s,]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Cents back to a rand value suitable for writing to a numeric(12,2) column. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function sumCents(values: MoneyInput[]): number {
  return values.reduce<number>((acc, v) => acc + toCents(v), 0);
}

/** R16,900 — no decimals unless the amount has cents and `cents` is allowed. */
export function formatZar(
  value: MoneyInput,
  opts: { cents?: boolean; sign?: boolean; symbol?: boolean } = {},
): string {
  const { cents = false, sign = false, symbol = true } = opts;
  const c = toCents(value);
  const negative = c < 0;
  const abs = Math.abs(c);
  const showCents = cents && abs % 100 !== 0;
  const body = (abs / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  const prefix = symbol ? "R" : "";
  if (negative) return `-${prefix}${body}`;
  if (sign) return `+${prefix}${body}`;
  return `${prefix}${body}`;
}

/** Compact form for chart labels: 72.1k */
export function formatZarCompact(value: MoneyInput): string {
  const c = toCents(value);
  const rands = c / 100;
  const abs = Math.abs(rands);
  if (abs >= 1000) {
    const k = rands / 1000;
    const s = Math.abs(k) >= 100 ? k.toFixed(0) : k.toFixed(1);
    return `${s.replace(/\.0$/, "")}k`;
  }
  return rands.toFixed(0);
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Add VAT to a cents subtotal using the owner's VAT settings. */
export function vatOnCents(subtotalCents: number, enabled: boolean, rate: number): number {
  if (!enabled) return 0;
  return Math.round(subtotalCents * rate);
}
