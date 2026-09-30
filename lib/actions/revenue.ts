"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zBool, zDate, zMoneyRequired, zRequiredText, zText, zodMessage } from "./schemas";

const uuidOrNull = z
  .union([z.string().uuid(), z.literal("")])
  .transform((v) => (v === "" ? null : v));

const revenueSchema = z.object({
  date: zDate.refine((v): v is string => v !== null, "Pick a date"),
  description: zRequiredText,
  amount_zar: zMoneyRequired,
  recurring: zBool,
  client_id: uuidOrNull,
  offering_id: uuidOrNull,
  notes: zText,
});

export async function saveRevenueEntry(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = revenueSchema.safeParse({
      date: formData.get("date"),
      description: formData.get("description") ?? "",
      amount_zar: formData.get("amount_zar"),
      recurring: formData.get("recurring"),
      client_id: formData.get("client_id") ?? "",
      offering_id: formData.get("offering_id") ?? "",
      notes: formData.get("notes"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    return withUser(async (supabase, userId) => {
      const { error } = id
        ? await supabase.from("revenue_entries").update(parsed.data).eq("id", id)
        : await supabase.from("revenue_entries").insert({ ...parsed.data, owner_id: userId });
      if (error) return fail(error.message);

      revalidatePath("/revenue");
      revalidatePath("/");
      return ok(id ? "Saved." : "Revenue added.");
    });
  });
}

export async function deleteRevenueEntry(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("revenue_entries").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/revenue");
      revalidatePath("/");
      return ok("Removed.");
    }),
  );
}
