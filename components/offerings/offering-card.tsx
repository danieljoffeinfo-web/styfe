import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MoneyCents } from "@/components/money";
import { priceLine } from "@/lib/offerings";
import { toCents } from "@/lib/money";
import type { CatalogueEntry } from "@/lib/queries/offerings";

export function OfferingCard({ entry }: { entry: CatalogueEntry }) {
  const { offering, tiers, stats } = entry;
  const mrrCents = toCents(stats?.mrr_zar);
  const pipelineCents = toCents(stats?.pipeline_value_zar);
  const revenueCents = toCents(stats?.revenue_ytd_zar);

  return (
    <article className="flex h-full flex-col gap-3 rounded-[14px] border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/offerings/${offering.slug}`} className="text-[15px] font-semibold hover:underline">
            {offering.name}
          </Link>
          <p className="money mt-1 text-[13px] text-muted">{priceLine(offering)}</p>
        </div>
        <span
          aria-hidden
          className="mt-1 size-2.5 shrink-0 rounded-full"
          style={{ background: offering.color ?? "#CFCAC0" }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={offering.kind === "product" ? "blue" : "green"}>{offering.kind}</Badge>
        {offering.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
        {tiers.length ? <Badge tone="outline">{tiers.length} tiers</Badge> : null}
        {offering.delivery_days ? <Badge tone="outline">{offering.delivery_days}d</Badge> : null}
      </div>

      {offering.description ? (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">{offering.description}</p>
      ) : null}

      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line-soft pt-3 text-[13px]">
        <Stat
          label={offering.unit_label ? `Live ${offering.unit_label}s` : "Live subs"}
          value={String(
            offering.pricing_model === "per_unit_monthly"
              ? (stats?.active_units ?? 0)
              : (stats?.active_subscriptions ?? 0),
          )}
        />
        <Stat label="MRR" value={<MoneyCents cents={mrrCents} />} />
        <Stat label="Revenue YTD" value={<MoneyCents cents={revenueCents} />} />
        <Stat
          label={`Open deals${stats?.open_deals ? ` (${stats.open_deals})` : ""}`}
          value={<MoneyCents cents={pipelineCents} />}
        />
        {stats?.win_rate_pct !== null && stats?.win_rate_pct !== undefined ? (
          <Stat label="Win rate" value={`${stats.win_rate_pct}%`} />
        ) : null}
      </dl>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="money mt-0.5">{value}</dd>
    </div>
  );
}
