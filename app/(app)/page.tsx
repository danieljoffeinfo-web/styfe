import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { MoneyCents } from "@/components/money";
import { PageHeader } from "@/components/shell/page-header";
import { IncomeChart, ChartLegend } from "@/components/charts/income-chart";
import { TodayChecklist } from "@/components/overview/today-checklist";
import { PathToTarget } from "@/components/overview/path-to-target";
import { ResolveAlertButton } from "@/components/overview/resolve-alert-button";
import { getMrr, pathToTarget } from "@/lib/queries/money";
import { getMonthlyRevenue } from "@/lib/queries/revenue";
import { getReceivables } from "@/lib/queries/invoices";
import { getPathSegments, getSettings } from "@/lib/queries/settings";
import { getClients, getSubscriptions } from "@/lib/queries/clients";
import { getOfferings } from "@/lib/queries/offerings";
import { getDeals } from "@/lib/queries/deals";
import { getDailyTasks, getOpenAlerts } from "@/lib/queries/misc";
import { calendarMonth, formatDate, greeting, monthLabelLong, todayIso } from "@/lib/dates";
import { percent, toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

/** The Overview shows five tasks. The rest stay on the list, just not here. */
const TASKS_SHOWN = 5;

const zar = (cents: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default async function OverviewPage() {
  const today = todayIso();
  const thisMonth = calendarMonth(today);

  const [settings, mrr, income, receivables, segments, subscriptions, offerings, clients, deals, tasks, alerts] =
    await Promise.all([
      getSettings(),
      getMrr(),
      // Revenue is entered by hand and sits on calendar months, so the Overview
      // and the Revenue page always show the same figure for the same month.
      getMonthlyRevenue(6),
      getReceivables(),
      getPathSegments(),
      getSubscriptions(),
      getOfferings(true),
      getClients(),
      getDeals(),
      getDailyTasks(today),
      getOpenAlerts(),
    ]);

  // Earned is this calendar month only, not a running six-month total.
  const earnedCents = income.find((m) => m.month === thisMonth)?.totalCents ?? 0;

  const overdue = receivables.filter((r) => r.effective_status === "overdue");
  const receivableCents = receivables.reduce((acc, r) => acc + toCents(r.total_zar), 0);

  const activeClients = clients.filter((c) => c.status === "active");
  const newThisMonth = activeClients.filter(
    (c) => calendarMonth(String(c.created_at).slice(0, 10)) === thisMonth,
  ).length;

  const path = pathToTarget(segments, subscriptions, offerings, income);

  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const offeringById = new Map(offerings.map((o) => [o.id, o]));
  const pipelineByCategory = new Map<string, { count: number; monthlyCents: number; onceOffCents: number }>();
  for (const deal of openDeals) {
    const offering = deal.offering_id ? offeringById.get(deal.offering_id) : undefined;
    const key = offering?.category ?? "Unassigned";
    const current = pipelineByCategory.get(key) ?? { count: 0, monthlyCents: 0, onceOffCents: 0 };
    current.count += 1;
    current.monthlyCents += toCents(deal.monthly_value_zar) * deal.units;
    current.onceOffCents += toCents(deal.once_off_value_zar);
    pipelineByCategory.set(key, current);
  }

  return (
    <>
      <PageHeader
        eyebrow={formatDate(today, "long")}
        title={`${greeting()}, Dan.`}
        actions={
          <>
            <Button asChild>
              <Link href="/revenue">Add revenue</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/invoices/new">New invoice</Link>
            </Button>
          </>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Secured monthly (MRR)"
          value={<MoneyCents cents={mrr.mrrCents} />}
          meter={{ value: percent(mrr.mrrCents, settings.mrrTargetCents) }}
          note={`${percent(mrr.mrrCents, settings.mrrTargetCents)}% of ${zar(settings.mrrTargetCents)} target`}
        />
        <StatCard
          label="Receivables"
          value={<MoneyCents cents={receivableCents} />}
          note={`${receivables.length} open · ${overdue.length} overdue`}
          noteTone={overdue.length ? "alert" : "muted"}
        />
        <StatCard
          label={`Earned · ${monthLabelLong(thisMonth)}`}
          value={<MoneyCents cents={earnedCents} />}
          note="This calendar month"
        />
        <StatCard
          label="Clients"
          value={String(activeClients.length)}
          note={newThisMonth > 0 ? `+${newThisMonth} this month` : "No new clients this month"}
          noteTone={newThisMonth > 0 ? "green" : "muted"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <CardHeader title="Money in, by month" aside="Once-off vs recurring" />
            <IncomeChart data={income} />
            <ChartLegend
              items={[
                { color: "#1D6B4F", label: "Recurring (retainers, salary)" },
                { color: "#C9A77A", label: "Once-off / projects" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title={`Path to ${zar(settings.mrrTargetCents)} / month`} />
            {segments.length ? (
              <PathToTarget segments={path} targetCents={settings.mrrTargetCents} />
            ) : (
              <p className="text-[13px] text-muted">
                No segments yet.{" "}
                <Link href="/settings" className="text-green underline underline-offset-4">
                  Set them up in Settings
                </Link>
                .
              </p>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <CardHeader title="Tasks" aside={`Top ${TASKS_SHOWN}`}>
              <Link href="/admin#today" className="text-[13px] text-green underline-offset-4 hover:underline">
                All tasks
              </Link>
            </CardHeader>
            <TodayChecklist tasks={tasks} date={today} limit={TASKS_SHOWN} />
          </CardBody>
        </Card>

        {alerts.length ? (
          <Card>
            <CardBody className="gap-2.5">
              <CardHeader title="Needs attention" />
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-alert-wash px-3 py-2.5 text-[13px] text-alert"
                >
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    {alert.body ? <p className="mt-0.5 opacity-80">{alert.body}</p> : null}
                  </div>
                  <ResolveAlertButton id={alert.id} />
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Pipeline" aside="Lead → Meeting → Proposal → Pilot → Won">
            <Link href="/pipeline" className="text-[13px] text-green underline-offset-4 hover:underline">
              Open pipeline
            </Link>
          </CardHeader>
          {pipelineByCategory.size === 0 ? (
            <p className="text-[13px] text-muted">No open deals. Add one on the Pipeline page.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {[...pipelineByCategory.entries()].map(([category, summary]) => (
                <div key={category} className="flex flex-col gap-2.5 rounded-[10px] bg-well p-3.5">
                  <div className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
                    <span>{category}</span>
                    <span className="money text-blue">
                      {summary.monthlyCents > 0 ? (
                        <>
                          <MoneyCents cents={summary.monthlyCents} />/mo
                        </>
                      ) : (
                        <MoneyCents cents={summary.onceOffCents} />
                      )}
                    </span>
                  </div>
                  {openDeals
                    .filter(
                      (d) =>
                        (d.offering_id ? offeringById.get(d.offering_id)?.category : "Unassigned") === category,
                    )
                    .slice(0, 3)
                    .map((deal) => (
                      <div key={deal.id} className="rounded-lg border border-line bg-card p-2.5 text-[13px]">
                        <div className="font-medium">{deal.title}</div>
                        <div className="text-xs text-muted">
                          {[deal.contact_name, deal.next_step].filter(Boolean).join(" · ") || "No next step"}
                        </div>
                      </div>
                    ))}
                  <div className="text-xs text-muted">{summary.count} open</div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
