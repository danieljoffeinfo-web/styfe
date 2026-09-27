import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Offering, OfferingStats, OfferingTier } from "@/lib/types";

export async function getOfferings(includeArchived = false): Promise<Offering[]> {
  const supabase = await createClient();
  let query = supabase.from("offerings").select("*").order("sort").order("name");
  if (!includeArchived) query = query.eq("status", "active");
  const { data } = await query;
  return data ?? [];
}

export async function getOfferingTiers(offeringIds?: string[]): Promise<OfferingTier[]> {
  const supabase = await createClient();
  let query = supabase.from("offering_tiers").select("*").order("sort");
  if (offeringIds) {
    if (offeringIds.length === 0) return [];
    query = query.in("offering_id", offeringIds);
  }
  const { data } = await query;
  return data ?? [];
}

export async function getOfferingStats(): Promise<OfferingStats[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_offering_stats").select("*");
  return data ?? [];
}

export async function getOfferingBySlug(slug: string): Promise<Offering | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("offerings").select("*").eq("slug", slug).maybeSingle<Offering>();
  return data;
}

/** Offerings + tiers + stats, the shape the catalogue and every picker needs. */
export async function getCatalogue(includeArchived = false) {
  const [offerings, stats] = await Promise.all([getOfferings(includeArchived), getOfferingStats()]);
  const tiers = await getOfferingTiers(offerings.map((o) => o.id));
  const statsById = new Map(stats.map((s) => [s.offering_id, s]));
  const tiersByOffering = new Map<string, OfferingTier[]>();
  for (const tier of tiers) {
    const list = tiersByOffering.get(tier.offering_id) ?? [];
    list.push(tier);
    tiersByOffering.set(tier.offering_id, list);
  }
  return offerings.map((offering) => ({
    offering,
    tiers: tiersByOffering.get(offering.id) ?? [],
    stats: statsById.get(offering.id) ?? null,
  }));
}

export type CatalogueEntry = Awaited<ReturnType<typeof getCatalogue>>[number];
