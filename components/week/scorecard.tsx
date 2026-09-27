"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Meter } from "@/components/ui/meter";
import { useToast } from "@/components/ui/toast";
import { bumpWeeklyScore } from "@/lib/actions/misc";
import { percent } from "@/lib/money";
import type { WeeklyTarget } from "@/lib/types";

export function Scorecard({
  targets,
  values,
  weekStart,
}: {
  targets: WeeklyTarget[];
  values: Record<string, number>;
  weekStart: string;
}) {
  const toast = useToast();
  const [scores, setScores] = React.useState(values);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => setScores(values), [values]);

  function bump(metric: string, delta: number) {
    const previous = scores[metric] ?? 0;
    const next = Math.max(0, previous + delta);
    if (next === previous) return;
    setScores((current) => ({ ...current, [metric]: next }));
    startTransition(async () => {
      const result = await bumpWeeklyScore(metric, delta, weekStart);
      if (!result.ok) {
        setScores((current) => ({ ...current, [metric]: previous }));
        toast(result.error, "error");
      }
    });
  }

  if (targets.length === 0) {
    return <p className="text-[13px] text-muted">No metrics yet. Add one below.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {targets.map((target) => {
        const value = scores[target.metric] ?? 0;
        return (
          <div key={target.metric} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{target.label}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bump(target.metric, -1)}
                  aria-label={`One fewer ${target.label}`}
                  disabled={value === 0}
                  className="flex size-11 items-center justify-center rounded-[10px] border border-control bg-card hover:bg-well disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span className="money w-[74px] text-center text-lg">
                  {value} / {target.target}
                </span>
                <button
                  type="button"
                  onClick={() => bump(target.metric, 1)}
                  aria-label={`One more ${target.label}`}
                  className="flex size-11 items-center justify-center rounded-[10px] border-0 bg-green text-white hover:bg-green-deep"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <Meter value={percent(value, target.target)} />
          </div>
        );
      })}
    </div>
  );
}
