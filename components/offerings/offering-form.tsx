"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ListEditor } from "@/components/ui/list-editor";
import { useToast } from "@/components/ui/toast";
import { createOffering, updateOffering } from "@/lib/actions/offerings";
import { fieldsFor, OFFERING_COLORS } from "@/lib/offerings";
import { CATEGORY_SUGGESTIONS, PRICING_MODEL_LABEL, type Offering, type PricingModel } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

const MODELS: PricingModel[] = ["once_off", "monthly", "per_unit_monthly", "quote"];

export function OfferingForm({
  offering,
  categories,
  trigger,
}: {
  offering?: Offering;
  categories: string[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const action = offering ? updateOffering : createOffering;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const [model, setModel] = React.useState<PricingModel>(offering?.pricing_model ?? "once_off");

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  const shows = fieldsFor(model);
  const suggestions = [...new Set([...categories, ...CATEGORY_SUGGESTIONS])];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        title={offering ? offering.name : "New offering"}
        description={
          offering ? "Everything linked to it updates too." : "A product or service you sell."
        }
      >
        <form action={formAction} className="flex flex-col gap-5">
          {offering ? <input type="hidden" name="id" value={offering.id} /> : null}
          {offering ? <input type="hidden" name="status" value={offering.status} /> : null}

          <Field label="Name">
            <Input name="name" required defaultValue={offering?.name} placeholder="Standard Website Build" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select name="kind" defaultValue={offering?.kind ?? "service"}>
                <option value="service">Service</option>
                <option value="product">Product</option>
              </Select>
            </Field>
            <Field label="Category" hint="Free text — pick one or type your own">
              <Input
                name="category"
                required
                list="offering-categories"
                defaultValue={offering?.category ?? "Web"}
              />
              <datalist id="offering-categories">
                {suggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>

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

          {model === "quote" ? (
            <p className="rounded-[10px] bg-well px-3.5 py-2.5 text-[13px] text-muted">
              No list price. The deal carries the quoted amount and the catalogue shows “Quote”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shows.setup ? (
                <Field label="Setup fee (ex VAT)" hint="Leave blank if there is none">
                  <Input
                    name="setup_fee_zar"
                    inputMode="decimal"
                    defaultValue={offering?.setup_fee_zar ?? ""}
                    placeholder="7300"
                  />
                </Field>
              ) : null}
              {shows.monthly ? (
                <Field label="Monthly fee (ex VAT)">
                  <Input
                    name="monthly_fee_zar"
                    inputMode="decimal"
                    defaultValue={offering?.monthly_fee_zar ?? ""}
                    placeholder="7500"
                  />
                </Field>
              ) : null}
            </div>
          )}

          {shows.units ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit label" hint="dealership, school, user…">
                <Input name="unit_label" defaultValue={offering?.unit_label ?? ""} placeholder="dealership" />
              </Field>
              <Field label="Running cost per unit" hint="Used for the margin">
                <Input
                  name="unit_cost_monthly_zar"
                  inputMode="decimal"
                  defaultValue={offering?.unit_cost_monthly_zar ?? ""}
                  placeholder="6000"
                />
              </Field>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery (days)">
              <Input
                name="delivery_days"
                inputMode="numeric"
                defaultValue={offering?.delivery_days ?? ""}
                placeholder="14"
              />
            </Field>
            <Field label="Colour">
              <Select name="color" defaultValue={offering?.color ?? "#1D6B4F"}>
                {OFFERING_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              name="description"
              defaultValue={offering?.description ?? ""}
              placeholder="What the client gets, in a sentence."
            />
          </Field>

          <ListEditor
            name="deliverables"
            label="Deliverables"
            initial={offering?.deliverables ?? []}
            placeholder="Meta Business verification"
          />

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-paper px-5 py-4 sm:-mx-6 sm:px-6">
            <SubmitButton variant="primary">{offering ? "Save offering" : "Add offering"}</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
