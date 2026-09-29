"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import {
  parseList,
  parsePortfolio,
  zOfferingType,
  zMoney,
  zInt,
  zText,
  zRequiredText,
  zOfferingKind,
  zOfferingStatus,
  zPricingModel,
  zodMessage,
} from "./schemas";

const offeringSchema = z.object({
  name: zRequiredText,
  kind: zOfferingKind,
  offering_type: zOfferingType,
  category: zRequiredText,
  pricing_model: zPricingModel,
  setup_fee_zar: zMoney,
  monthly_fee_zar: zMoney,
  unit_label: zText,
  unit_cost_monthly_zar: zMoney,
  delivery_days: zInt,
  description: zText,
  ideal_for: zText,
  color: zText,
});

function readOffering(formData: FormData) {
  return offeringSchema.safeParse({
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "service",
    offering_type: formData.get("offering_type") ?? "standard",
    category: formData.get("category") ?? "Other",
    pricing_model: formData.get("pricing_model") ?? "once_off",
    setup_fee_zar: formData.get("setup_fee_zar"),
    monthly_fee_zar: formData.get("monthly_fee_zar"),
    unit_label: formData.get("unit_label"),
    unit_cost_monthly_zar: formData.get("unit_cost_monthly_zar"),
    delivery_days: formData.get("delivery_days"),
    description: formData.get("description"),
    ideal_for: formData.get("ideal_for"),
    color: formData.get("color"),
  });
}

/** The editors on the offering sheet, read the same way for create and update. */
function readLists(formData: FormData) {
  return {
    deliverables: parseList(formData.getAll("deliverables")),
    excludes: parseList(formData.getAll("excludes")),
    portfolio: parsePortfolio(
      formData.getAll("portfolio_label"),
      formData.getAll("portfolio_url"),
    ),
  };
}

/** Fees that do not apply to the chosen pricing model are cleared, not kept. */
function normaliseFees(values: z.infer<typeof offeringSchema>) {
  // A custom build is priced per deal, so it never keeps a list price however
  // the pricing model is left set.
  const model = values.offering_type === "custom" ? "quote" : values.pricing_model;
  return {
    pricing_model: model,
    setup_fee_zar: model === "quote" ? null : values.setup_fee_zar,
    monthly_fee_zar: model === "once_off" || model === "quote" ? null : values.monthly_fee_zar,
    unit_label: model === "per_unit_monthly" ? values.unit_label : null,
    unit_cost_monthly_zar: model === "per_unit_monthly" ? values.unit_cost_monthly_zar : null,
  };
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  base: string,
  ignoreId?: string,
) {
  const slug = base || "offering";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    let query = supabase.from("offerings").select("id").eq("slug", candidate);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

export async function createOffering(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = readOffering(formData);
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const values = parsed.data;
    const lists = readLists(formData);

    return withUser(async (supabase, userId) => {
      const slug = await uniqueSlug(supabase, slugify(values.name));
      const { data: last } = await supabase
        .from("offerings")
        .select("sort")
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from("offerings").insert({
        owner_id: userId,
        slug,
        name: values.name,
        kind: values.kind,
        offering_type: values.offering_type,
        category: values.category,
        ...normaliseFees(values),
        delivery_days: values.delivery_days,
        description: values.description,
        ideal_for: values.ideal_for,
        ...lists,
        color: values.color,
        sort: ((last?.sort as number | undefined) ?? 0) + 10,
      });
      if (error) return fail(error.message);

      revalidatePath("/offerings");
      revalidatePath("/");
      return ok(`${values.name} added.`);
    });
  });
}

export async function updateOffering(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Missing offering.");
    const parsed = readOffering(formData);
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const values = parsed.data;
    const lists = readLists(formData);
    const status = zOfferingStatus.safeParse(formData.get("status") ?? "active");

    return withUser(async (supabase) => {
      const { error } = await supabase
        .from("offerings")
        .update({
          name: values.name,
          kind: values.kind,
          offering_type: values.offering_type,
          category: values.category,
          ...normaliseFees(values),
          delivery_days: values.delivery_days,
          description: values.description,
          ideal_for: values.ideal_for,
          ...lists,
          color: values.color,
          status: status.success ? status.data : "active",
        })
        .eq("id", id);
      if (error) return fail(error.message);

      revalidatePath("/offerings");
      revalidatePath("/");
      return ok("Saved.");
    });
  });
}

