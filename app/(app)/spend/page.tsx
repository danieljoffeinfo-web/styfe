import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { MoneyCents } from "@/components/money";
import { MoneyBarChart } from "@/components/charts/simple-charts";
import { TransactionRow } from "@/components/spend/transaction-row";
import {
  getMonthlySpend,
  getTransactions,
  personalSpendForMonth,
  spendAverages,
  statementMonths,
  topMerchants,
} from "@/lib/queries/money";
import { getCategories, getSettings } from "@/lib/queries/settings";
import { monthLabelLong } from "@/lib/dates";
import { percent } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spend · Styfe HQ" };

export default async function SpendPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string; internal?: string; q?: string }>;
}) {
  const { month, category, internal, q } = await searchParams;
  const includeInternal = internal === "1";

  const [spend, categories, settings] = await Promise.all([
    getMonthlySpend(),
    getCategories(),
    getSettings(),
  ]);

  const availableMonths = [...new Set(spend.map((r) => r.month))].sort().reverse();
  const months = statementMonths(6, availableMonths[0]);
  const activeMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : (availableMonths[0] ?? months[months.length - 1]);

  const transactions = await getTransactions({
    month: activeMonth,
    category,
    search: q,
    includeInternal,
    limit: 500,
  });

  const labelFor = new Map(categories.map((c) => [c.slug, c.label]));
  const groupFor = new Map(categories.map((c) => [c.slug, c.group]));

  const monthRows = spend.filter((r) => r.month === activeMonth);
  const breakdown = monthRows
    .slice()
    .sort((a, b) => b.spendCents - a.spendCents)
    .map((r) => ({ label: labelFor.get(r.category) ?? r.category, cents: r.spendCents }));

  const personalCents = personalSpendForMonth(spend, activeMonth);
  const businessCents = monthRows.filter((r) => r.group === "business").reduce((acc, r) => acc + r.spendCents, 0);
  const averages = spendAverages(spend, months, ["personal", "business"]).slice(0, 8);
  const merchants = topMerchants(transactions, categories, 10);

  return (
    <>
      <PageHeader
        eyebrow="Where the money goes"
        title="Spend"
        actions={
          <Button asChild variant="primary">
            <Link href="/spend/import">Import statement</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {months.map((m) => (
          <Link
            key={m}
            href={`/spend?month=${m}${includeInternal ? "&internal=1" : ""}`}
            className={cn(
              "flex min-h-9 items-center rounded-full border px-3.5 text-[13px]",
              m === activeMonth ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted hover:bg-well",
            )}
          >
            {monthLabelLong(m)}
          </Link>
        ))}
        <Link
          href={`/spend?month=${activeMonth}${includeInternal ? "" : "&internal=1"}`}
          className="ml-auto text-[13px] text-green underline underline-offset-4"
        >
          {includeInternal ? "Hide internal transfers" : "Show internal transfers"}
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="gap-2">
            <p className="text-[13px] text-muted">Personal · {monthLabelLong(activeMonth)}</p>
            <p className="money text-2xl">
              <MoneyCents cents={personalCents} />
            </p>
            <Meter
              value={percent(personalCents, settings.spendCapCents)}
              tone={personalCents > settings.spendCapCents ? "alert" : "green"}
            />
            <p className={cn("text-xs", personalCents > settings.spendCapCents ? "text-alert" : "text-muted")}>
              cap <MoneyCents cents={settings.spendCapCents} symbol />
              {personalCents > settings.spendCapCents ? " — over" : ""}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Business · {monthLabelLong(activeMonth)}</p>
            <p className="money text-2xl">
              <MoneyCents cents={businessCents} />
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <p className="text-[13px] text-muted">Transactions shown</p>
            <p className="money text-2xl">{transactions.length}</p>
            <p className="text-xs text-muted">
              {includeInternal ? "Internal transfers included" : "Internal transfers hidden"}
            </p>
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <CardHeader title="By category" aside={monthLabelLong(activeMonth)} />
            <MoneyBarChart data={breakdown.slice(0, 10)} horizontal height={320} color="#8A3E12" />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="gap-2">
              <CardHeader title="6-month average" />
              {averages.length === 0 ? (
                <p className="text-[13px] text-muted">Nothing yet.</p>
              ) : (
                averages.map((row) => (
                  <div key={row.category} className="flex justify-between text-sm">
                    <span className={groupFor.get(row.category) === "business" ? "text-blue" : undefined}>
                      {labelFor.get(row.category) ?? row.category}
                    </span>
                    <MoneyCents cents={row.averageCents} symbol={false} />
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-2">
              <CardHeader title="Top merchants" aside={monthLabelLong(activeMonth)} />
              {merchants.length === 0 ? (
                <p className="text-[13px] text-muted">Nothing yet.</p>
              ) : (
                merchants.map((row) => (
                  <div key={row.merchant} className="flex justify-between gap-3 text-sm">
                    <span className="truncate">
                      {row.merchant}
                      <span className="ml-1.5 text-xs text-muted">×{row.count}</span>
                    </span>
                    <MoneyCents cents={row.spendCents} symbol={false} />
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Transactions" aside="Change a category and it offers to make a rule" />

          <form className="flex flex-wrap items-end gap-2" action="/spend">
            <input type="hidden" name="month" value={activeMonth} />
            {includeInternal ? <input type="hidden" name="internal" value="1" /> : null}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Search</span>
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Uber, Woolworths…"
                className="h-10 rounded-[10px] border border-control bg-card px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Category</span>
              <select
                name="category"
                defaultValue={category ?? ""}
                className="h-10 rounded-[10px] border border-control bg-card px-3 text-sm"
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Filter</Button>
            {q || category ? (
              <Button asChild variant="ghost">
                <Link href={`/spend?month=${activeMonth}${includeInternal ? "&internal=1" : ""}`}>Clear</Link>
              </Button>
            ) : null}
          </form>

          {transactions.length === 0 ? (
            <p className="text-[13px] text-muted">
              Nothing for {monthLabelLong(activeMonth)}.{" "}
              <Link href="/spend/import" className="text-green underline underline-offset-4">
                Import a statement
              </Link>
              .
            </p>
          ) : (
            <div className="max-h-[640px] overflow-y-auto rounded-[10px] border border-line">
              <table className="w-full">
                <thead className="sticky top-0 bg-well">
                  <tr className="text-left text-xs text-muted">
                    <th className="px-3 py-2 font-normal">Date</th>
                    <th className="px-3 py-2 font-normal">Description</th>
                    <th className="px-3 py-2 text-right font-normal">Amount</th>
                    <th className="w-[180px] px-3 py-2 font-normal">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} categories={categories} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
