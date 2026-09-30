import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyCents } from "@/components/money";
import { MoneyBarChart } from "@/components/charts/simple-charts";
import { OfferingForm } from "@/components/offerings/offering-form";
import { OfferingActions } from "@/components/offerings/offering-actions";
import { TierEditor } from "@/components/offerings/tier-editor";
import {
  getOfferingBySlug,
  getOfferingCosting,
  getOfferingSends,
  getOfferingStats,
  getOfferingTiers,
  getOfferings,
} from "@/lib/queries/offerings";
import { getSettings } from "@/lib/queries/settings";
import { OfferingDeliveryPanel } from "@/components/offerings/offering-delivery-panel";
import { getClients, getSubscriptions } from "@/lib/queries/clients";
import { getDeals } from "@/lib/queries/deals";
import { getInvoices } from "@/lib/queries/invoices";
import { createClient } from "@/lib/supabase/server";
import { priceLine } from "@/lib/offerings";
import { OFFERING_TYPE_LABEL } from "@/lib/types";
import { toCents } from "@/lib/money";
import { DEAL_STAGE_LABEL, PRICING_MODEL_LABEL } from "@/lib/types";
import { formatDate, monthLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function OfferingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const offering = await getOfferingBySlug(slug);
  if (!offering) notFound();

  const [tiers, stats, costing, sends, settings, subscriptions, clients, deals, invoices, offerings, supabase] =
    await Promise.all([
      getOfferingTiers([offering.id]),
      getOfferingStats(),
      getOfferingCosting(),
      getOfferingSends(offering.id),
      getSettings(),
      getSubscriptions(),
      getClients(),
      getDeals(),
      getInvoices(),
      getOfferings(true),
      createClient(),
    ]);

  const stat = stats.find((s) => s.offering_id === offering.id) ?? null;
  const cost = costing.find((c) => c.offering_id === offering.id) ?? null;
  const costed = cost?.cost_setup_zar != null || cost?.cost_monthly_zar != null;
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const offeringSubs = subscriptions.filter((s) => s.offering_id === offering.id);
  const offeringDeals = deals.filter((d) => d.offering_id === offering.id);
  const categories = [...new Set(offerings.map((o) => o.category))].sort();

  // Revenue over time: paid invoice lines for this offering, by month paid.
  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("qty, unit_price_zar, invoice_id")
    .eq("offering_id", offering.id);

  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const revenueByMonth = new Map<string, number>();
  const offeringInvoices = new Set<string>();
  for (const line of lines ?? []) {
    const invoice = invoiceById.get(line.invoice_id);
    if (!invoice) continue;
    offeringInvoices.add(invoice.id);
    if (invoice.status !== "paid" || !invoice.paid_at) continue;
    const month = invoice.paid_at.slice(0, 7);
    const cents = Math.round(Number(line.qty) * toCents(line.unit_price_zar));
    revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + cents);
  }
  const revenueSeries = [...revenueByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cents]) => ({ label: monthLabel(month), cents }));

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/offerings" className="hover:underline">
            ← Offerings
          </Link>
        }
        title={offering.name}
        actions={
          <OfferingForm
            offering={offering}
            categories={categories}
            trigger={<Button variant="primary">Edit</Button>}
          />
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={offering.offering_type === "addon" ? "sand" : offering.offering_type === "custom" ? "blue" : "outline"}>
                {OFFERING_TYPE_LABEL[offering.offering_type]}
              </Badge>
              <Badge tone={offering.kind === "product" ? "blue" : "green"}>{offering.kind}</Badge>
              <Badge tone="outline">{offering.category}</Badge>
              <Badge tone="outline">{PRICING_MODEL_LABEL[offering.pricing_model]}</Badge>
              {offering.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
            </div>

            <p className="money text-2xl">{priceLine(offering)}</p>

            {offering.ideal_for ? (
              <p className="text-sm leading-relaxed">
                <span className="text-muted">For: </span>
                {offering.ideal_for}
              </p>
            ) : null}

            {offering.description ? (
              <p className="text-sm leading-relaxed text-muted">{offering.description}</p>
            ) : null}

            {offering.deliverables?.length ? (
              <div>
                <h3 className="text-[13px] font-medium">Deliverables</h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {offering.deliverables.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="text-green">
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {offering.excludes?.length ? (
              <div>
                <h3 className="text-[13px] font-medium">Not included</h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
                  {offering.excludes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="text-alert">
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {offering.portfolio?.length ? (
              <div>
                <h3 className="text-[13px] font-medium">Portfolio</h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {offering.portfolio.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-blue underline underline-offset-4 hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {offering.delivery_days ? (
              <p className="text-[13px] text-muted">Delivery: {offering.delivery_days} days</p>
            ) : null}

            <OfferingActions offering={offering} showDelete={offeringSubs.length === 0} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Costing" aside="What it earns against what it costs" />
            {!costed ? (
              <p className="mb-3 rounded-[10px] bg-well px-3.5 py-2.5 text-[13px] text-muted">
                Not costed yet. Edit the offering and fill in what delivery costs you — margin
                stays blank until you do, rather than reading as pure profit.
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              {cost?.price_setup_zar != null || cost?.cost_setup_zar != null ? (
                <>
                  <Stat label="Once-off price" value={<MoneyCents cents={toCents(cost?.price_setup_zar)} />} />
                  <Stat
                    label="Once-off cost"
                    value={cost?.cost_setup_zar != null ? <MoneyCents cents={toCents(cost.cost_setup_zar)} /> : "—"}
                  />
                  <Stat
                    label="Once-off margin"
                    value={
                      cost?.margin_setup_zar != null ? (
                        <>
                          <MoneyCents cents={toCents(cost.margin_setup_zar)} />
                          {cost.margin_setup_pct != null ? (
                            <span className="ml-1 text-xs text-muted">{cost.margin_setup_pct}%</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )
                    }
                  />
                </>
              ) : null}

              {cost?.price_monthly_zar != null || cost?.cost_monthly_zar != null ? (
                <>
                  <Stat label="Monthly price" value={<MoneyCents cents={toCents(cost?.price_monthly_zar)} />} />
                  <Stat
                    label="Monthly cost"
                    value={cost?.cost_monthly_zar != null ? <MoneyCents cents={toCents(cost.cost_monthly_zar)} /> : "—"}
                  />
                  <Stat
                    label="Monthly margin"
                    value={
                      cost?.margin_monthly_zar != null ? (
                        <>
                          <MoneyCents cents={toCents(cost.margin_monthly_zar)} />
                          {cost.margin_monthly_pct != null ? (
                            <span className="ml-1 text-xs text-muted">{cost.margin_monthly_pct}%</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )
                    }
                  />
                </>
              ) : null}

              {(stat?.active_subscriptions ?? 0) > 0 || (stat?.active_units ?? 0) > 0 ? (
                <Stat
                  label={offering.unit_label ? `Live ${offering.unit_label}s` : "Live clients"}
                  value={String(
                    offering.pricing_model === "per_unit_monthly"
                      ? (stat?.active_units ?? 0)
                      : (stat?.active_subscriptions ?? 0),
                  )}
                />
              ) : null}
            </dl>
            {offering.cost_notes ? (
              <p className="mt-3 whitespace-pre-line border-t border-line-soft pt-3 text-[13px] leading-relaxed text-muted">
                {offering.cost_notes}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </section>

      <OfferingDeliveryPanel
        offering={offering}
        clients={clients}
        sends={sends}
        fromEmail={settings.fromEmail}
      />

      <Card>
        <CardBody>
          <CardHeader title="Tiers" aside="Optional packages" />
          <TierEditor offering={offering} tiers={tiers} />
        </CardBody>
      </Card>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardBody>
            <CardHeader title="Clients on this" />
            {offeringSubs.length === 0 ? (
              <p className="text-[13px] text-muted">Nobody is subscribed yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {offeringSubs.map((sub) => {
                  const client = clientById.get(sub.client_id);
                  return (
                    <li key={sub.id} className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 last:border-b-0">
                      <span>
                        {client ? (
                          <Link href={`/clients/${client.slug}`} className="font-medium hover:underline">
                            {client.name}
                          </Link>
                        ) : (
                          "Unknown client"
                        )}
                        <span className="ml-2 text-xs text-muted">
                          {sub.units > 1 ? `${sub.units} × ` : ""}
                          since {formatDate(sub.started_at)}
                        </span>
                      </span>
                      <span className="money">
                        <MoneyCents cents={toCents(sub.monthly_fee_zar) * sub.units} />
                        /mo
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Deals" />
            {offeringDeals.length === 0 ? (
              <p className="text-[13px] text-muted">No deals against this offering.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {offeringDeals.map((deal) => (
                  <li key={deal.id} className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 last:border-b-0">
                    <Link href={`/pipeline?deal=${deal.id}`} className="font-medium hover:underline">
                      {deal.title}
                    </Link>
                    <Badge tone={deal.stage === "won" ? "green" : deal.stage === "lost" ? "neutral" : "outline"}>
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
          <CardHeader title="Revenue over time" aside="Paid invoice lines" />
          <MoneyBarChart data={revenueSeries} color={offering.color ?? "#1D6B4F"} />
          <div className="text-[13px] text-muted">
            {offeringInvoices.size} invoice{offeringInvoices.size === 1 ? "" : "s"} include this offering.{" "}
            <Link href="/invoices" className="text-green underline underline-offset-4">
              All invoices
            </Link>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="money mt-0.5 text-[15px]">{value}</dd>
    </div>
  );
}
