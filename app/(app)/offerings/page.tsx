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
        actions={
          <>
            <PriceSheetButton text={sheet} />
            <Button asChild variant="ghost">
              <Link href={showArchived ? "/offerings" : "/offerings?archived=1"}>
                {showArchived ? "Hide archived" : "Show archived"}
              </Link>
            </Button>
            <OfferingForm
              categories={categories}
              trigger={<Button variant="primary">New offering</Button>}
            />
          </>
        }
      />

      <OfferingsGrid entries={entries} categories={categories} />
    </>
  );
}
