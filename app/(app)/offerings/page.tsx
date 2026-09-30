import Link from "next/link";
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

  return (
    <>
      <PageHeader
        eyebrow="Products & services"
        title="Offerings"
        subtitle="Manage what Styfe sells, how it is priced and how each offering performs."
        actions={
          <>
            <PriceSheetButton text={sheet} />
            <Button asChild variant="ghost">
              <Link href={showArchived ? "/offerings" : "/offerings?archived=1"}>
                {showArchived ? "Hide archived" : "Show archived"}
              </Link>
            </Button>
            <OfferingForm categories={categories} trigger={<Button variant="primary">New offering</Button>} />
          </>
        }
      />

      {categories.length ? (
        <nav aria-label="Offering categories" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Link
            href="#all-offerings"
            className="flex h-9 shrink-0 items-center rounded-lg border border-ink bg-ink px-3 text-[12.5px] font-medium text-white"
          >
            All
            <span className="ml-1.5 text-white/60">{entries.length}</span>
          </Link>
          {categories.map((category) => {
            const count = entries.filter((entry) => entry.offering.category === category).length;
            const id = category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            return (
              <Link
                key={category}
                href={`#offering-${id}`}
                className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-card px-3 text-[12.5px] font-medium text-muted transition-colors hover:border-control hover:text-ink"
              >
                {category}
                <span className="ml-1.5 text-muted-dark">{count}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div id="all-offerings">
        <OfferingsGrid entries={entries} categories={categories} />
      </div>
    </>
  );
}
