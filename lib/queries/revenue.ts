import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import { calendarMonth, monthRange, todayIso } from "@/lib/dates";
import type { MonthPoint } from "@/lib/queries/money";
import type { RevenueEntry } from "@/lib/types";

export async function getRevenueEntries(limit = 500): Promise<RevenueEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revenue_entries")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Revenue by calendar month, oldest first, empty months filled in. Anchored on
 * the current month rather than the last month with data, so a quiet month
 * reads as quiet instead of vanishing off the end of the chart.
 */
export async function getMonthlyRevenue(months: number, endMonth?: string): Promise<MonthPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_monthly_revenue")
    .select("month, total_zar, recurring_zar, once_off_zar")
    .order("month");

  const byMonth = new Map(
    (data ?? []).map((r: { month: string }) => [String(r.month).slice(0, 7), r]),
  );
  const end = endMonth ?? calendarMonth(todayIso());

  return monthRange(end, months).map((month) => {
    const row = byMonth.get(month) as
      | { total_zar?: unknown; recurring_zar?: unknown; once_off_zar?: unknown }
      | undefined;
    return {
      month,
      label: month,
      recurringCents: toCents(row?.recurring_zar as never),
      onceOffCents: toCents(row?.once_off_zar as never),
      totalCents: toCents(row?.total_zar as never),
    };
  });
}
