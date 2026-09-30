import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { MoneyCents } from "@/components/money";
import { RevenueForm } from "@/components/revenue/revenue-form";
import { RevenueTable } from "@/components/revenue/revenue-table";
import { getMonthlyRevenue, getRevenueEntries } from "@/lib/queries/revenue";
import { getClients } from "@/lib/queries/clients";
import { getOfferings } from "@/lib/queries/offerings";
import { calendarMonth, monthLabelLong, todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue · Styfe HQ" };

export default async function RevenuePage() {
  const thisMonth = calendarMonth(todayIso());

  const [months, entries, clients, offerings] = await Promise.all([
    getMonthlyRevenue(12),
    getRevenueEntries(),
    getClients(),
    getOfferings(),
  ]);

  const thisMonthPoint = months.find((m) => m.month === thisMonth);
  const recurringCents = months.reduce((acc, m) => acc + m.recurringCents, 0);
  const onceOffCents = months.reduce((acc, m) => acc + m.onceOffCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Entered by hand — ex VAT"
        title="Revenue"
        subtitle="Track recurring income, projects and the clients and offerings driving the business."
        actions={
          <RevenueForm
            clients={clients}
            offerings={offerings}
            trigger={<Button variant="primary">Add revenue</Button>}
          />
        }
      />

      <section aria-label="Totals" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`This month · ${monthLabelLong(thisMonth)}`}
          value={<MoneyCents cents={thisMonthPoint?.totalCents ?? 0} />}
          note="Calendar month"
        />
        <StatCard
          label="Recurring · last 12 months"
          value={<MoneyCents cents={recurringCents} />}
          note="Retainers and salary"
          noteTone="green"
        />
        <StatCard
          label="Once-off · last 12 months"
          value={<MoneyCents cents={onceOffCents} />}
          note="Projects and builds"
        />
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Entries" aside={`${entries.length} recorded`} />
          <RevenueTable entries={entries} clients={clients} offerings={offerings} />
        </CardBody>
      </Card>
    </>
  );
}
