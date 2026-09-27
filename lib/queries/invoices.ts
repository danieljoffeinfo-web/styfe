import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceLine, InvoiceView, ReceivableView } from "@/lib/types";

export async function getInvoices(): Promise<InvoiceView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_invoices")
    .select("*")
    .order("issued_at", { ascending: false, nullsFirst: false })
    .order("number", { ascending: false });
  return data ?? [];
}

export async function getReceivables(): Promise<ReceivableView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_receivables")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function getInvoice(id: string): Promise<InvoiceView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_invoices").select("*").eq("id", id).maybeSingle<InvoiceView>();
  return data;
}

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort");
  return data ?? [];
}
