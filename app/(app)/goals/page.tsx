import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { MoneyCents } from "@/components/money";
import { GoalForm, DepositForm } from "@/components/goals/goal-form";
import { RemoveEntryButton } from "@/components/goals/remove-entry-button";
import { getGoalEntries, getGoals } from "@/lib/queries/misc";
import { getMrr, getMonthlySpend, personalSpendForMonth, statementMonths } from "@/lib/queries/money";
import { getSettings } from "@/lib/queries/settings";
import { daysToDeadline, formatDate, monthLabelLong } from "@/lib/dates";
import { percent, toCents } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Goals · Styfe HQ" };

export default async function GoalsPage() {
  const [goals, entries, mrr, spend, settings] = await Promise.all([
    getGoals(),
    getGoalEntries(),
    getMrr(),
    getMonthlySpend(),
    getSettings(),
  ]);

  const months = statementMonths(6);
  const currentMonth = months[months.length - 1];
  const personalCents = personalSpendForMonth(spend, currentMonth);

  return (
    <>
      <PageHeader
        eyebrow="What you are working toward"
        title="Goals"
        actions={<GoalForm trigger={<Button variant="primary">New goal</Button>} />}
      />

      {goals.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-muted">No goals yet.</p>
          </CardBody>
        </Card>
      ) : null}

      {goals.map((goal) => {
        const targetCents = toCents(goal.target_zar);
        // MRR and spend-cap goals read live numbers; savings goals read their entries.
        const currentCents =
          goal.kind === "mrr" ? mrr.mrrCents : goal.kind === "spend_cap" ? personalCents : toCents(goal.current_zar);
        const days = daysToDeadline(goal.deadline);
        const isCap = goal.kind === "spend_cap";
        const pct = percent(currentCents, targetCents);
        const goalEntries = entries.filter((e) => e.goal_id === goal.id);

        return (
          <Card key={goal.id}>
            <CardBody>
              <CardHeader title={goal.name}>
                <GoalForm goal={goal} trigger={<Button size="sm">Edit</Button>} />
              </CardHeader>

              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="money text-3xl">
                  <MoneyCents cents={currentCents} />
                  <span className="text-base text-muted"> / <MoneyCents cents={targetCents} /></span>
                </p>
                <p className="text-[13px] text-muted">
                  {isCap
                    ? `${monthLabelLong(currentMonth)} · ${currentCents > targetCents ? "over the cap" : "within the cap"}`
                    : days === null
                      ? "No deadline"
                      : days >= 0
                        ? `${days} days to ${formatDate(goal.deadline)}`
                        : `${Math.abs(days)} days past ${formatDate(goal.deadline)}`}
                </p>
              </div>

              <Meter
                value={pct}
                height={10}
                tone={isCap ? (currentCents > targetCents ? "alert" : "green") : "green"}
              />

              {goal.notes ? <p className="text-[13px] text-muted">{goal.notes}</p> : null}

              {goal.kind === "mrr" ? (
                <p className="text-[13px] text-muted">
                  Reads live MRR from active subscriptions — {mrr.subscriptionCount} running.
                </p>
              ) : goal.kind === "spend_cap" ? (
                <p className="text-[13px] text-muted">
                  Reads personal spend for the current statement month. Change the cap in Settings (currently{" "}
                  <MoneyCents cents={settings.spendCapCents} />
                  ).
                </p>
              ) : (
                <>
                  <DepositForm goal={goal} />
                  {goalEntries.length ? (
                    <ul className="flex flex-col gap-1.5 border-t border-line-soft pt-3 text-sm">
                      {goalEntries.map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted">{formatDate(entry.date)}</span>
                          <span className="min-w-0 flex-1 truncate">{entry.note ?? "Deposit"}</span>
                          <MoneyCents cents={toCents(entry.amount_zar)} sign />
                          <RemoveEntryButton id={entry.id} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        );
      })}
    </>
  );
}
