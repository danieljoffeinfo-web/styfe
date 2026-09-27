import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Scorecard } from "@/components/week/scorecard";
import { TargetEditor } from "@/components/week/target-editor";
import { CountLineChart } from "@/components/charts/simple-charts";
import { getWeeklyScores, getWeeklyTargets } from "@/lib/queries/misc";
import { formatDateCompact, todayIso, weekStartIso } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Week · Styfe HQ" };

export default async function WeekPage() {
  const weekStart = weekStartIso(todayIso());
  const [targets, scores] = await Promise.all([getWeeklyTargets(), getWeeklyScores(12)]);

  const thisWeek: Record<string, number> = {};
  for (const score of scores) {
    if (score.week_start === weekStart) thisWeek[score.metric] = score.value;
  }

  const weeks = [...new Set(scores.map((s) => s.week_start))].sort();
  const history = targets.map((target) => ({
    target,
    series: weeks.map((week) => ({
      label: formatDateCompact(week),
      value: scores.find((s) => s.week_start === week && s.metric === target.metric)?.value ?? 0,
    })),
  }));

  return (
    <>
      <PageHeader eyebrow={`Week of ${formatDateCompact(weekStart)}`} title="Week" />

      <Card>
        <CardBody>
          <CardHeader title="This week" aside="Tap + as you do the work" />
          <Scorecard targets={targets} values={thisWeek} weekStart={weekStart} />
        </CardBody>
      </Card>

      {weeks.length > 1 ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {history.map(({ target, series }) => (
            <Card key={target.metric}>
              <CardBody>
                <CardHeader title={target.label} aside={`target ${target.target}`} />
                <CountLineChart data={series} />
              </CardBody>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardBody>
            <p className="text-[13px] text-muted">
              History appears once you have more than one week logged.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <CardHeader title="Metrics and targets" />
          <TargetEditor targets={targets} />
        </CardBody>
      </Card>
    </>
  );
}
