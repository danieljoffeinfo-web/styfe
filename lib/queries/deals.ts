import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Deal, DealAddon } from "@/lib/types";

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

/** Add-ons attached to deals. Omit the ids to load every deal's. */
export async function getDealAddons(dealIds?: string[]): Promise<DealAddon[]> {
  const supabase = await createClient();
  let query = supabase.from("deal_addons").select("*").order("created_at");
  if (dealIds) {
    if (dealIds.length === 0) return [];
    query = query.in("deal_id", dealIds);
  }
  const { data } = await query;
  return data ?? [];
}

/** Annual contract value of an open deal, used for pipeline weight. */
export function dealValueZar(deal: Deal): { monthly: number; onceOff: number } {
  return {
    monthly: Number(deal.monthly_value_zar ?? 0) * deal.units,
    onceOff: Number(deal.once_off_value_zar ?? 0),
  };
}
