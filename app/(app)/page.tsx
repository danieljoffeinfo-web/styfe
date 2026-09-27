import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
import { StatCard } from "@/components/stat-card";
import { MoneyCents } from "@/components/money";
import { PageHeader } from "@/components/shell/page-header";
import { IncomeChart, ChartLegend } from "@/components/charts/income-chart";
import { TodayChecklist } from "@/components/overview/today-checklist";
import { PathToTarget } from "@/components/overview/path-to-target";
import { ReceivablesTable } from "@/components/overview/receivables-table";
import { ResolveAlertButton } from "@/components/overview/resolve-alert-button";
import {
  getMonthlyIncome,
  getMonthlySpend,
  getMrr,
  pathToTarget,
  personalSpendForMonth,
  spendAverages,
  statementMonths,
} from "@/lib/queries/money";
import { getReceivables } from "@/lib/queries/invoices";
import { getPathSegments, getSettings, getCategories } from "@/lib/queries/settings";
import { getClients, getSubscriptions } from "@/lib/queries/clients";
import { getOfferings } from "@/lib/queries/offerings";
import { getDeals } from "@/lib/queries/deals";
import { getDailyTasks, getGoals, getOpenAlerts, getWeeklyScores, getWeeklyTargets } from "@/lib/queries/misc";
import { daysToDeadline, formatDate, greeting, monthLabelLong, todayIso, weekStartIso } from "@/lib/dates";
import { percent, toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const today = todayIso();
  const week = weekStartIso(today);

  const [
    settings,
    mrr,
    income,
    spend,
    receivables,
    segments,
    subscriptions,
    offerings,
    clients,
    deals,
    goals,
    tasks,
    alerts,
    targets,
    scores,
    categories,
  ] = await Promise.all([
    getSettings(),
    getMrr(),
    getMonthlyIncome(6),
    getMonthlySpend(),
    getReceivables(),
    getPathSegments(),
    getSubscriptions(),
    getOfferings(true),
    getClients(),
    getDeals(),
    getGoals(),
    getDailyTasks(today),
    getOpenAlerts(),
    getWeeklyTargets(),
    getWeeklyScores(1),
    getCategories(),
  ]);

  const earnedCents = income.reduce((acc, m) => acc + m.totalCents, 0);
  const averageCents = income.length ? Math.round(earnedCents / income.length) : 0;

  const spendMonths = statementMonths(6);
  const currentMonth = spendMonths[spendMonths.length - 1];
  const personalCents = personalSpendForMonth(spend, currentMonth);
  const averages = spendAverages(spend, spendMonths, ["personal", "business"]).slice(0, 4);
  const categoryLabel = new Map(categories.map((c) => [c.slug, c.label]));

  const overdue = receivables.filter((r) => r.effective_status === "overdue");
  const receivableCents = receivables.reduce((acc, r) => acc + toCents(r.total_zar), 0);

  const path = pathToTarget(segments, subscriptions, offerings, income);
  const macbook = goals.find((g) => g.kind === "savings");
  const macbookCents = toCents(macbook?.current_zar);
  const macbookTargetCents = toCents(macbook?.target_zar);
  const macbookDays = daysToDeadline(macbook?.deadline ?? null);

  const scoreByMetric = new Map(scores.filter((s) => s.week_start === week).map((s) => [s.metric, s.value]));

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

  const activeClients = clients.filter((c) => c.status === "active");
  const subsByClient = new Map<string, number>();
  for (const sub of subscriptions.filter((s) => s.status === "active")) {
    subsByClient.set(sub.client_id, (subsByClient.get(sub.client_id) ?? 0) + toCents(sub.monthly_fee_zar) * sub.units);
  }
  const owedByClient = new Map<string, number>();
  for (const invoice of receivables) {
    owedByClient.set(invoice.client_id, (owedByClient.get(invoice.client_id) ?? 0) + toCents(invoice.total_zar));
  }

  return (
    <>
      <PageHeader
        eyebrow={formatDate(today, "long")}
        title={`${greeting()}, Dan.`}
        actions={
          <>
            <Button asChild>
              <Link href="/spend/import">Import statement</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/invoices/new">New invoice</Link>
            </Button>
          </>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Secured monthly (MRR)"
          value={<MoneyCents cents={mrr.mrrCents} />}
          meter={{ value: percent(mrr.mrrCents, settings.mrrTargetCents) }}
          note={`${percent(mrr.mrrCents, settings.mrrTargetCents)}% of ${new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR",
            maximumFractionDigits: 0,
          }).format(settings.mrrTargetCents / 100)} target`}
        />
        <StatCard
          label="Receivables"
          value={<MoneyCents cents={receivableCents} />}
          note={`${receivables.length} open · ${overdue.length} overdue`}
          noteTone={overdue.length ? "alert" : "muted"}
        />
        <StatCard
          label="Earned, last 6 months"
          value={<MoneyCents cents={earnedCents} />}
          note={`avg ${new Intl.NumberFormat("en-ZA", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(averageCents / 100)} / month`}
        />
        <StatCard
          label={`Personal spend · ${monthLabelLong(currentMonth).slice(0, 3)}`}
          value={<MoneyCents cents={personalCents} />}
          meter={{
            value: percent(personalCents, settings.spendCapCents),
            tone: personalCents > settings.spendCapCents ? "alert" : "green",
          }}
          note={`cap ${new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR",
            maximumFractionDigits: 0,
          }).format(settings.spendCapCents / 100)}`}
          noteTone={personalCents > settings.spendCapCents ? "alert" : "muted"}
        />
        <StatCard
          dark
          label={macbook?.name ?? "Savings goal"}
          value={<MoneyCents cents={macbookCents} />}
          suffix={macbookTargetCents ? `/ ${Math.round(macbookTargetCents / 100_000)}k` : undefined}
          note={
            macbookDays === null
              ? "No deadline set"
              : macbookDays >= 0
                ? `${macbookDays} days to ${formatDate(macbook?.deadline ?? null)}`
                : `${Math.abs(macbookDays)} days past ${formatDate(macbook?.deadline ?? null)}`
          }
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
            <CardHeader title={`Path to ${new Intl.NumberFormat("en-ZA", {
              style: "currency",
              currency: "ZAR",
              maximumFractionDigits: 0,
            }).format(settings.mrrTargetCents / 100)} / month`} />
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
            <CardHeader title="Receivables">
              <Link href="/invoices" className="text-[13px] text-green underline-offset-4 hover:underline">
                All invoices
              </Link>
            </CardHeader>
            <ReceivablesTable rows={receivables} settings={settings} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Today · admin" />
            <TodayChecklist tasks={tasks} date={today} />
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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
                      .filter((d) => (d.offering_id ? offeringById.get(d.offering_id)?.category : "Unassigned") === category)
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

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="gap-3">
              <CardHeader title="This week">
                <Link href="/week" className="text-[13px] text-green underline-offset-4 hover:underline">
                  Week
                </Link>
              </CardHeader>
              {targets.length === 0 ? (
                <p className="text-[13px] text-muted">No metrics yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5 text-sm">
                  {targets.map((target) => {
                    const value = scoreByMetric.get(target.metric) ?? 0;
                    return (
                      <div key={target.metric}>
                        <div className="flex justify-between">
                          <span>{target.label}</span>
                          <span className="money">
                            {value} / {target.target}
                          </span>
                        </div>
                        <Meter className="mt-1.5" value={percent(value, target.target)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-2.5">
              <CardHeader title="Spend watch · 6-mo avg">
                <Link href="/spend" className="text-[13px] text-green underline-offset-4 hover:underline">
                  Spend
                </Link>
              </CardHeader>
              {averages.length === 0 ? (
                <p className="text-[13px] text-muted">Import a statement to see this.</p>
              ) : (
                averages.map((row) => (
                  <div key={row.category} className="flex justify-between text-sm">
                    <span>{categoryLabel.get(row.category) ?? row.category}</span>
                    <MoneyCents cents={row.averageCents} symbol={false} />
                  </div>
                ))
              )}
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="mt-1 flex items-start justify-between gap-2 rounded-lg bg-alert-wash px-3 py-2.5 text-[13px] text-alert"
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
        </div>
      </section>

      <Card>
        <CardBody>
          <CardHeader title="Clients">
            <Link href="/clients" className="text-[13px] text-green underline-offset-4 hover:underline">
              All clients
            </Link>
          </CardHeader>
          {activeClients.length === 0 ? (
            <p className="text-[13px] text-muted">No clients yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {activeClients.map((client) => {
                const mrrCents = subsByClient.get(client.id) ?? 0;
                const owedCents = owedByClient.get(client.id) ?? 0;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.slug}`}
                    className="flex flex-col gap-1 rounded-[10px] border border-line p-3.5 transition-colors hover:bg-well"
                  >
                    <span className="text-sm font-semibold">{client.name}</span>
                    <span className="text-xs text-muted">{client.contact_name ?? "—"}</span>
                    <span className="money mt-1.5 text-xs">
                      {mrrCents > 0 ? (
                        <>
                          <MoneyCents cents={mrrCents} />
                          /mo
                        </>
                      ) : owedCents > 0 ? (
                        <span className="text-alert">
                          <MoneyCents cents={owedCents} /> owed
                        </span>
                      ) : (
                        <Badge tone="outline">{client.relationship}</Badge>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
