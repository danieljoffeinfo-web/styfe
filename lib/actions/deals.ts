"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zDate, zDealStage, zInt, zMoney, zPricingModel, zRequiredText, zText, zodMessage } from "./schemas";

const dealSchema = z.object({
  title: zRequiredText,
  offering_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
  tier_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
  client_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
  contact_name: zText,
  contact_phone: zText,
  contact_email: zText,
  stage: zDealStage,
  units: zInt.transform((v) => (v && v > 0 ? v : 1)),
  monthly_value_zar: zMoney,
  once_off_value_zar: zMoney,
  next_step: zText,
  next_step_at: zDate,
  notes: zText,
  scope: zText,
});

/**
 * The add-on rows post one field per column in matching order, the same
 * convention the deliverables and portfolio editors use. A row without an
 * offering is a half-filled picker and is dropped rather than saved.
 */
function readAddons(formData: FormData) {
  const offeringIds = formData.getAll("addon_offering_id");
  const qtys = formData.getAll("addon_qty");
  const prices = formData.getAll("addon_price");
  const models = formData.getAll("addon_pricing_model");

  const rows: { offering_id: string; qty: number; price_zar: number | null; pricing_model: string }[] = [];
  for (let i = 0; i < offeringIds.length; i += 1) {
    const offeringId = String(offeringIds[i] ?? "").trim();
    if (!offeringId) continue;

    const qty = Number(String(qtys[i] ?? "1"));
    const price = zMoney.safeParse(prices[i]);
    const model = zPricingModel.safeParse(String(models[i] ?? "once_off"));

    rows.push({
      offering_id: offeringId,
      qty: Number.isInteger(qty) && qty > 0 ? qty : 1,
      price_zar: price.success ? price.data : null,
      pricing_model: model.success ? model.data : "once_off",
    });
  }
  return rows.slice(0, 20);
}

export async function saveDeal(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = dealSchema.safeParse({
      title: formData.get("title") ?? "",
      offering_id: formData.get("offering_id") ?? "",
      tier_id: formData.get("tier_id") ?? "",
      client_id: formData.get("client_id") ?? "",
      contact_name: formData.get("contact_name"),
      contact_phone: formData.get("contact_phone"),
      contact_email: formData.get("contact_email"),
      stage: formData.get("stage") ?? "lead",
      units: formData.get("units"),
      monthly_value_zar: formData.get("monthly_value_zar"),
      once_off_value_zar: formData.get("once_off_value_zar"),
      next_step: formData.get("next_step"),
      next_step_at: formData.get("next_step_at"),
      notes: formData.get("notes"),
      scope: formData.get("scope"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const addons = readAddons(formData);

    const payload = {
      ...parsed.data,
      won_at: parsed.data.stage === "won" ? todayIso() : null,
    };

    return withUser(async (supabase, userId) => {
      // A custom build is nothing without its brief, so refuse to save one
      // empty rather than let it reach an invoice as a bare title.
      if (payload.offering_id) {
        const { data: offering } = await supabase
          .from("offerings")
          .select("offering_type, name")
          .eq("id", payload.offering_id)
          .maybeSingle();
        if (offering?.offering_type === "custom" && !payload.scope) {
          return fail(`${offering.name} is a custom build — write the scope first.`);
        }
      }

      const { data: saved, error } = id
        ? await supabase.from("deals").update(payload).eq("id", id).select("id").single()
        : await supabase
            .from("deals")
            .insert({ ...payload, owner_id: userId })
            .select("id")
            .single();
      if (error || !saved) return fail(error?.message ?? "Could not save the deal.");

      // Add-ons are replaced wholesale: the form always posts the full set, so
      // a removed row has to disappear rather than linger.
      const { error: clearError } = await supabase.from("deal_addons").delete().eq("deal_id", saved.id);
      if (clearError) return fail(clearError.message);

      if (addons.length) {
        const { error: addonError } = await supabase
          .from("deal_addons")
          .insert(addons.map((a) => ({ ...a, deal_id: saved.id, owner_id: userId })));
        if (addonError) return fail(addonError.message);
      }

      revalidatePath("/pipeline");
      revalidatePath("/");
      return ok("Deal saved.");
    });
  });
}

export async function moveDeal(id: string, stage: string, sort?: number): Promise<ActionResult> {
  return guard(async () => {
    const parsed = zDealStage.safeParse(stage);
    if (!parsed.success) return fail("Unknown stage.");

    return withUser(async (supabase) => {
      const update: Record<string, unknown> = { stage: parsed.data };
      if (typeof sort === "number") update.sort = sort;
      if (parsed.data === "won") update.won_at = todayIso();
      if (parsed.data !== "won") update.won_at = null;

      const { error } = await supabase.from("deals").update(update).eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/pipeline");
      revalidatePath("/");
      return ok();
    });
  });
}

export async function markDealLost(id: string, reason: string | null): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase
        .from("deals")
        .update({ stage: "lost", lost_reason: reason, won_at: null })
        .eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/pipeline");
      return ok("Marked lost.");
    }),
  );
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/pipeline");
      return ok("Deal deleted.");
    }),
  );
}

/**
 * What winning a deal should produce. The Won flow asks before writing, so this
 * is a read used by the UI, not a mutation.
 */
export type WonFollowUp = "subscription" | "invoice" | "none";

export async function wonFollowUpFor(dealId: string): Promise<WonFollowUp> {
  return withUser(async (supabase) => {
    const { data: deal } = await supabase
      .from("deals")
      .select("offering_id, client_id")
      .eq("id", dealId)
      .maybeSingle();
    if (!deal?.offering_id) return "none";

    const { data: offering } = await supabase
      .from("offerings")
      .select("pricing_model")
      .eq("id", deal.offering_id)
      .maybeSingle();
    if (!offering) return "none";

    if (offering.pricing_model === "monthly" || offering.pricing_model === "per_unit_monthly") {
      return "subscription";
    }
    return "invoice";
  });
}
