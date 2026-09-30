import Link from "next/link";
import { Boxes, Clock3, UsersRound, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { OfferingsGrid } from "@/components/offerings/offerings-grid";
import { OfferingForm } from "@/components/offerings/offering-form";
import { PriceSheetButton } from "@/components/offerings/price-sheet-button";
import { MoneyCents } from "@/components/money";
import { getCatalogue } from "@/lib/queries/offerings";
import { getSettings } from "@/lib/queries/settings";
import { priceSheet } from "@/lib/offerings";
import { toCents } from "@/lib/money";

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
  const totalMrrCents = activeEntries.reduce((sum, entry) => sum + toCents(entry.stats?.mrr_zar), 0);
  const pipelineCents = activeEntries.reduce(
    (sum, entry) => sum + toCents(entry.stats?.pipeline_value_zar),
    0,
  );
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
        />
        <Summary
          icon={<UsersRound className="size-4" />}
          label="Active retainers"
          value={String(activeRetainers)}
          note="Live recurring clients"
        />
        <Summary
          icon={<WalletCards className="size-4" />}
          label="Monthly recurring revenue"
          value={<MoneyCents cents={totalMrrCents} />}
          note="Across active offerings"
        />
        <Summary
          icon={<Clock3 className="size-4" />}
          label="Pipeline value"
          value={<MoneyCents cents={pipelineCents} />}
          note="Open opportunity value"
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
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-well text-muted">{icon}</span>
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
      </div>
      <div className="money mt-3 text-[26px] font-semibold leading-none tracking-[-0.04em] text-ink">
        {value}
      </div>
      <div className="mt-2 text-xs text-muted">{note}</div>
    </div>
  );
}
