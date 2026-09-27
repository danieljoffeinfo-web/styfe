import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Client, Subscription } from "@/lib/types";

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").order("name");
  return data ?? [];
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("slug", slug).maybeSingle<Client>();
  return data;
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").order("started_at", { ascending: false });
  return data ?? [];
}
