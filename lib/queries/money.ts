import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import { calendarMonth, monthRange, statementMonth, todayIso } from "@/lib/dates";
import { merchantName } from "./money.client";
import type {
  Category,
  MonthlyIncome,
  MonthlySpend,
  Offering,
  PathSegment,
  Subscription,
  Transaction,
} from "@/lib/types";

export interface MrrSummary {
  mrrCents: number;
  unitCostCents: number;
  subscriptionCount: number;
  unitCount: number;
}

export async function getMrr(): Promise<MrrSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_mrr")
    .select("mrr_zar, unit_cost_zar, subscription_count, unit_count")
    .maybeSingle();

  return {
    mrrCents: toCents(data?.mrr_zar),
    unitCostCents: toCents(data?.unit_cost_zar),
    subscriptionCount: data?.subscription_count ?? 0,
    unitCount: data?.unit_count ?? 0,
  };
}

export interface MonthPoint {
  month: string;
  label: string;
  recurringCents: number;
  onceOffCents: number;
  totalCents: number;
}

/** Income by FNB statement month, oldest first, with empty months filled in. */
export async function getMonthlyIncome(months: number, endMonth?: string): Promise<MonthPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_monthly_income")
    .select("month, total_zar, recurring_zar, once_off_zar")
    .order("month");

  const rows = (data ?? []) as MonthlyIncome[];
  const byMonth = new Map(rows.map((r) => [String(r.month).slice(0, 7), r]));

  // Default to the last statement month that has data, so the chart is not
  // dominated by empty months when Dan has not imported recently.
  const latest = rows.length ? String(rows[rows.length - 1].month).slice(0, 7) : statementMonth(todayIso());
  const end = endMonth ?? latest;

  return monthRange(end, months).map((month) => {
    const row = byMonth.get(month);
    return {
      month,
      label: month,
      recurringCents: toCents(row?.recurring_zar),
      onceOffCents: toCents(row?.once_off_zar),
      totalCents: toCents(row?.total_zar),
    };
  });
}

/**
 * Income by calendar month, for the Overview.
 *
 * The statement month is right where the numbers have to reconcile against
 * FNB (Revenue, Spend). On the dashboard "this month" should mean the month
 * on the calendar, so this reads v_monthly_income_calendar and anchors on the
 * current month rather than on the last month that happens to have data —
 * a quiet month should read as a quiet month, not disappear.
 */
export async function getCalendarMonthlyIncome(
  months: number,
  endMonth?: string,
): Promise<MonthPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_monthly_income_calendar")
    .select("month, total_zar, recurring_zar, once_off_zar")
    .order("month");

  const rows = (data ?? []) as MonthlyIncome[];
  const byMonth = new Map(rows.map((r) => [String(r.month).slice(0, 7), r]));
  const end = endMonth ?? calendarMonth(todayIso());

  return monthRange(end, months).map((month) => {
    const row = byMonth.get(month);
    return {
      month,
      label: month,
      recurringCents: toCents(row?.recurring_zar),
      onceOffCents: toCents(row?.once_off_zar),
      totalCents: toCents(row?.total_zar),
    };
  });
}

export interface SpendRow {
  month: string;
  group: string;
  category: string;
  spendCents: number;
  txCount: number;
}

export async function getMonthlySpend(): Promise<SpendRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_monthly_spend")
    .select("month, category_group, category, spend_zar, tx_count")
    .order("month");

  return ((data ?? []) as MonthlySpend[]).map((r) => ({
    month: String(r.month).slice(0, 7),
    group: r.category_group,
    category: r.category,
    spendCents: toCents(r.spend_zar),
    txCount: r.tx_count,
  }));
}

/** Personal (non-business, non-internal) spend for one statement month. */
export function personalSpendForMonth(rows: SpendRow[], month: string): number {
  return rows
    .filter((r) => r.month === month && r.group === "personal")
    .reduce((acc, r) => acc + r.spendCents, 0);
}

/** Six-month average per category, biggest first. */
export function spendAverages(rows: SpendRow[], months: string[], groups: string[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!months.includes(row.month)) continue;
    if (!groups.includes(row.group)) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.spendCents);
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, averageCents: Math.round(cents / months.length) }))
    .sort((a, b) => b.averageCents - a.averageCents);
}

