"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zInt, zRequiredText, zText, zodMessage } from "./schemas";

export async function recategoriseTransaction(id: string, category: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("transactions").update({ category }).eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/spend");
      revalidatePath("/");
      return ok("Re-categorised.");
    }),
  );
}

const ruleSchema = z.object({
  pattern: zRequiredText,
  category: zRequiredText,
  priority: zInt.transform((v) => v ?? 100),
  note: zText,
});

export async function saveCategoryRule(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = ruleSchema.safeParse({
      pattern: formData.get("pattern") ?? "",
      category: formData.get("category") ?? "",
      priority: formData.get("priority"),
      note: formData.get("note"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    try {
      new RegExp(parsed.data.pattern, "i");
    } catch {
      return fail("That pattern is not a valid regular expression.");
    }

    const applyToExisting = formData.get("apply_to_existing") === "on";

    return withUser(async (supabase, userId) => {
      const { error } = id
        ? await supabase.from("category_rules").update(parsed.data).eq("id", id)
        : await supabase.from("category_rules").insert({ ...parsed.data, owner_id: userId });
      if (error) return fail(error.message);

      let touched = 0;
      if (applyToExisting) {
        // PostgREST has no regex filter, so match in SQL through the same
        // function the importer uses.
        const { data: matches } = await supabase
          .from("transactions")
          .select("id, description")
          .limit(5000);
        const re = new RegExp(parsed.data.pattern, "i");
        const ids = (matches ?? []).filter((t) => re.test(t.description ?? "")).map((t) => t.id);
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { error: bulkError } = await supabase
            .from("transactions")
            .update({ category: parsed.data.category })
            .in("id", chunk);
          if (bulkError) return fail(bulkError.message);
          touched += chunk.length;
        }
      }

      revalidatePath("/spend");
      revalidatePath("/settings");
      revalidatePath("/");
      return ok(touched ? `Rule saved. ${touched} transactions updated.` : "Rule saved.");
    });
  });
}

export async function deleteCategoryRule(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("category_rules").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/spend");
      revalidatePath("/settings");
      return ok("Rule removed.");
    }),
  );
}

const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
  label: zRequiredText,
  group: z.enum(["income", "business", "personal", "internal"]),
  color: zText,
  recurring: z.boolean(),
});

export async function saveCategory(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const isEdit = formData.get("is_edit") === "true";
    const parsed = categorySchema.safeParse({
      slug: formData.get("slug") ?? "",
      label: formData.get("label") ?? "",
      group: formData.get("group") ?? "personal",
      color: formData.get("color"),
      recurring: formData.get("recurring") === "on",
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    const { slug, group, ...rest } = parsed.data;

    return withUser(async (supabase, userId) => {
      const { error } = isEdit
        ? await supabase.from("categories").update({ ...rest, group }).eq("slug", slug)
        : await supabase.from("categories").insert({ slug, group, ...rest, owner_id: userId });
      if (error) return fail(error.message);
      revalidatePath("/spend");
      revalidatePath("/settings");
      return ok("Category saved.");
    });
  });
}

export interface ImportRow {
  date: string;
  description: string;
  amount_zar: number;
  category: string;
  is_internal: boolean;
  occurrence: number;
}

/** Commits a previewed CSV import. Duplicates collide on the unique key and are skipped. */
export async function commitImport(rows: ImportRow[], source: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase, userId) => {
      if (rows.length === 0) return fail("Nothing to import.");
      if (rows.length > 20000) return fail("That file is too big for one import.");

      const batchId = crypto.randomUUID();
      let inserted = 0;

      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((row) => ({
          owner_id: userId,
          date: row.date,
          description: row.description,
          amount_zar: row.amount_zar,
          category: row.category,
          is_internal: row.is_internal,
          source,
          import_batch_id: batchId,
          occurrence: row.occurrence,
        }));

        const { data, error } = await supabase
          .from("transactions")
          .upsert(chunk, {
            onConflict: "owner_id,date,description,amount_zar,source,occurrence",
            ignoreDuplicates: true,
          })
          .select("id");
        if (error) return fail(error.message);
        inserted += data?.length ?? 0;
      }

      revalidatePath("/spend");
      revalidatePath("/revenue");
      revalidatePath("/");
      const skipped = rows.length - inserted;
      return ok(
        skipped > 0
          ? `${inserted} imported, ${skipped} already there.`
          : `${inserted} transactions imported.`,
      );
    }),
  );
}
