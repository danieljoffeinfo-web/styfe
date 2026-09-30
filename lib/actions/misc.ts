"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayIso, weekStartIso } from "@/lib/dates";
import { slugify } from "@/lib/utils";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zDate, zInt, zMoney, zRequiredText, zSignedMoney, zText, zodMessage } from "./schemas";

/* -------------------------------------------------------------- daily ---- */

export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("daily_tasks").update({ done }).eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/");
      return ok();
    }),
  );
}

export async function addTask(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = zRequiredText.safeParse(formData.get("label") ?? "");
    if (!parsed.success) return fail("Type something to add.");
    const date = zDate.parse(formData.get("date")) ?? todayIso();

    return withUser(async (supabase, userId) => {
      const { data: last } = await supabase
        .from("daily_tasks")
        .select("sort")
        .eq("date", date)
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from("daily_tasks").insert({
        owner_id: userId,
        date,
        label: parsed.data,
        sort: ((last?.sort as number | undefined) ?? 0) + 1,
      });
      if (error) return fail(error.message);
      revalidatePath("/");
      return ok("Added.");
    });
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("daily_tasks").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/");
      return ok("Removed.");
    }),
  );
}

/**
 * Anything left unticked on an earlier day moves onto today's list, once.
 * Safe to call repeatedly: the source task is deleted as it moves.
 */
export async function carryOverTasks(): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase, userId) => {
      const today = todayIso();
      const { data: stale } = await supabase
        .from("daily_tasks")
        .select("id, label, sort")
        .eq("done", false)
        .lt("date", today)
        .order("date")
        .order("sort");

      if (!stale?.length) return ok();

      const { data: existing } = await supabase.from("daily_tasks").select("label").eq("date", today);
      const seen = new Set((existing ?? []).map((t) => t.label));

      const { data: last } = await supabase
        .from("daily_tasks")
        .select("sort")
        .eq("date", today)
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle();
      let sort = ((last?.sort as number | undefined) ?? 0) + 1;

      const toInsert = [];
      for (const task of stale) {
        if (seen.has(task.label)) continue;
        seen.add(task.label);
        toInsert.push({ owner_id: userId, date: today, label: task.label, sort: sort++ });
      }

      if (toInsert.length) {
        const { error } = await supabase.from("daily_tasks").insert(toInsert);
        if (error) return fail(error.message);
      }

      const { error: cleanupError } = await supabase
        .from("daily_tasks")
        .delete()
        .in("id", stale.map((t) => t.id));
      if (cleanupError) return fail(cleanupError.message);

      revalidatePath("/");
      return ok(toInsert.length ? `${toInsert.length} carried over.` : undefined);
    }),
  );
}

/* --------------------------------------------------------------- week ---- */

export async function bumpWeeklyScore(metric: string, delta: number, weekStart?: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase, userId) => {
      const week = weekStart ?? weekStartIso(todayIso());
      const { data: existing } = await supabase
        .from("weekly_scores")
        .select("id, value")
        .eq("week_start", week)
        .eq("metric", metric)
        .maybeSingle();

      const next = Math.max(0, (existing?.value ?? 0) + delta);
      const { error } = existing
        ? await supabase.from("weekly_scores").update({ value: next }).eq("id", existing.id)
        : await supabase
            .from("weekly_scores")
            .insert({ owner_id: userId, week_start: week, metric, value: next });
      if (error) return fail(error.message);

      revalidatePath("/");
      return ok();
    }),
  );
}

export async function saveWeeklyTarget(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const metricRaw = String(formData.get("metric") ?? "").trim();
    const label = zRequiredText.safeParse(formData.get("label") ?? "");
    if (!label.success) return fail("Give the metric a name.");
    const target = zInt.parse(formData.get("target")) ?? 0;
    const metric = metricRaw || slugify(label.data).replace(/-/g, "_");

    return withUser(async (supabase, userId) => {
      const { error } = await supabase
        .from("weekly_targets")
        .upsert(
          { metric, label: label.data, target, owner_id: userId },
          { onConflict: "metric" },
        );
      if (error) return fail(error.message);
      revalidatePath("/");
      return ok("Target saved.");
    });
  });
}

