"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveDeal } from "@/lib/actions/deals";
import { DEAL_STAGES, DEAL_STAGE_LABEL, type Client, type Deal, type Offering, type OfferingTier } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function DealForm({
  deal,
  clients,
  offerings,
  tiers,
  trigger,
  defaultStage,
}: {
  deal?: Deal;
  clients: Client[];
  offerings: Offering[];
  tiers: OfferingTier[];
  trigger: React.ReactNode;
  defaultStage?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveDeal, null);

  const [offeringId, setOfferingId] = React.useState(deal?.offering_id ?? "");
  const [tierId, setTierId] = React.useState(deal?.tier_id ?? "");
  const [units, setUnits] = React.useState(String(deal?.units ?? 1));
  const [monthly, setMonthly] = React.useState(
    deal?.monthly_value_zar != null ? String(Number(deal.monthly_value_zar)) : "",
  );
  const [onceOff, setOnceOff] = React.useState(
    deal?.once_off_value_zar != null ? String(Number(deal.once_off_value_zar)) : "",
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  const offering = offerings.find((o) => o.id === offeringId);
  const offeringTiers = tiers.filter((t) => t.offering_id === offeringId);

  /** Values pre-fill from the offering (or tier) and can be overridden. */
  function applyOffering(id: string) {
    setOfferingId(id);
    setTierId("");
    const picked = offerings.find((o) => o.id === id);
    if (!picked) return;
    setMonthly(picked.monthly_fee_zar != null ? String(Number(picked.monthly_fee_zar)) : "");
    setOnceOff(picked.setup_fee_zar != null ? String(Number(picked.setup_fee_zar)) : "");
  }

  function applyTier(id: string) {
    setTierId(id);
    const tier = tiers.find((t) => t.id === id);
    if (!tier) return;
    setMonthly(tier.monthly_fee_zar != null ? String(Number(tier.monthly_fee_zar)) : "");
    setOnceOff(tier.setup_fee_zar != null ? String(Number(tier.setup_fee_zar)) : "");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        title={deal ? deal.title : "New deal"}
        description={offering?.unit_label ? `Priced per ${offering.unit_label}` : undefined}
      >
        <form action={formAction} className="flex flex-col gap-5">
          {deal ? <input type="hidden" name="id" value={deal.id} /> : null}

          <Field label="Title">
            <Input name="title" required defaultValue={deal?.title} placeholder="Mitmak Motors" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Offering">
              <Select name="offering_id" value={offeringId} onChange={(e) => applyOffering(e.target.value)}>
                <option value="">None</option>
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tier">
              <Select
                name="tier_id"
                value={tierId}
                onChange={(e) => applyTier(e.target.value)}
                disabled={offeringTiers.length === 0}
              >
                <option value="">{offeringTiers.length ? "No tier" : "No tiers"}</option>
                {offeringTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Select name="client_id" defaultValue={deal?.client_id ?? ""}>
                <option value="">Not a client yet</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stage">
              <Select name="stage" defaultValue={deal?.stage ?? defaultStage ?? "lead"}>
                {DEAL_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {DEAL_STAGE_LABEL[stage]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label={offering?.unit_label ? `${offering.unit_label}s` : "Units"}>
              <Input name="units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />
            </Field>
            <Field label="Monthly value">
              <Input
                name="monthly_value_zar"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Once-off value">
              <Input
                name="once_off_value_zar"
                inputMode="decimal"
                value={onceOff}
                onChange={(e) => setOnceOff(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Contact">
              <Input name="contact_name" defaultValue={deal?.contact_name ?? ""} />
            </Field>
            <Field label="Phone">
              <Input name="contact_phone" type="tel" defaultValue={deal?.contact_phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="contact_email" type="email" defaultValue={deal?.contact_email ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label="Next step">
              <Input name="next_step" defaultValue={deal?.next_step ?? ""} placeholder="Send retainer pitch" />
            </Field>
            <Field label="When">
              <Input type="date" name="next_step_at" defaultValue={deal?.next_step_at ?? ""} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea name="notes" defaultValue={deal?.notes ?? ""} />
          </Field>

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-paper px-5 py-4 sm:-mx-6 sm:px-6">
            <SubmitButton variant="primary">{deal ? "Save deal" : "Add deal"}</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
