import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "@/components/pipeline/kanban";
import { DealForm } from "@/components/pipeline/deal-form";
import { getDealAddons, getDeals } from "@/lib/queries/deals";
import { getClients } from "@/lib/queries/clients";
import { getOfferings, getOfferingTiers } from "@/lib/queries/offerings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline · Styfe HQ" };

export default async function PipelinePage() {
  const [deals, clients, offerings] = await Promise.all([getDeals(), getClients(), getOfferings()]);
  const [tiers, addons] = await Promise.all([
    getOfferingTiers(offerings.map((o) => o.id)),
    getDealAddons(deals.map((d) => d.id)),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Lead → Meeting → Proposal → Pilot → Won"
        title="Pipeline"
        actions={
          <DealForm
            clients={clients}
            offerings={offerings}
            tiers={tiers}
            trigger={<Button variant="primary">New deal</Button>}
          />
        }
      />
      <PipelineBoard deals={deals} clients={clients} offerings={offerings} tiers={tiers} addons={addons} />
    </>
  );
}
