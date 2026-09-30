import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MoneyCents } from "@/components/money";
import { priceLine } from "@/lib/offerings";
import { OFFERING_TYPE_LABEL, type OfferingType } from "@/lib/types";
import { toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CatalogueEntry } from "@/lib/queries/offerings";

/** Standard is the default and stays quiet; the other two earn a colour. */
const TYPE_TONE: Record<OfferingType, "outline" | "blue" | "sand"> = {
  standard: "outline",
  custom: "blue",
  addon: "sand",
};

export function OfferingCard({ entry }: { entry: CatalogueEntry }) {
  const { offering, tiers, stats, costing } = entry;

  // The card answers "what do I charge, what does it cost me, what is left".
  // A monthly offering is judged on its monthly numbers, everything else on
  // the once-off ones — showing both would be four figures nobody reads.
  const monthly = offering.pricing_model === "monthly" || offering.pricing_model === "per_unit_monthly";
  const priceCents = toCents(monthly ? costing?.price_monthly_zar : costing?.price_setup_zar);
  const rawCost = monthly ? costing?.cost_monthly_zar : costing?.cost_setup_zar;
  const costed = rawCost !== null && rawCost !== undefined;
  const costCents = toCents(rawCost);
  const marginCents = priceCents - costCents;
  const marginPct = monthly ? costing?.margin_monthly_pct : costing?.margin_setup_pct;

  const liveCount =
    offering.pricing_model === "per_unit_monthly"
      ? (stats?.active_units ?? 0)
      : (stats?.active_subscriptions ?? 0);

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

      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-[13px]">
        <Stat
          label={monthly ? "Price / mo" : "Price"}
          value={priceCents > 0 ? <MoneyCents cents={priceCents} /> : "—"}
        />
        <Stat
          label={monthly ? "Cost / mo" : "My cost"}
          value={costed ? <MoneyCents cents={costCents} /> : "—"}
        />
        <Stat
          label="Margin"
          tone={costed ? (marginCents < 0 ? "alert" : "green") : undefined}
          value={
            costed ? (
              <>
                <MoneyCents cents={marginCents} />
                {marginPct !== null && marginPct !== undefined ? (
                  <span className="ml-1 text-[11px] text-muted">{marginPct}%</span>
                ) : null}
              </>
            ) : (
              "Not costed"
            )
          }
        />
        {liveCount > 0 ? (
          <Stat
            label={offering.unit_label ? `Live ${offering.unit_label}s` : "Live clients"}
            value={String(liveCount)}
          />
        ) : null}
      </dl>
    </article>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "green" | "alert";
}) {
  return (
    <div className="rounded-lg bg-well px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">{label}</dt>
      <dd
        className={cn(
          "money mt-1 text-[13px] font-medium",
          tone === "alert" ? "text-alert" : tone === "green" ? "text-green-deep" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
