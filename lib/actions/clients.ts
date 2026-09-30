"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import {
  zBillingType,
  zClientRelationship,
  zClientStatus,
  zDate,
  zHexColor,
  zInt,
  zMoney,
  zRequiredText,
  zSubscriptionStatus,
  zText,
  zodMessage,
} from "./schemas";

const clientSchema = z.object({
  name: zRequiredText,
  contact_name: zText,
  contact_phone: zText,
  contact_email: zText,
  relationship: zClientRelationship,
  billing_type: zBillingType,
  status: zClientStatus,
  notes: zText,
  color: zHexColor,
  billing_email: zText,
  billing_address: zText,
  vat_number: zText,
  registration_number: zText,
  // Blank means the default 30 days rather than "due immediately".
  payment_terms_days: zInt.transform((v) => (v !== null && v >= 0 && v <= 365 ? v : 30)),
});

function readClient(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name") ?? "",
    contact_name: formData.get("contact_name"),
    contact_phone: formData.get("contact_phone"),
    contact_email: formData.get("contact_email"),
    relationship: formData.get("relationship") ?? "project",
    billing_type: formData.get("billing_type") ?? "once_off",
    status: formData.get("status") ?? "active",
    notes: formData.get("notes"),
    color: formData.get("color"),
    billing_email: formData.get("billing_email"),
    billing_address: formData.get("billing_address"),
    vat_number: formData.get("vat_number"),
    registration_number: formData.get("registration_number"),
    payment_terms_days: formData.get("payment_terms_days"),
  });
}

export async function saveClient(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = readClient(formData);
    if (!parsed.success) return fail(zodMessage(parsed.error));

    return withUser(async (supabase, userId) => {
      if (id) {
        const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);
        if (error) return fail(error.message);
      } else {
        const base = slugify(parsed.data.name) || "client";
        let slug = base;
        for (let i = 1; i < 50; i += 1) {
          const { data: clash } = await supabase.from("clients").select("id").eq("slug", slug).maybeSingle();
          if (!clash) break;
          slug = `${base}-${i + 1}`;
        }
        const { error } = await supabase.from("clients").insert({ ...parsed.data, slug, owner_id: userId });
        if (error) return fail(error.message);
      }
      revalidatePath("/clients");
      revalidatePath("/invoices");
      revalidatePath("/");
      return ok("Saved.");
    });
  });
}

/**
 * Clients are deletable, but not at the cost of the books: an invoice or a
 * subscription pointing at one is history that still has to resolve, so the
 * delete is refused with the reason rather than cascading. Revenue entries and
 * admin items are ON DELETE SET NULL, so those survive the client going away.
 */
export async function deleteClient(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const [{ count: invoices }, { count: subscriptions }] = await Promise.all([
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", id),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("client_id", id),
      ]);

      const blockers = [
        invoices ? `${invoices} invoice${invoices === 1 ? "" : "s"}` : null,
        subscriptions ? `${subscriptions} subscription${subscriptions === 1 ? "" : "s"}` : null,
      ].filter(Boolean);

      if (blockers.length) {
        return fail(
          `This client still has ${blockers.join(" and ")}. Remove or reassign them first, or set the client to ended instead.`,
        );
      }

      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) return fail(error.message);

      revalidatePath("/clients");
      revalidatePath("/admin");
      revalidatePath("/");
      return ok("Client deleted.");
    }),
  );
}

const subscriptionSchema = z.object({
  client_id: z.string().uuid("Pick a client"),
  offering_id: z.string().uuid("Pick an offering"),
  tier_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
  units: zInt.transform((v) => (v && v > 0 ? v : 1)),
  monthly_fee_zar: zMoney.transform((v) => v ?? 0),
  started_at: zDate,
  ended_at: zDate,
  status: zSubscriptionStatus,
  notes: zText,
});

export async function saveSubscription(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = subscriptionSchema.safeParse({
      client_id: formData.get("client_id"),
      offering_id: formData.get("offering_id"),
      tier_id: formData.get("tier_id") ?? "",
      units: formData.get("units"),
      monthly_fee_zar: formData.get("monthly_fee_zar"),
      started_at: formData.get("started_at"),
      ended_at: formData.get("ended_at"),
      status: formData.get("status") ?? "active",
      notes: formData.get("notes"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    const payload = {
      ...parsed.data,
      started_at: parsed.data.started_at ?? new Date().toISOString().slice(0, 10),
    };

    return withUser(async (supabase, userId) => {
      const { error } = id
        ? await supabase.from("subscriptions").update(payload).eq("id", id)
        : await supabase.from("subscriptions").insert({ ...payload, owner_id: userId });
      if (error) return fail(error.message);
      revalidatePath("/clients");
      revalidatePath("/offerings");
      revalidatePath("/");
      return ok("Subscription saved.");
    });
  });
}

export async function endSubscription(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled", ended_at: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/clients");
      revalidatePath("/");
      return ok("Subscription ended.");
    }),
  );
}
