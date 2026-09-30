import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminItem } from "@/lib/types";

/** Every admin item, both tracks. The page groups them. */
export async function getAdminItems(): Promise<AdminItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_items")
    .select("*")
    .order("sort")
    .order("created_at");
  return data ?? [];
}

/** The open items the Overview shows, most pressing first. */
export async function getOpenAdminItems(limit: number): Promise<AdminItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_items")
    .select("*")
    .neq("status", "done")
    // A due date beats no due date; after that it is Dan's own ordering.
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("sort")
    .limit(limit);
  return data ?? [];
}
