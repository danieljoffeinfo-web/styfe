import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { MoneyCents } from "@/components/money";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { ReminderButton } from "@/components/invoices/reminder-button";
import { getInvoices } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { formatDate, todayIso } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { INVOICE_STATUS_LABEL, type InvoiceStatus, type InvoiceView } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices · Styfe HQ" };

/** Three states, which is all Dan tracks: not paid yet, sent, done. */
const FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "open" } = await searchParams;
  const [invoices, settings] = await Promise.all([getInvoices(), getSettings()]);

  // Open means anything still owed — a draft lives here rather than behind its
  // own chip, so nothing is hidden from the only view that matters. Sent covers
  // overdue, which is a sent invoice that went past its due date.
  const matches = (invoice: InvoiceView, key: string) => {
    if (key === "open") return invoice.effective_status !== "paid" && invoice.effective_status !== "void";
    if (key === "sent") return invoice.effective_status === "sent" || invoice.effective_status === "overdue";
    return invoice.effective_status === key;
  };

  const rows = invoices.filter((invoice) => matches(invoice, status));

  const totalCents = rows.reduce((acc, r) => acc + toCents(r.total_zar), 0);
  const outstanding = invoices.filter((i) => i.effective_status === "sent" || i.effective_status === "overdue");
  const overdue = invoices.filter((i) => i.effective_status === "overdue");
  const todayMonth = todayIso().slice(0, 7);
  const paidThisMonth = invoices.filter(
    (i) => i.effective_status === "paid" && i.paid_at?.slice(0, 7) === todayMonth,
  );

  const outstandingCents = outstanding.reduce((acc, i) => acc + toCents(i.total_zar), 0);
  const overdueCents = overdue.reduce((acc, i) => acc + toCents(i.total_zar), 0);
  const paidThisMonthCents = paidThisMonth.reduce((acc, i) => acc + toCents(i.total_zar), 0);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        subtitle="Create, send and track invoices without losing sight of what is still owed."
        actions={
          <Button asChild variant="primary">
            <Link href="/invoices/new">New invoice</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Summary label="Outstanding" value={outstandingCents} note={`${outstanding.length} open`} />
        <Summary
          label="Overdue"
          value={overdueCents}
          note={overdue.length ? `${overdue.length} need attention` : "Nothing overdue"}
          alert={overdue.length > 0}
        />
        <Summary label="Paid this month" value={paidThisMonthCents} note={`${paidThisMonth.length} paid`} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          // Counted the same way the list filters, or the chip lies.
          const count = invoices.filter((i) => matches(i, filter.key)).length;

          return (
            <Link
              key={filter.key}
              href={`/invoices?status=${filter.key}`}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors",
                status === filter.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-card text-muted hover:border-control hover:text-ink",
              )}
            >
              {filter.label}
              <span className={cn("text-[11px]", status === filter.key ? "text-white/65" : "text-muted-dark")}>
                {count}
              </span>
            </Link>
          );
        })}
        <span className="money ml-auto text-sm text-muted">
          {rows.length} · <MoneyCents cents={totalCents} />
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty
          icon={<FileText className="size-5" strokeWidth={1.7} />}
          title={invoices.length === 0 ? "No invoices yet" : `No ${status} invoices`}
          body={
            invoices.length === 0
              ? "Create your first invoice and it will appear here with its status, due date and payment history."
              : "There are no invoices in this view right now. Choose another filter or create a new invoice."
          }
          action={
            invoices.length === 0 ? (
              <Button asChild variant="primary">
                <Link href="/invoices/new">New invoice</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/invoices?status=all">View all invoices</Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <CardBody className="gap-0 p-0 sm:p-0">
            <div className="hidden grid-cols-[1fr_1.6fr_1fr_1fr_0.9fr_auto] gap-3 border-b border-line bg-well/50 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.04em] text-muted lg:grid">
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
                  className="flex flex-col gap-2 border-b border-line-soft px-5 py-4 transition-colors last:border-b-0 hover:bg-well/60 lg:grid lg:grid-cols-[1fr_1.6fr_1fr_1fr_0.9fr_auto] lg:items-center lg:gap-3"
                >
                  <Link href={`/invoices/${invoice.id}`} className="money font-medium text-ink hover:underline">
                    {invoice.number}
                  </Link>
                  <Link href={`/clients/${invoice.client_slug}`} className="text-sm font-medium hover:underline">
                    {invoice.client_name}
                  </Link>
                  <div className="text-[13px] text-muted">{formatDate(invoice.issued_at)}</div>
                  <div className={cn("text-[13px]", invoice.effective_status === "overdue" ? "font-medium text-alert" : "text-muted")}>
                    {formatDate(invoice.due_at)}
                  </div>
                  <div className="money font-medium lg:text-right">
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
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Summary({
  label,
  value,
  note,
  alert = false,
}: {
  label: string;
  value: number;
  note: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className={cn("money mt-2 text-[26px] font-medium leading-none tracking-[-0.04em]", alert ? "text-alert" : "text-ink")}>
        <MoneyCents cents={value} />
      </div>
      <div className={cn("mt-3 text-xs", alert ? "text-alert" : "text-muted")}>{note}</div>
    </div>
  );
}
