"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { MoneyCents } from "@/components/money";
import { DealForm } from "./deal-form";
import { WonDialog } from "./won-dialog";
import { moveDeal } from "@/lib/actions/deals";
import { toCents } from "@/lib/money";
import { formatDateCompact, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  type Client,
  type Deal,
  type DealStage,
  type Offering,
  type OfferingTier,
  type DealAddon,
} from "@/lib/types";

export function PipelineBoard({
  deals: initial,
  clients,
  offerings,
  tiers,
  addons,
}: {
  deals: Deal[];
  clients: Client[];
  offerings: Offering[];
  tiers: OfferingTier[];
  addons: DealAddon[];
}) {
  const toast = useToast();
  const [deals, setDeals] = React.useState(initial);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [wonDeal, setWonDeal] = React.useState<Deal | null>(null);
  const [offeringFilter, setOfferingFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [, startTransition] = React.useTransition();

  React.useEffect(() => setDeals(initial), [initial]);

  const offeringById = React.useMemo(() => new Map(offerings.map((o) => [o.id, o])), [offerings]);
  const categories = React.useMemo(
    () => [...new Set(offerings.map((o) => o.category))].sort(),
    [offerings],
  );

  const visible = deals.filter((deal) => {
    if (offeringFilter && deal.offering_id !== offeringFilter) return false;
    if (categoryFilter) {
      const offering = deal.offering_id ? offeringById.get(deal.offering_id) : undefined;
      if ((offering?.category ?? "Unassigned") !== categoryFilter) return false;
    }
    return true;
  });

  function setStage(deal: Deal, stage: DealStage) {
    if (deal.stage === stage) return;
    setDeals((current) => current.map((d) => (d.id === deal.id ? { ...d, stage } : d)));
    startTransition(async () => {
      const result = await moveDeal(deal.id, stage);
      if (!result.ok) {
        setDeals((current) => current.map((d) => (d.id === deal.id ? { ...d, stage: deal.stage } : d)));
        toast(result.error, "error");
        return;
      }
      if (stage === "won") setWonDeal({ ...deal, stage });
    });
  }

  const today = todayIso();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by offering"
          value={offeringFilter}
          onChange={(e) => setOfferingFilter(e.target.value)}
          className="h-10 w-auto min-w-[180px]"
        >
          <option value="">All offerings</option>
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 w-auto min-w-[160px]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        {offeringFilter || categoryFilter ? (
          <Button
            variant="ghost"
            className="h-10"
            onClick={() => {
              setOfferingFilter("");
              setCategoryFilter("");
            }}
          >
            Clear
          </Button>
        ) : null}
        <span className="ml-auto text-[13px] text-muted">{visible.length} deals</span>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {DEAL_STAGES.map((stage) => {
          const column = visible.filter((d) => d.stage === stage);
          const monthlyCents = column.reduce((acc, d) => acc + toCents(d.monthly_value_zar) * d.units, 0);
          const onceOffCents = column.reduce((acc, d) => acc + toCents(d.once_off_value_zar), 0);

          return (
            <section
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const deal = deals.find((d) => d.id === dragging);
                setDragging(null);
                if (deal) setStage(deal, stage);
              }}
              className="flex w-[268px] shrink-0 flex-col gap-2.5 rounded-[10px] bg-well p-3 lg:w-auto lg:flex-1"
            >
              <header className="flex items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold">{DEAL_STAGE_LABEL[stage]}</h2>
                <span className="money text-xs text-muted">{column.length}</span>
              </header>
              {monthlyCents > 0 || onceOffCents > 0 ? (
                <p className="money -mt-1 text-xs text-muted">
                  {monthlyCents > 0 ? (
                    <>
                      <MoneyCents cents={monthlyCents} />
                      /mo
                    </>
                  ) : null}
                  {monthlyCents > 0 && onceOffCents > 0 ? " · " : null}
                  {onceOffCents > 0 ? <MoneyCents cents={onceOffCents} /> : null}
                </p>
              ) : null}

              {column.map((deal) => {
                const offering = deal.offering_id ? offeringById.get(deal.offering_id) : undefined;
                const overdue = deal.next_step_at !== null && deal.next_step_at < today;
                return (
                  <article
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragging(deal.id)}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border border-line bg-card p-3 text-[13px]",
                      dragging === deal.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <DealForm
                        deal={deal}
                        clients={clients}
                        offerings={offerings}
                        tiers={tiers}
                        addons={addons}
                        trigger={
                          <button type="button" className="text-left font-medium hover:underline">
                            {deal.title}
                          </button>
                        }
                      />
                      {offering ? (
                        <span
                          aria-hidden
                          className="mt-1 size-2 shrink-0 rounded-full"
                          style={{ background: offering.color ?? "#CFCAC0" }}
                        />
                      ) : null}
                    </div>

                    {offering ? (
                      <Link href={`/offerings/${offering.slug}`} className="text-xs text-muted hover:underline">
                        {offering.name}
                        {deal.units > 1 ? ` × ${deal.units}` : ""}
                      </Link>
                    ) : null}

                    <p className="money text-xs">
                      {toCents(deal.monthly_value_zar) > 0 ? (
                        <>
                          <MoneyCents cents={toCents(deal.monthly_value_zar) * deal.units} />
                          /mo
                        </>
                      ) : toCents(deal.once_off_value_zar) > 0 ? (
                        <MoneyCents cents={toCents(deal.once_off_value_zar)} />
                      ) : (
                        <span className="text-muted">No value set</span>
                      )}
                    </p>

                    {deal.next_step ? (
                      <p className={cn("text-xs", overdue ? "font-medium text-alert" : "text-muted")}>
                        {deal.next_step}
                        {deal.next_step_at ? ` · ${formatDateCompact(deal.next_step_at)}` : ""}
                      </p>
                    ) : null}

                    <Select
                      aria-label={`Stage for ${deal.title}`}
                      value={deal.stage}
                      onChange={(e) => setStage(deal, e.target.value as DealStage)}
                      className="mt-1 h-9 text-xs"
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {DEAL_STAGE_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                  </article>
                );
              })}

              <DealForm
                clients={clients}
                offerings={offerings}
                tiers={tiers}
                addons={addons}
                defaultStage={stage}
                trigger={
                  <button
                    type="button"
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-dashed border-control text-xs text-muted hover:bg-card"
                  >
                    <Plus className="size-3.5" /> Add
                  </button>
                }
              />
            </section>
          );
        })}
      </div>

      <WonDialog
        deal={wonDeal}
        offering={wonDeal?.offering_id ? (offeringById.get(wonDeal.offering_id) ?? null) : null}
        offerings={offerings}
        addons={addons}
        onClose={() => setWonDeal(null)}
      />
    </>
  );
}