export interface PathSegmentProgress {
  segment: PathSegment;
  targetCents: number;
  actualCents: number;
  liveUnits: number;
  targetUnits: number | null;
  detail: string;
}

/**
 * Path to R50k. Actual comes from live subscriptions for subscription segments
 * and from the trailing three-month average of once-off income for project work.
 */
export function pathToTarget(
  segments: PathSegment[],
  subscriptions: Subscription[],
  offerings: Offering[],
  income: MonthPoint[],
): PathSegmentProgress[] {
  const offeringById = new Map(offerings.map((o) => [o.id, o]));
  const active = subscriptions.filter((s) => s.status === "active");

  const recent = income.slice(-3);
  const projectAverageCents = recent.length
    ? Math.round(recent.reduce((acc, m) => acc + m.onceOffCents, 0) / recent.length)
    : 0;

  return segments.map((segment) => {
    const targetCents = toCents(segment.target_zar);
    let actualCents = 0;
    let liveUnits = 0;
    let detail: string;

    if (segment.source === "subscriptions") {
      const matching = active.filter((sub) => {
        const offering = offeringById.get(sub.offering_id);
        if (!offering) return false;
        if (segment.offering_slug) return offering.slug === segment.offering_slug;
        if (segment.category) return offering.category === segment.category;
        return false;
      });
      actualCents = matching.reduce((acc, s) => acc + toCents(s.monthly_fee_zar) * s.units, 0);
      liveUnits = matching.reduce((acc, s) => acc + s.units, 0);
      detail =
        segment.target_units && segment.target_units > 1
          ? `${liveUnits}/${segment.target_units}`
          : liveUnits > 0
            ? "live"
            : `0/${segment.target_units ?? 1}`;
    } else if (segment.source === "project_average") {
      actualCents = projectAverageCents;
      detail = "avg";
    } else {
      detail = "manual";
    }

    return { segment, targetCents, actualCents, liveUnits, targetUnits: segment.target_units, detail };
  });
}

export interface TransactionFilter {
  month?: string;
  category?: string;
  group?: string;
  search?: string;
  includeInternal?: boolean;
  limit?: number;
}

export async function getTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const supabase = await createClient();
  let query = supabase.from("transactions").select("*").order("date", { ascending: false });

  if (!filter.includeInternal) query = query.eq("is_internal", false);
  if (filter.category) query = query.eq("category", filter.category);
  if (filter.search) query = query.ilike("description", `%${filter.search}%`);
  if (filter.month) {
    // Statement month: the 4th of `month` through the 3rd of the next month.
    const start = `${filter.month}-04`;
    const next = new Date(`${filter.month}-01T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const end = `${next.toISOString().slice(0, 7)}-03`;
    query = query.gte("date", start).lte("date", end);
  }

  const { data } = await query.limit(filter.limit ?? 400);
  return data ?? [];
}

/** Merchant-level rollup for the Spend page. */
export { merchantName };

export function topMerchants(transactions: Transaction[], categories: Category[], limit = 10) {
  const personal = new Set(
    categories.filter((c) => c.group === "personal" || c.group === "business").map((c) => c.slug),
  );
  const totals = new Map<string, { cents: number; count: number }>();

  for (const tx of transactions) {
    if (tx.is_internal) continue;
    if (!personal.has(tx.category)) continue;
    const cents = toCents(tx.amount_zar);
    if (cents >= 0) continue;
    const key = merchantName(tx.description);
    const current = totals.get(key) ?? { cents: 0, count: 0 };
    current.cents += -cents;
    current.count += 1;
    totals.set(key, current);
  }

  return [...totals.entries()]
    .map(([merchant, v]) => ({ merchant, spendCents: v.cents, count: v.count }))
    .sort((a, b) => b.spendCents - a.spendCents)
    .slice(0, limit);
}

export function statementMonths(count: number, endMonth?: string): string[] {
  return monthRange(endMonth ?? statementMonth(todayIso()), count);
}
