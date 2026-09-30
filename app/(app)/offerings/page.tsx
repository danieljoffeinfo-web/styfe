import Link from "next/link";
import { Boxes, Clock3, UsersRound, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { OfferingsGrid } from "@/components/offerings/offerings-grid";
import { OfferingForm } from "@/components/offerings/offering-form";
import { PriceSheetButton } from "@/components/offerings/price-sheet-button";
import { getCatalogue } from "@/lib/queries/offerings";
import { getSettings } from "@/lib/queries/settings";
import { priceSheet } from "@/lib/offerings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offerings · Styfe HQ" };

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const [entries, settings] = await Promise.all([getCatalogue(showArchived), getSettings()]);
  const categories = [...new Set(entries.map((e) => e.offering.category))].sort();
  const sheet = priceSheet(entries, settings.businessName);

  const activeEntries = entries.filter((entry) => entry.offering.status === "active");
  // MRR and pipeline both read R0 and answered nothing. What the catalogue can
  // actually tell you is whether it is priced properly.
  const costedEntries = activeEntries.filter(
    (entry) =>
      entry.costing?.cost_setup_zar != null || entry.costing?.cost_monthly_zar != null,
  );
  const marginPcts = costedEntries
    .map((entry) =>
      entry.offering.pricing_model === "monthly" ||
      entry.offering.pricing_model === "per_unit_monthly"
        ? entry.costing?.margin_monthly_pct
        : entry.costing?.margin_setup_pct,
    )
    .filter((pct): pct is number => pct !== null && pct !== undefined);
  const averageMarginPct = marginPcts.length
    ? Math.round(marginPcts.reduce((sum, pct) => sum + pct, 0) / marginPcts.length)
    : null;
  const activeRetainers = activeEntries
    .filter((entry) => /retainer/i.test(entry.offering.category))
    .reduce((sum, entry) => sum + (entry.stats?.active_subscriptions ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Products & services"
        title="Offerings"
        subtitle="Manage your products and services."
        actions={
          <>
            <PriceSheetButton text={sheet} />
            <OfferingForm
              categories={categories}
              trigger={<Button variant="primary">New offering</Button>}
            />
          </>
        }
      />

      <section aria-label="Offering summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          icon={<Boxes className="size-4" />}
          label="Total offerings"
          value={String(activeEntries.length)}
          note={showArchived ? "Active shown with archived" : "Active catalogue"}
          tone="blue"
        />
        <Summary
          icon={<UsersRound className="size-4" />}
          label="Active retainers"
          value={String(activeRetainers)}
          note="Live recurring clients"
          tone="green"
        />
        <Summary
          icon={<WalletCards className="size-4" />}
          label="Costed"
          value={`${costedEntries.length} / ${activeEntries.length}`}
          note={
            costedEntries.length === activeEntries.length
              ? "Every offering has a cost"
              : "Add what delivery costs you"
          }
          tone="sand"
        />
        <Summary
          icon={<Clock3 className="size-4" />}
          label="Average margin"
          value={averageMarginPct === null ? "—" : `${averageMarginPct}%`}
          note={averageMarginPct === null ? "Nothing costed yet" : "Across costed offerings"}
          tone="green"
        />
      </section>

      <div className="flex items-center justify-end">
        <Link
          href={showArchived ? "/offerings" : "/offerings?archived=1"}
          className="flex items-center gap-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink"
        >
          <span
            aria-hidden
            className={[
              "relative h-5 w-9 rounded-full transition-colors",
              showArchived ? "bg-ink" : "bg-track",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                showArchived ? "translate-x-[18px]" : "translate-x-0.5",
              ].join(" ")}
            />
          </span>
          Show archived
        </Link>
      </div>

      <OfferingsGrid entries={entries} categories={categories} />
    </>
  );
}

function Summary({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note: string;
  tone: "blue" | "green" | "sand";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-[#EAF2FC] text-blue"
      : tone === "green"
        ? "bg-green-wash text-green-deep"
        : "bg-sand-soft text-sand";

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-lg ${toneClass}`}>{icon}</span>
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
      </div>
      <div className="money mt-3 text-[26px] font-semibold leading-none tracking-[-0.04em] text-ink">
        {value}
      </div>
      <div className="mt-2 text-xs text-muted">{note}</div>
    </div>
  );
}
