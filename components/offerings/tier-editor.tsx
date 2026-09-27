"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ListEditor } from "@/components/ui/list-editor";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { deleteTier, saveTier } from "@/lib/actions/offerings";
import { tierPriceLine } from "@/lib/offerings";
import { PRICING_MODEL_LABEL, type Offering, type OfferingTier, type PricingModel } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

const MODELS: PricingModel[] = ["once_off", "monthly", "per_unit_monthly", "quote"];

export function TierEditor({ offering, tiers }: { offering: Offering; tiers: OfferingTier[] }) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col gap-3">
      {tiers.length === 0 ? (
        <p className="text-[13px] text-muted">
          No tiers. Add one when an offering comes in packages — Basic and Full API, say.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tiers.map((tier) => (
            <li
              key={tier.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line p-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{tier.name}</p>
                <p className="money text-[13px] text-muted">{tierPriceLine(tier, offering)}</p>
                {tier.description ? (
                  <p className="mt-1 text-[13px] text-muted">{tier.description}</p>
                ) : null}
                {tier.deliverables?.length ? (
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    {tier.deliverables.map((d) => (
                      <li key={d}>· {d}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex gap-2">
                <TierSheet
                  offering={offering}
                  tier={tier}
                  trigger={<Button size="sm">Edit</Button>}
                />
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Remove the ${tier.name} tier?`)) return;
                    startTransition(async () => {
                      const result = await deleteTier(tier.id);
                      if (!result.ok) toast(result.error, "error");
                      else toast(result.message ?? "Removed.");
                    });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TierSheet
        offering={offering}
        trigger={
          <Button className="self-start">
            <Plus /> Add a tier
          </Button>
        }
      />
    </div>
  );
}

function TierSheet({
  offering,
  tier,
  trigger,
}: {
  offering: Offering;
  tier?: OfferingTier;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveTier, null);
  const [model, setModel] = React.useState<PricingModel>(tier?.pricing_model ?? offering.pricing_model);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent title={tier ? tier.name : "New tier"} description={offering.name}>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="offering_id" value={offering.id} />
          {tier ? <input type="hidden" name="id" value={tier.id} /> : null}

          <Field label="Name">
            <Input name="name" required defaultValue={tier?.name} placeholder="Full API Integration" />
          </Field>

          <Field label="Pricing model">
            <Select
              name="pricing_model"
              value={model}
              onChange={(e) => setModel(e.target.value as PricingModel)}
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {PRICING_MODEL_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>

          {model === "quote" ? null : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Setup fee (ex VAT)">
                <Input name="setup_fee_zar" inputMode="decimal" defaultValue={tier?.setup_fee_zar ?? ""} />
              </Field>
              {model !== "once_off" ? (
                <Field label="Monthly fee (ex VAT)">
                  <Input name="monthly_fee_zar" inputMode="decimal" defaultValue={tier?.monthly_fee_zar ?? ""} />
                </Field>
              ) : null}
            </div>
          )}

          <Field label="Description">
            <Textarea name="description" defaultValue={tier?.description ?? ""} />
          </Field>

          <ListEditor name="deliverables" label="Deliverables" initial={tier?.deliverables ?? []} />

          <div className="flex gap-2">
            <SubmitButton variant="primary">Save tier</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
