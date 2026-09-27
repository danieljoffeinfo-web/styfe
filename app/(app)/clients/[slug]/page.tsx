import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyCents } from "@/components/money";
import { ClientForm } from "@/components/clients/client-form";
import { SubscriptionForm, EndSubscriptionButton } from "@/components/clients/subscription-form";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { getClientBySlug, getSubscriptions } from "@/lib/queries/clients";
import { getInvoices } from "@/lib/queries/invoices";
import { getOfferings, getOfferingTiers } from "@/lib/queries/offerings";
import { getDeals } from "@/lib/queries/deals";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { DEAL_STAGE_LABEL, type InvoiceStatus, type Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const [subscriptions, invoices, offerings, deals, supabase] = await Promise.all([
    getSubscriptions(),
    getInvoices(),
    getOfferings(),
    getDeals(),
    createClient(),
  ]);
  const tiers = await getOfferingTiers(offerings.map((o) => o.id));

  const { data: txRows } = await supabase
    .from("transactions")
    .select("*")
    .eq("client_id", client.id)
    .order("date", { ascending: false })
    .limit(50);
  const transactions = (txRows ?? []) as Transaction[];

  const offeringById = new Map(offerings.map((o) => [o.id, o]));
  const clientSubs = subscriptions.filter((s) => s.client_id === client.id);
  const clientInvoices = invoices.filter((i) => i.client_id === client.id);
  const clientDeals = deals.filter((d) => d.client_id === client.id);

  const mrrCents = clientSubs
    .filter((s) => s.status === "active")
    .reduce((acc, s) => acc + toCents(s.monthly_fee_zar) * s.units, 0);
  const owedCents = clientInvoices
    .filter((i) => i.effective_status !== "paid" && i.effective_status !== "void")
    .reduce((acc, i) => acc + toCents(i.total_zar), 0);
  const paidCents = clientInvoices
    .filter((i) => i.status === "paid")
    .reduce((acc, i) => acc + toCents(i.total_zar), 0);

  const waNumber = client.contact_phone?.replace(/\D/g, "").replace(/^0/, "27");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="hover:underline">
            ← Clients
          </Link>
        }
        title={client.name}
        actions={
          <>
            {waNumber ? (
              <Button asChild>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            ) : null}
            {client.contact_email ? (
              <Button asChild>
                <a href={`mailto:${client.contact_email}`}>
                  <Mail /> Email
                </a>
              </Button>
            ) : null}
            {client.contact_phone ? (
              <Button asChild>
                <a href={`tel:${client.contact_phone}`}>
                  <Phone /> Call
                </a>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`/invoices/new?client=${client.slug}`}>New invoice</Link>
            </Button>
            <ClientForm client={client} trigger={<Button variant="primary">Edit</Button>} />
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Secured monthly</p>
            <p className="money text-2xl">
              <MoneyCents cents={mrrCents} />
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Outstanding</p>
            <p className={`money text-2xl ${owedCents ? "text-alert" : ""}`}>
              <MoneyCents cents={owedCents} />
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Invoiced and paid</p>
            <p className="money text-2xl">
              <MoneyCents cents={paidCents} />
            </p>
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <CardHeader title="Subscriptions">
              <SubscriptionForm
                client={client}
                offerings={offerings}
                tiers={tiers}
                trigger={<Button size="sm">Add</Button>}
              />
            </CardHeader>
            {clientSubs.length === 0 ? (
              <p className="text-[13px] text-muted">No recurring work yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {clientSubs.map((sub) => {
                  const offering = offeringById.get(sub.offering_id);
                  return (
                    <li
                      key={sub.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2 last:border-b-0"
                    >
                      <div>
                        <p className="font-medium">{offering?.name ?? "Offering"}</p>
                        <p className="text-xs text-muted">
                          {sub.units > 1 ? `${sub.units} × · ` : ""}
                          from {formatDate(sub.started_at)}
                          {sub.ended_at ? ` to ${formatDate(sub.ended_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={sub.status === "active" ? "green" : "neutral"}>{sub.status}</Badge>
                        <span className="money">
                          <MoneyCents cents={toCents(sub.monthly_fee_zar) * sub.units} />
                          /mo
                        </span>
                        <SubscriptionForm
                          client={client}
                          subscription={sub}
                          offerings={offerings}
                          tiers={tiers}
                          trigger={<Button size="sm">Edit</Button>}
                        />
                        {sub.status === "active" ? (
                          <EndSubscriptionButton id={sub.id} label={offering?.name ?? "this"} />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Notes" />
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted">
              {client.notes || "Nothing noted."}
            </p>
            <dl className="mt-2 flex flex-col gap-1 border-t border-line-soft pt-3 text-[13px]">
              <Row label="Relationship" value={client.relationship} />
              <Row label="Status" value={client.status} />
              <Row label="Contact" value={client.contact_name ?? "—"} />
              <Row label="Phone" value={client.contact_phone ?? "—"} />
              <Row label="Email" value={client.contact_email ?? "—"} />
            </dl>
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardBody>
            <CardHeader title="Invoices" />
            {clientInvoices.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing invoiced yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {clientInvoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 last:border-b-0"
                  >
                    <Link href={`/invoices/${invoice.id}`} className="money hover:underline">
                      {invoice.number}
                    </Link>
                    <span className="text-xs text-muted">{formatDate(invoice.issued_at)}</span>
                    <span className="money">
                      <MoneyCents cents={toCents(invoice.total_zar)} />
                    </span>
                    <InvoiceStatusBadge status={invoice.effective_status as InvoiceStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Deals" />
            {clientDeals.length === 0 ? (
              <p className="text-[13px] text-muted">No deals.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {clientDeals.map((deal) => (
                  <li
                    key={deal.id}
                    className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 last:border-b-0"
                  >
                    <Link href="/pipeline" className="hover:underline">
                      {deal.title}
                    </Link>
                    <Badge tone={deal.stage === "won" ? "green" : "outline"}>
                      {DEAL_STAGE_LABEL[deal.stage]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Transactions" aside="Payments linked to this client" />
          {transactions.length === 0 ? (
            <p className="text-[13px] text-muted">
              No payments linked yet. Imports link Proto, Britos and IE Global automatically.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 border-b border-line-soft py-1.5 last:border-b-0">
                  <span className="text-xs text-muted">{formatDate(tx.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{tx.description || "—"}</span>
                  <span className="money">
                    <MoneyCents cents={toCents(tx.amount_zar)} withCents />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}
