import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { ReminderButton } from "@/components/invoices/reminder-button";
import { MarkPaidButton, InvoiceStatusButtons } from "@/components/invoices/mark-paid";
import { getInvoice, getInvoiceLines } from "@/lib/queries/invoices";
import { getClients } from "@/lib/queries/clients";
import { getOfferings, getOfferingTiers } from "@/lib/queries/offerings";
import { getSettings } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import type { InvoiceStatus, Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const [lines, clients, offerings, settings, supabase] = await Promise.all([
    getInvoiceLines(invoice.id),
    getClients(),
    getOfferings(),
    getSettings(),
    createClient(),
  ]);
  const tiers = await getOfferingTiers(offerings.map((o) => o.id));

  // Income transactions within 1% of the total that are not linked yet.
  const totalCents = toCents(invoice.total_zar);
  const tolerance = Math.max(100, Math.round(totalCents * 0.01));
  const { data: candidateRows } = await supabase
    .from("transactions")
    .select("*")
    .is("invoice_id", null)
    .gt("amount_zar", 0)
    .gte("amount_zar", (totalCents - tolerance) / 100)
    .lte("amount_zar", (totalCents + tolerance) / 100)
    .order("date", { ascending: false })
    .limit(15);
  const candidates = (candidateRows ?? []) as Transaction[];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/invoices" className="hover:underline">
            ← Invoices
          </Link>
        }
        title={invoice.number}
        actions={
          <>
            <InvoiceStatusBadge status={invoice.effective_status as InvoiceStatus} />
            <Button asChild>
              <Link href={`/invoices/${invoice.id}/print`}>Print / PDF</Link>
            </Button>
            <ReminderButton invoice={invoice} settings={settings} size="default" />
            <InvoiceStatusButtons invoice={invoice} />
            {invoice.status !== "paid" && invoice.status !== "void" ? (
              <MarkPaidButton invoice={invoice} candidates={candidates} />
            ) : null}
          </>
        }
      />

      <InvoiceForm
        invoice={invoice}
        lines={lines}
        clients={clients}
        offerings={offerings}
        tiers={tiers}
        settings={settings}
      />
    </>
  );
}
