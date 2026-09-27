import { MoneyCents } from "@/components/money";
import type { PathSegmentProgress } from "@/lib/queries/money";
import { formatZar } from "@/lib/money";

const FALLBACK_COLORS = ["#1D6B4F", "#9CC3B0", "#2F5D8A", "#E7DCC8", "#C9A77A"];

export function PathToTarget({
  segments,
  targetCents,
}: {
  segments: PathSegmentProgress[];
  targetCents: number;
}) {
  const totalTarget = segments.reduce((acc, s) => acc + s.targetCents, 0) || targetCents || 1;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex h-7 overflow-hidden rounded-md border border-line" role="img" aria-label="Target mix">
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

      <dl className="flex flex-col gap-2.5 text-sm">
        {segments.map((segment) => (
          <div key={segment.segment.id} className="flex items-baseline justify-between gap-3">
            <dt>{segment.segment.label}</dt>
            <dd className="money whitespace-nowrap">
              <MoneyCents cents={segment.targetCents} symbol={false} /> ·{" "}
              <span className={segment.actualCents > 0 ? "text-green-deep" : "text-muted"}>
                {segment.detail}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