export async function setOfferingStatus(id: string, status: "active" | "archived"): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("offerings").update({ status }).eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/offerings");
      return ok(status === "archived" ? "Archived." : "Restored.");
    }),
  );
}

export async function deleteOffering(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      // Anything with history is archived instead — the FK on subscriptions is
      // ON DELETE RESTRICT, so this fails loudly rather than losing revenue data.
      const { count } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("offering_id", id);
      if ((count ?? 0) > 0) {
        return fail("This offering has subscriptions. Archive it instead.");
      }
      const { error } = await supabase.from("offerings").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/offerings");
      return ok("Deleted.");
    }),
  );
}

export async function duplicateOffering(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase, userId) => {
      const { data: source, error: readError } = await supabase
        .from("offerings")
        .select("*")
        .eq("id", id)
        .single();
      if (readError || !source) return fail(readError?.message ?? "Offering not found.");

      const name = `${source.name} (copy)`;
      const slug = await uniqueSlug(supabase, slugify(name));
      const { data: created, error } = await supabase
        .from("offerings")
        .insert({
          owner_id: userId,
          slug,
          name,
          kind: source.kind,
          offering_type: source.offering_type,
          category: source.category,
          pricing_model: source.pricing_model,
          setup_fee_zar: source.setup_fee_zar,
          monthly_fee_zar: source.monthly_fee_zar,
          unit_label: source.unit_label,
          unit_cost_monthly_zar: source.unit_cost_monthly_zar,
          delivery_days: source.delivery_days,
          description: source.description,
          ideal_for: source.ideal_for,
          deliverables: source.deliverables,
          excludes: source.excludes,
          portfolio: source.portfolio,
          color: source.color,
          sort: (source.sort ?? 0) + 1,
        })
        .select("id")
        .single();
      if (error || !created) return fail(error?.message ?? "Could not duplicate.");

      const { data: tiers } = await supabase.from("offering_tiers").select("*").eq("offering_id", id);
      if (tiers?.length) {
        await supabase.from("offering_tiers").insert(
          tiers.map((tier) => ({
            owner_id: userId,
            offering_id: created.id,
            name: tier.name,
            pricing_model: tier.pricing_model,
            setup_fee_zar: tier.setup_fee_zar,
            monthly_fee_zar: tier.monthly_fee_zar,
            description: tier.description,
            deliverables: tier.deliverables,
            sort: tier.sort,
          })),
        );
      }

      revalidatePath("/offerings");
      return ok(`${name} created.`);
    }),
  );
}

export async function reorderOfferings(ids: string[]): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      for (const [index, id] of ids.entries()) {
        const { error } = await supabase
          .from("offerings")
          .update({ sort: (index + 1) * 10 })
          .eq("id", id);
        if (error) return fail(error.message);
      }
      revalidatePath("/offerings");
      return ok();
    }),
  );
}

const tierSchema = z.object({
  offering_id: z.string().uuid(),
  name: zRequiredText,
  pricing_model: zPricingModel,
  setup_fee_zar: zMoney,
  monthly_fee_zar: zMoney,
  description: zText,
});

export async function saveTier(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = tierSchema.safeParse({
      offering_id: formData.get("offering_id"),
      name: formData.get("name") ?? "",
      pricing_model: formData.get("pricing_model") ?? "once_off",
      setup_fee_zar: formData.get("setup_fee_zar"),
      monthly_fee_zar: formData.get("monthly_fee_zar"),
      description: formData.get("description"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const deliverables = parseList(formData.getAll("deliverables"));

    return withUser(async (supabase, userId) => {
      const payload = { ...parsed.data, deliverables };
      const { error } = id
        ? await supabase.from("offering_tiers").update(payload).eq("id", id)
        : await supabase.from("offering_tiers").insert({ ...payload, owner_id: userId });
      if (error) return fail(error.message);
      revalidatePath("/offerings");
      return ok("Tier saved.");
    });
  });
}

export async function deleteTier(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("offering_tiers").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/offerings");
      return ok("Tier removed.");
    }),
  );
}
