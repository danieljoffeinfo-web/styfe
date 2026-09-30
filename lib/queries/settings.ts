import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import type { Category, CategoryRule, PathSegment, Settings } from "@/lib/types";

export interface ResolvedSettings {
  id: string | null;
  vatEnabled: boolean;
  vatRate: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  businessName: string;
  businessDetails: string;
  mrrTargetCents: number;
  spendCapCents: number;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

export const SETTINGS_DEFAULTS: ResolvedSettings = {
  id: null,
  vatEnabled: false,
  vatRate: 0.15,
  invoicePrefix: "STY",
  nextInvoiceNumber: 1,
  businessName: "Styfe",
  businessDetails: "",
  mrrTargetCents: 5_000_000,
  spendCapCents: 1_500_000,
  fromName: "",
  fromEmail: "",
  replyTo: "",
};

export async function getSettings(): Promise<ResolvedSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").maybeSingle<Settings>();
  if (!data) return SETTINGS_DEFAULTS;

  return {
    id: data.id,
    vatEnabled: data.vat_enabled,
    vatRate: Number(data.vat_rate) || 0.15,
    invoicePrefix: data.invoice_prefix,
    nextInvoiceNumber: data.next_invoice_number,
    businessName: data.business_name,
    businessDetails: data.business_details ?? "",
    mrrTargetCents: toCents(data.mrr_target_zar) || SETTINGS_DEFAULTS.mrrTargetCents,
    spendCapCents: toCents(data.spend_cap_zar) || SETTINGS_DEFAULTS.spendCapCents,
    fromName: data.from_name ?? "",
    fromEmail: data.from_email ?? "",
    replyTo: data.reply_to ?? "",
  };
}

export async function getPathSegments(): Promise<PathSegment[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("path_segments").select("*").order("sort");
  return data ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort");
  return (data ?? []) as Category[];
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("category_rules").select("*").order("priority");
  return data ?? [];
}
