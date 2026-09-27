import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyCents } from "@/components/money";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { ReminderButton } from "@/components/invoices/reminder-button";
import { getInvoices } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { formatDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices · Styfe HQ" };

const FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "open" } = await searchParams;
  const [invoices, settings] = await Promise.all([getInvoices(), getSettings()]);

  const rows = invoices.filter((invoice) => {
    if (status === "all") return true;
    if (status === "open") return invoice.effective_status !== "paid" && invoice.effective_status !== "void";
    return invoice.effective_status === status;
  });

  const totalCents = rows.reduce((acc, r) => acc + toCents(r.total_zar), 0);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        actions={
          <Button asChild variant="primary">
            <Link href="/invoices/new">New invoice</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={`/invoices?status=${filter.key}`}
            className={cn(
              "flex min-h-9 items-center rounded-full border px-3.5 text-[13px]",
              status === filter.key
                ? "border-ink bg-ink text-paper"
                : "border-line bg-card text-muted hover:bg-well",
            )}
          >
            {filter.label}
          </Link>
        ))}
        <span className="money ml-auto text-sm text-muted">
          {rows.length} · <MoneyCents cents={totalCents} />
        </span>
      </div>

      <Card>
        <CardBody className="gap-0 p-0 sm:p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-[13px] text-muted">Nothing here.</p>
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_1.6fr_1fr_1fr_0.9fr_auto] gap-3 border-b border-line px-5 py-3 text-xs text-muted lg:grid">
                <div>Number</div>
                <div>Client</div>
                <div>Issued</div>
                <div>Due</div>
                <div className="text-right">Total</div>
                <div className="w-[190px] text-right">Status</div>
              </div>
              <ul>
                {rows.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-col gap-2 border-b border-line-soft px-5 py-4 last:border-b-0 lg:grid lg:grid-cols-[1fr_1.6fr_1fr_1fr_0.9fr_auto] lg:items-center lg:gap-3"
                  >
                    <Link href={`/invoices/${invoice.id}`} className="money font-medium hover:underline">
                      {invoice.number}
                    </Link>
                    <Link href={`/clients/${invoice.client_slug}`} className="text-sm hover:underline">
                      {invoice.client_name}
                    </Link>
                    <div className="text-[13px] text-muted">{formatDate(invoice.issued_at)}</div>
                    <div
                      className={cn(
                        "text-[13px]",
                        invoice.effective_status === "overdue" ? "text-alert" : "text-muted",
                      )}
                    >
                      {formatDate(invoice.due_at)}
                    </div>
                    <div className="money lg:text-right">
                      <MoneyCents cents={toCents(invoice.total_zar)} />
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 lg:w-[190px] lg:justify-end">
                      <InvoiceStatusBadge status={invoice.effective_status as InvoiceStatus} />
                      {invoice.effective_status === "overdue" || invoice.effective_status === "sent" ? (
                        <ReminderButton invoice={invoice} settings={settings} />
                      ) : (
                        <span className="text-xs text-muted lg:hidden">
                          {INVOICE_STATUS_LABEL[invoice.effective_status as InvoiceStatus]}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
