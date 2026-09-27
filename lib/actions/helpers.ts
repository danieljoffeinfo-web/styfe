import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export const ok = (message?: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/** Every write goes through here: it proves who is calling before touching a table. */
export async function withUser<T>(
  fn: (supabase: SupabaseClient, userId: string) => Promise<T>,
): Promise<T> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    throw new Error("Not signed in.");
  }
  return fn(supabase as SupabaseClient, user.id);
}

/** Wraps an action body so a database error becomes a message, not a crash. */
export async function guard(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return fail(message);
  }
}

/** Settings is created lazily so invoice numbering always has a row to bump. */
export async function ensureSettings(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  if (data) return data;

  const { data: created, error } = await supabase
    .from("settings")
    .insert({ owner_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created;
}

export function firstError(...errors: ({ message: string } | null)[]): string | null {
  for (const error of errors) if (error) return error.message;
  return null;
}
