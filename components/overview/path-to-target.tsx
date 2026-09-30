import { MoneyCents } from "@/components/money";
import type { PathSegmentProgress } from "@/lib/queries/money";
import { formatZar } from "@/lib/money";

const FALLBACK_COLORS = ["#1D1D1F", "#197A30", "#0B63C5", "#8A5A00", "#86868B"];

export function PathToTarget({
  segments,
  targetCents,
}: {
  segments: PathSegmentProgress[];
  targetCents: number;
}) {
  const totalTarget = segments.reduce((acc, s) => acc + s.targetCents, 0) || targetCents || 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-5 overflow-hidden rounded-md bg-track" role="img" aria-label="Target mix">
        {segments.map((segment, index) => (
          <div
            key={segment.segment.id}
            style={{
              width: `${(segment.targetCents / totalTarget) * 100}%`,
              background: segment.segment.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
            }}
            title={`${segment.segment.label} — ${formatZar(segment.targetCents / 100)}`}
          />
        ))}
      </div>

      <dl className="flex flex-col divide-y divide-line text-sm">
        {segments.map((segment) => (
          <div key={segment.segment.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="font-medium text-ink">{segment.segment.label}</dt>
            <dd className="money whitespace-nowrap text-right">
              <MoneyCents cents={segment.targetCents} symbol={false} />
              <div className={`mt-0.5 font-sans text-[11px] ${segment.actualCents > 0 ? "text-green-deep" : "text-muted"}`}>
                {segment.detail}
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
