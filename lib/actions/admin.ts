"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zDate, zRequiredText, zText, zodMessage } from "./schemas";

const zTrack = z.enum(["client", "business"]);
const zStatus = z.enum(["todo", "doing", "done"]);

const itemSchema = z.object({
  track: zTrack,
  title: zRequiredText,
  detail: zText,
  status: zStatus,
  client_id: z
    .union([z.string().uuid(), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  due_date: zDate,
});

export async function saveAdminItem(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = itemSchema.safeParse({
      track: formData.get("track") ?? "client",
      title: formData.get("title") ?? "",
      detail: formData.get("detail"),
      status: formData.get("status") ?? "todo",
      client_id: formData.get("client_id") ?? "",
      due_date: formData.get("due_date"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    // Business items are Dan's own projects, so a client on one is a mistake
    // rather than something to store and puzzle over later.
    const values = {
      ...parsed.data,
      client_id: parsed.data.track === "business" ? null : parsed.data.client_id,
    };

    return withUser(async (supabase, userId) => {
      if (id) {
        const { error } = await supabase.from("admin_items").update(values).eq("id", id);
        if (error) return fail(error.message);
      } else {
        const { data: last } = await supabase
          .from("admin_items")
          .select("sort")
          .eq("track", values.track)
          .order("sort", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await supabase.from("admin_items").insert({
          ...values,
          owner_id: userId,
          sort: ((last?.sort as number | undefined) ?? 0) + 10,
        });
        if (error) return fail(error.message);
      }

      revalidatePath("/admin");
      revalidatePath("/");
      return ok(id ? "Saved." : "Added.");
    });
  });
}

export async function setAdminItemStatus(id: string, status: string): Promise<ActionResult> {
  return guard(async () => {
    const parsed = zStatus.safeParse(status);
    if (!parsed.success) return fail("Unknown status.");

    return withUser(async (supabase) => {
      const { error } = await supabase
        .from("admin_items")
        .update({ status: parsed.data })
        .eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/admin");
      revalidatePath("/");
      return ok();
    });
  });
}

export async function deleteAdminItem(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("admin_items").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/admin");
      revalidatePath("/");
      return ok("Removed.");
    }),
  );
}
