"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { guard, ok, fail, withUser, ensureSettings, type ActionResult } from "./helpers";
import { zInt, zMoney, zRequiredText, zText, zodMessage } from "./schemas";

const settingsSchema = z.object({
  vat_enabled: z.boolean(),
  vat_rate: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const n = Number(String(v).replace("%", "").trim());
      if (!Number.isFinite(n)) return NaN;
      // Accept both 15 and 0.15.
      return n > 1 ? n / 100 : n;
    })
    .refine((v) => Number.isFinite(v) && v >= 0 && v < 1, "VAT rate must be between 0 and 100%"),
  invoice_prefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,10}$/, "Use up to 10 letters, digits or dashes")
    .transform((v) => v.toUpperCase()),
  next_invoice_number: zInt.transform((v) => (v && v > 0 ? v : 1)),
  business_name: zRequiredText,
  business_details: zText,
  mrr_target_zar: zMoney.transform((v) => v ?? 50000),
  spend_cap_zar: zMoney.transform((v) => v ?? 15000),
  from_name: zText,
  // Resend only delivers to arbitrary recipients from a verified domain, so a
  // blank here is the honest state rather than a guessed default.
  from_email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "From email looks wrong")
    .transform((v) => (v === "" ? null : v)),
  bank_name: zText,
  bank_account_name: zText,
  bank_account_number: zText,
  bank_branch_code: zText,
  bank_swift: zText,
  payment_reference: zText,
  reply_to: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Reply-to looks wrong")
    .transform((v) => (v === "" ? null : v)),
});

export async function saveSettings(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = settingsSchema.safeParse({
      vat_enabled: formData.get("vat_enabled") === "on",
      vat_rate: formData.get("vat_rate") ?? "0.15",
      invoice_prefix: formData.get("invoice_prefix") ?? "STY",
      next_invoice_number: formData.get("next_invoice_number"),
      business_name: formData.get("business_name") ?? "",
      business_details: formData.get("business_details"),
      mrr_target_zar: formData.get("mrr_target_zar"),
      spend_cap_zar: formData.get("spend_cap_zar"),
      from_name: formData.get("from_name"),
      from_email: formData.get("from_email"),
      reply_to: formData.get("reply_to"),
      bank_name: formData.get("bank_name"),
      bank_account_name: formData.get("bank_account_name"),
      bank_account_number: formData.get("bank_account_number"),
      bank_branch_code: formData.get("bank_branch_code"),
      bank_swift: formData.get("bank_swift"),
      payment_reference: formData.get("payment_reference"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    return withUser(async (supabase, userId) => {
      const current = await ensureSettings(supabase, userId);
      const { error } = await supabase.from("settings").update(parsed.data).eq("id", current.id);
      if (error) return fail(error.message);

      revalidatePath("/settings");
      revalidatePath("/offerings");
      revalidatePath("/invoices");
      revalidatePath("/");
      return ok("Settings saved.");
    });
  });
}

const segmentSchema = z.object({
  label: zRequiredText,
  target_zar: zMoney.transform((v) => v ?? 0),
  source: z.enum(["subscriptions", "project_average", "manual"]),
  offering_slug: zText,
  category: zText,
  target_units: zInt,
  color: zText,
});

export async function savePathSegment(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = segmentSchema.safeParse({
      label: formData.get("label") ?? "",
      target_zar: formData.get("target_zar"),
      source: formData.get("source") ?? "subscriptions",
      offering_slug: formData.get("offering_slug"),
      category: formData.get("category"),
      target_units: formData.get("target_units"),
      color: formData.get("color"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    return withUser(async (supabase, userId) => {
      if (id) {
        const { error } = await supabase.from("path_segments").update(parsed.data).eq("id", id);
        if (error) return fail(error.message);
      } else {
        const { data: last } = await supabase
          .from("path_segments")
          .select("sort")
          .order("sort", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await supabase.from("path_segments").insert({
          ...parsed.data,
          slug: slugify(parsed.data.label),
          sort: ((last?.sort as number | undefined) ?? 0) + 10,
          owner_id: userId,
        });
        if (error) return fail(error.message);
      }
      revalidatePath("/settings");
      revalidatePath("/");
      return ok("Segment saved.");
    });
  });
}

export async function deletePathSegment(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("path_segments").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/settings");
      revalidatePath("/");
      return ok("Segment removed.");
    }),
  );
}
