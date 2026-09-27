import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getClients } from "@/lib/queries/clients";
import { getOfferings, getOfferingTiers } from "@/lib/queries/offerings";
import { getSettings } from "@/lib/queries/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "New invoice · Styfe HQ" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const [clients, offerings, settings] = await Promise.all([
    getClients(),
    getOfferings(),
    getSettings(),
  ]);
  const tiers = await getOfferingTiers(offerings.map((o) => o.id));
  const defaultClientId = clients.find((c) => c.slug === client)?.id;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/invoices" className="hover:underline">
            ← Invoices
          </Link>
        }
        title="New invoice"
      />
      {clients.length === 0 ? (
        <p className="rounded-[10px] bg-alert-wash px-4 py-3 text-[13px] text-alert">
          Add a client first — <Link href="/clients" className="underline">Clients</Link>.
        </p>
      ) : (
        <InvoiceForm
          clients={clients}
          offerings={offerings}
          tiers={tiers}
          settings={settings}
          defaultClientId={defaultClientId}
        />
      )}
    </>
  );
}
