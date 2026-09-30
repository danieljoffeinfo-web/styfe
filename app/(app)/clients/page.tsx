import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const mrrCents = mrrByClient.get(client.id) ?? 0;
            const owedCents = owedByClient.get(client.id) ?? 0;

            return (
              <Link
                key={client.id}
                href={`/clients/${client.slug}`}
                className="group flex min-h-[166px] flex-col rounded-xl border border-line bg-card p-5 transition-colors hover:border-control hover:bg-[#fcfcfd]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      {client.name}
                    </h2>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {[client.contact_name, client.contact_phone].filter(Boolean).join(" · ") || "No contact yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={client.status === "active" ? "green" : "neutral"}>{client.status}</Badge>
                    <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2 pt-5 text-[13px]">
                  <div className="rounded-lg bg-well px-3 py-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Relationship</div>
                    <div className="mt-1 font-medium text-ink">{client.relationship}</div>
                  </div>
                  <div className="rounded-lg bg-well px-3 py-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                      {mrrCents > 0 ? "MRR" : owedCents > 0 ? "Outstanding" : "Value"}
                    </div>
                    <div className={`money mt-1 font-medium ${owedCents > 0 && !mrrCents ? "text-alert" : "text-ink"}`}>
                      {mrrCents > 0 ? (
                        <>
                          <MoneyCents cents={mrrCents} />/mo
                        </>
                      ) : owedCents > 0 ? (
                        <>
                          <MoneyCents cents={owedCents} /> owed
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
