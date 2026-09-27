import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MoneyCents } from "@/components/money";
import { IncomeChart, ChartLegend } from "@/components/charts/income-chart";
import { MoneyBarChart, SplitDonut } from "@/components/charts/simple-charts";
import { getMonthlyIncome } from "@/lib/queries/money";
import { getCategories } from "@/lib/queries/settings";
import { getInvoices } from "@/lib/queries/invoices";
import { getCatalogue } from "@/lib/queries/offerings";
import { getClients } from "@/lib/queries/clients";
import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import { monthLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue · Styfe HQ" };

export default async function RevenuePage() {
  const [income, categories, invoices, catalogue, clients, supabase] = await Promise.all([
    getMonthlyIncome(12),
    getCategories(),
    getInvoices(),
    getCatalogue(true),
    getClients(),
    createClient(),
  ]);

  const recurringCents = income.reduce((acc, m) => acc + m.recurringCents, 0);
  const onceOffCents = income.reduce((acc, m) => acc + m.onceOffCents, 0);
  const totalCents = recurringCents + onceOffCents;

  // By income category, straight off the statements.
  const { data: incomeRows } = await supabase
    .from("transactions")
    .select("category, amount_zar, client_id")
    .like("category", "income_%")
    .eq("is_internal", false)
    .limit(5000);

  const labelFor = new Map(categories.map((c) => [c.slug, c.label]));
  const colorFor = new Map(categories.map((c) => [c.slug, c.color ?? "#1D6B4F"]));

  const byCategory = new Map<string, number>();
  const byClient = new Map<string, number>();
  for (const row of incomeRows ?? []) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + toCents(row.amount_zar));
    if (row.client_id) {
      byClient.set(row.client_id, (byClient.get(row.client_id) ?? 0) + toCents(row.amount_zar));
    }
  }

  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const clientSeries = [...byClient.entries()]
    .map(([id, cents]) => ({ label: clientName.get(id) ?? "Unknown", cents }))
    .sort((a, b) => b.cents - a.cents);

  const categorySeries = [...byCategory.entries()]
    .map(([slug, cents]) => ({ label: labelFor.get(slug) ?? slug, cents, color: colorFor.get(slug) ?? "#1D6B4F" }))
    .sort((a, b) => b.cents - a.cents);

  // Invoiced revenue by offering and by offering category (paid invoices only).
  const paid = new Set(invoices.filter((i) => i.status === "paid").map((i) => i.id));
  const { data: lineRows } = await supabase
    .from("invoice_lines")
    .select("offering_id, qty, unit_price_zar, invoice_id")
    .limit(5000);

  const offeringName = new Map(catalogue.map((e) => [e.offering.id, e.offering.name]));
  const offeringCategory = new Map(catalogue.map((e) => [e.offering.id, e.offering.category]));
  const byOffering = new Map<string, number>();
  const byOfferingCategory = new Map<string, number>();

  for (const line of lineRows ?? []) {
    if (!paid.has(line.invoice_id)) continue;
    const cents = Math.round(Number(line.qty) * toCents(line.unit_price_zar));
    const name = line.offering_id ? (offeringName.get(line.offering_id) ?? "Unknown") : "Free-text lines";
    const category = line.offering_id ? (offeringCategory.get(line.offering_id) ?? "Unknown") : "Uncategorised";
    byOffering.set(name, (byOffering.get(name) ?? 0) + cents);
    byOfferingCategory.set(category, (byOfferingCategory.get(category) ?? 0) + cents);
  }

  const offeringSeries = [...byOffering.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => b.cents - a.cents);
  const offeringCategorySeries = [...byOfferingCategory.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => b.cents - a.cents);

  return (
    <>
      <PageHeader eyebrow="Money in" title="Revenue" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Last 12 statement months</p>
            <p className="money text-2xl">
              <MoneyCents cents={totalCents} />
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Recurring</p>
            <p className="money text-2xl text-green-deep">
              <MoneyCents cents={recurringCents} />
            </p>
            <p className="text-xs text-muted">
              {totalCents ? Math.round((recurringCents / totalCents) * 100) : 0}% of the total
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Once-off / projects</p>
            <p className="money text-2xl">
              <MoneyCents cents={onceOffCents} />
            </p>
            <p className="text-xs text-muted">
              {totalCents ? Math.round((onceOffCents / totalCents) * 100) : 0}% of the total
            </p>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Twelve months" aside="FNB statement months, 4th to the 3rd" />
          <IncomeChart data={income} height={300} />
          <ChartLegend
            items={[
              { color: "#1D6B4F", label: "Recurring (retainers, salary)" },
              { color: "#C9A77A", label: "Once-off / projects" },
            ]}
          />
        </CardBody>
      </Card>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardBody>
            <CardHeader title="By client" aside="Payments linked to a client" />
            {clientSeries.length ? (
              <MoneyBarChart data={clientSeries} horizontal height={Math.max(180, clientSeries.length * 42)} />
            ) : (
              <p className="text-[13px] text-muted">
                No payments are linked to a client yet. Imports link Proto, Britos and IE Global.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="By income category" />
            <SplitDonut data={categorySeries} height={260} />
            <ul className="flex flex-col gap-1.5 text-sm">
              {categorySeries.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <MoneyCents cents={row.cents} symbol={false} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardBody>
            <CardHeader title="By offering" aside="Paid invoice lines">
              <Link href="/offerings" className="text-[13px] text-green underline-offset-4 hover:underline">
                Offerings
              </Link>
            </CardHeader>
            {offeringSeries.length ? (
              <MoneyBarChart
                data={offeringSeries}
                horizontal
                color="#2F5D8A"
                height={Math.max(180, offeringSeries.length * 42)}
              />
            ) : (
              <p className="text-[13px] text-muted">Nothing invoiced and paid yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="By offering category" aside="Paid invoice lines" />
            {offeringCategorySeries.length ? (
              <MoneyBarChart
                data={offeringCategorySeries}
                horizontal
                color="#C9A77A"
                height={Math.max(180, offeringCategorySeries.length * 42)}
              />
            ) : (
              <p className="text-[13px] text-muted">Nothing invoiced and paid yet.</p>
            )}
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Month by month" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="pb-2 font-normal">Month</th>
                  <th className="pb-2 text-right font-normal">Recurring</th>
                  <th className="pb-2 text-right font-normal">Once-off</th>
                  <th className="pb-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...income].reverse().map((row) => (
                  <tr key={row.month} className="border-b border-line-soft last:border-b-0">
                    <td className="py-2">{monthLabel(row.month)} {row.month.slice(0, 4)}</td>
                    <td className="money py-2 text-right text-green-deep">
                      <MoneyCents cents={row.recurringCents} symbol={false} />
                    </td>
                    <td className="money py-2 text-right">
                      <MoneyCents cents={row.onceOffCents} symbol={false} />
                    </td>
                    <td className="money py-2 text-right font-medium">
                      <MoneyCents cents={row.totalCents} symbol={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
