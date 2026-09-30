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
  // Only meaningful on a recurring entry: the month the stream stops.
  ended_at: zDate,
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
      ended_at: formData.get("ended_at"),
      client_id: formData.get("client_id") ?? "",
      offering_id: formData.get("offering_id") ?? "",
      notes: formData.get("notes"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    // An end date on a once-off entry would mean nothing, so it is dropped
    // rather than stored for someone to puzzle over later.
    const values = {
      ...parsed.data,
      ended_at: parsed.data.recurring ? parsed.data.ended_at : null,
    };

    return withUser(async (supabase, userId) => {
      const { error } = id
        ? await supabase.from("revenue_entries").update(values).eq("id", id)
        : await supabase.from("revenue_entries").insert({ ...values, owner_id: userId });
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
