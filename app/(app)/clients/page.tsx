import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyCents } from "@/components/money";
import { ClientForm } from "@/components/clients/client-form";
import { getClients, getSubscriptions } from "@/lib/queries/clients";
import { getReceivables } from "@/lib/queries/invoices";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients · Styfe HQ" };

export default async function ClientsPage() {
  const [clients, subscriptions, receivables] = await Promise.all([
    getClients(),
    getSubscriptions(),
    getReceivables(),
  ]);

  const mrrByClient = new Map<string, number>();
  for (const sub of subscriptions.filter((s) => s.status === "active")) {
    mrrByClient.set(sub.client_id, (mrrByClient.get(sub.client_id) ?? 0) + toCents(sub.monthly_fee_zar) * sub.units);
  }
  const owedByClient = new Map<string, number>();
  for (const invoice of receivables) {
    owedByClient.set(invoice.client_id, (owedByClient.get(invoice.client_id) ?? 0) + toCents(invoice.total_zar));
  }

  return (
    <>
      <PageHeader
        eyebrow="Who you work with"
        title="Clients"
        actions={<ClientForm trigger={<Button variant="primary">New client</Button>} />}
      />

      {clients.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-muted">No clients yet.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const mrrCents = mrrByClient.get(client.id) ?? 0;
            const owedCents = owedByClient.get(client.id) ?? 0;
            return (
              <Link
                key={client.id}
                href={`/clients/${client.slug}`}
                className="flex flex-col gap-2 rounded-[14px] border border-line bg-card p-5 transition-colors hover:bg-well"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{client.name}</h2>
                  <Badge tone={client.status === "active" ? "green" : "neutral"}>{client.status}</Badge>
                </div>
                <p className="text-[13px] text-muted">
                  {[client.contact_name, client.contact_phone].filter(Boolean).join(" · ") || "No contact yet"}
                </p>
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[13px]">
                  <span className="money">
                    {mrrCents > 0 ? (
                      <>
                        <MoneyCents cents={mrrCents} />
                        /mo
                      </>
                    ) : (
                      <span className="text-muted">{client.relationship}</span>
                    )}
                  </span>
                  {owedCents > 0 ? (
                    <span className="money text-alert">
                      <MoneyCents cents={owedCents} /> owed
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
