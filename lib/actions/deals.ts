"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zDate, zDealStage, zInt, zMoney, zRequiredText, zText, zodMessage } from "./schemas";

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
});

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
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    const payload = {
      ...parsed.data,
      won_at: parsed.data.stage === "won" ? todayIso() : null,
    };

    return withUser(async (supabase, userId) => {
      const { error } = id
        ? await supabase.from("deals").update(payload).eq("id", id)
        : await supabase.from("deals").insert({ ...payload, owner_id: userId });
      if (error) return fail(error.message);
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