export async function deleteWeeklyTarget(metric: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase.from("weekly_targets").delete().eq("metric", metric);
      if (error) return fail(error.message);
      return ok("Metric removed.");
    }),
  );
}

/* -------------------------------------------------------------- goals ---- */

const goalSchema = z.object({
  name: zRequiredText,
  kind: z.enum(["savings", "mrr", "spend_cap"]),
  target_zar: zMoney.transform((v) => v ?? 0),
  deadline: zDate,
  notes: zText,
});

export async function saveGoal(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    const parsed = goalSchema.safeParse({
      name: formData.get("name") ?? "",
      kind: formData.get("kind") ?? "savings",
      target_zar: formData.get("target_zar"),
      deadline: formData.get("deadline"),
      notes: formData.get("notes"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    return withUser(async (supabase, userId) => {
      if (id) {
        const { error } = await supabase.from("goals").update(parsed.data).eq("id", id);
        if (error) return fail(error.message);
      } else {
        const { error } = await supabase
          .from("goals")
          .insert({ ...parsed.data, slug: slugify(parsed.data.name), owner_id: userId });
        if (error) return fail(error.message);
      }
      revalidatePath("/");
      return ok("Goal saved.");
    });
  });
}

export async function addGoalEntry(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const goalId = String(formData.get("goal_id") ?? "");
    if (!goalId) return fail("Missing goal.");
    const amount = zSignedMoney.safeParse(formData.get("amount_zar") ?? "");
    if (!amount.success) return fail("Enter an amount.");
    const date = zDate.parse(formData.get("date")) ?? todayIso();
    const note = zText.parse(formData.get("note"));

    return withUser(async (supabase, userId) => {
      const { error } = await supabase
        .from("goal_entries")
        .insert({ owner_id: userId, goal_id: goalId, date, amount_zar: amount.data, note });
      if (error) return fail(error.message);

      // current_zar is the running total of the goal's entries.
      const { data: entries } = await supabase
        .from("goal_entries")
        .select("amount_zar")
        .eq("goal_id", goalId);
      const total = (entries ?? []).reduce((acc, e) => acc + Number(e.amount_zar), 0);
      const { error: updateError } = await supabase
        .from("goals")
        .update({ current_zar: total })
        .eq("id", goalId);
      if (updateError) return fail(updateError.message);

      revalidatePath("/");
      return ok("Deposit recorded.");
    });
  });
}

export async function deleteGoalEntry(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { data: entry } = await supabase.from("goal_entries").select("goal_id").eq("id", id).maybeSingle();
      const { error } = await supabase.from("goal_entries").delete().eq("id", id);
      if (error) return fail(error.message);

      if (entry?.goal_id) {
        const { data: entries } = await supabase
          .from("goal_entries")
          .select("amount_zar")
          .eq("goal_id", entry.goal_id);
        const total = (entries ?? []).reduce((acc, e) => acc + Number(e.amount_zar), 0);
        await supabase.from("goals").update({ current_zar: total }).eq("id", entry.goal_id);
      }

      return ok("Removed.");
    }),
  );
}

/* ------------------------------------------------------------- alerts ---- */

export async function resolveAlert(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { error } = await supabase
        .from("alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/");
      return ok("Cleared.");
    }),
  );
}

export async function addAlert(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const title = zRequiredText.safeParse(formData.get("title") ?? "");
    if (!title.success) return fail("Give the alert a title.");
    const body = zText.parse(formData.get("body"));
    const severity = z.enum(["low", "med", "high"]).safeParse(formData.get("severity") ?? "med");

    return withUser(async (supabase, userId) => {
      const { error } = await supabase.from("alerts").insert({
        owner_id: userId,
        title: title.data,
        body,
        severity: severity.success ? severity.data : "med",
      });
      if (error) return fail(error.message);
      revalidatePath("/");
      return ok("Alert added.");
    });
  });
}
