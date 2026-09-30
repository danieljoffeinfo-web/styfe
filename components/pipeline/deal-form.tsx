"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { saveDeal } from "@/lib/actions/deals";
import { dealTotals, isRecurring, priceLine } from "@/lib/offerings";
import { formatZar } from "@/lib/money";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  type Client,
  type Deal,
  type DealAddon,
  type Offering,
  type OfferingTier,
  type PricingModel,
} from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

/** One add-on row as the form holds it before it is posted. */
interface AddonRow {
  key: string;
  offeringId: string;
  qty: string;
  price: string;
  pricingModel: PricingModel;
}

export function DealForm({
  deal,
  clients,
  offerings,
  tiers,
  addons = [],
  trigger,
  defaultStage,
}: {
  deal?: Deal;
  clients: Client[];
  offerings: Offering[];
  tiers: OfferingTier[];
  addons?: DealAddon[];
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
  const [scope, setScope] = React.useState(deal?.scope ?? "");

  const offeringById = React.useMemo(() => new Map(offerings.map((o) => [o.id, o])), [offerings]);
  const addonOfferings = React.useMemo(
    () => offerings.filter((o) => o.offering_type === "addon"),
    [offerings],
  );

  const [rows, setRows] = React.useState<AddonRow[]>(() =>
    addons
      .filter((a) => a.deal_id === deal?.id)
      .map((a, i) => ({
        key: `${a.id}-${i}`,
        offeringId: a.offering_id,
        qty: String(a.qty),
        price: a.price_zar != null ? String(Number(a.price_zar)) : "",
        pricingModel: a.pricing_model,
      })),
  );

  function addRow(offeringId: string) {
    const picked = offeringById.get(offeringId);
    if (!picked) return;
    setRows((current) => [
      ...current,
      {
        key: `${offeringId}-${Date.now()}`,
        offeringId,
        qty: "1",
        price: "",
        pricingModel: picked.pricing_model,
      },
    ]);
  }

  function patchRow(key: string, patch: Partial<AddonRow>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

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
  const isCustom = offering?.offering_type === "custom";

  // What the deal is worth right now, split the way winning it will be actioned.
  const totals = dealTotals(
    { units: Number(units) || 1, once_off_value_zar: onceOff, monthly_value_zar: monthly },
    rows.map((r) => ({
      offering_id: r.offeringId,
      qty: Number(r.qty) || 1,
      price_zar: r.price === "" ? null : r.price,
      pricing_model: r.pricingModel,
    })),
    offeringById,
  );

  /** Values pre-fill from the offering (or tier) and can be overridden. */
  function applyOffering(id: string) {
    setOfferingId(id);
    setTierId("");
    const picked = offerings.find((o) => o.id === id);
    if (!picked) return;
    // A custom build has no list price to pre-fill — the quote is typed here.
    if (picked.offering_type === "custom") {
      setMonthly("");
      setOnceOff("");
      return;
    }
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

          {isCustom ? (
            <Field
              label="Scope"
              hint="What is actually being built. This is carried onto the invoice."
            >
              <Textarea
                name="scope"
                required
                rows={4}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Stock intake portal: supplier uploads, approval queue, Sage export."
              />
            </Field>
          ) : (
            <input type="hidden" name="scope" value="" />
          )}

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

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink">Add-ons</span>

            {rows.length === 0 ? (
              <p className="text-xs text-muted">None. Care plans and extras go here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rows.map((row) => {
                  const picked = offeringById.get(row.offeringId);
                  return (
                    <li key={row.key} className="flex items-end gap-1.5">
                      <input type="hidden" name="addon_offering_id" value={row.offeringId} />
                      <input type="hidden" name="addon_pricing_model" value={row.pricingModel} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{picked?.name ?? "Unknown"}</p>
                        <p className="money text-xs text-muted">
                          {picked ? priceLine(picked) : ""}
                          {isRecurring(row.pricingModel) ? " · monthly" : " · once-off"}
                        </p>
                      </div>

                      <div className="w-14">
                        <Input
                          name="addon_qty"
                          inputMode="numeric"
                          aria-label={`Quantity for ${picked?.name ?? "add-on"}`}
                          value={row.qty}
                          onChange={(e) => patchRow(row.key, { qty: e.target.value })}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          name="addon_price"
                          inputMode="decimal"
                          aria-label={`Price override for ${picked?.name ?? "add-on"}`}
                          placeholder="List"
                          value={row.price}
                          onChange={(e) => patchRow(row.key, { price: e.target.value })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))}
                        aria-label={`Remove ${picked?.name ?? "add-on"}`}
                      >
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            <Select
              aria-label="Add an add-on"
              value=""
              onChange={(e) => {
                if (e.target.value) addRow(e.target.value);
              }}
              disabled={addonOfferings.length === 0}
            >
              <option value="">
                {addonOfferings.length ? "Add an add-on…" : "No add-ons in the catalogue yet"}
              </option>
              {addonOfferings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {priceLine(o)}
                </option>
              ))}
            </Select>

            <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-well px-3.5 py-2.5">
              <span className="text-[13px] text-muted">Deal value</span>
              <Badge tone="outline">
                <span className="money">{formatZar(totals.onceOffCents / 100)} once-off</span>
              </Badge>
              <Badge tone="green">
                <span className="money">{formatZar(totals.monthlyCents / 100)} / month</span>
              </Badge>
            </div>
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
              <DateInput name="next_step_at" defaultValue={deal?.next_step_at ?? ""} />
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
