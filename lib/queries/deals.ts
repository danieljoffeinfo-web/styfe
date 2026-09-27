import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Deal } from "@/lib/types";

export async function getDeals(): Promise<Deal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("sort")
    .order("created_at");
  return data ?? [];
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*").eq("id", id).maybeSingle<Deal>();
  return data;
}

/** Annual contract value of an open deal, used for pipeline weight. */
export function dealValueZar(deal: Deal): { monthly: number; onceOff: number } {
  return {
    monthly: Number(deal.monthly_value_zar ?? 0) * deal.units,
    onceOff: Number(deal.once_off_value_zar ?? 0),
  };
}
