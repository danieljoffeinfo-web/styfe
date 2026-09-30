import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MoneyCents } from "@/components/money";
import { priceLine } from "@/lib/offerings";
import { OFFERING_TYPE_LABEL, type OfferingType } from "@/lib/types";
import { toCents } from "@/lib/money";
import type { CatalogueEntry } from "@/lib/queries/offerings";

/** Standard is the default and stays quiet; the other two earn a colour. */
const TYPE_TONE: Record<OfferingType, "outline" | "blue" | "sand"> = {
  standard: "outline",
  custom: "blue",
  addon: "sand",
};

export function OfferingCard({ entry }: { entry: CatalogueEntry }) {
  const { offering, tiers, stats } = entry;
  const mrrCents = toCents(stats?.mrr_zar);
  const pipelineCents = toCents(stats?.pipeline_value_zar);
  const revenueCents = toCents(stats?.revenue_ytd_zar);

  return (
    <article className="group flex h-full flex-col gap-4 rounded-xl border border-line bg-card p-5 transition-colors hover:border-control">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/offerings/${offering.slug}`} className="text-[15px] font-semibold tracking-[-0.01em] text-ink hover:underline">
            {offering.name}
          </Link>
          <p className="money mt-1.5 text-[12.5px] text-muted">{priceLine(offering)}</p>
        </div>
        <span
          aria-hidden
          className="mt-1 size-2.5 shrink-0 rounded-full"
          style={{ background: offering.color ?? "#86868B" }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={TYPE_TONE[offering.offering_type]}>
          {OFFERING_TYPE_LABEL[offering.offering_type]}
        </Badge>
        <Badge tone={offering.kind === "product" ? "blue" : "green"}>{offering.kind}</Badge>
        {offering.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
        {tiers.length ? <Badge tone="outline">{tiers.length} tiers</Badge> : null}
        {offering.delivery_days ? <Badge tone="outline">{offering.delivery_days}d</Badge> : null}
      </div>

      {offering.description ? (
        <p className="line-clamp-2 min-h-[40px] text-[13px] leading-relaxed text-muted">{offering.description}</p>
      ) : null}

      {offering.portfolio?.length ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          {offering.portfolio.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue underline underline-offset-4 hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-4 text-[13px]">
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
          label={`Pipeline · 12mo${stats?.open_deals ? ` (${stats.open_deals})` : ""}`}
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
    <div className="rounded-lg bg-well px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">{label}</dt>
      <dd className="money mt-1 text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}
