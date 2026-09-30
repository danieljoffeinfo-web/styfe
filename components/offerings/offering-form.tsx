"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ListEditor } from "@/components/ui/list-editor";
import { PortfolioEditor } from "@/components/ui/portfolio-editor";
import { useToast } from "@/components/ui/toast";
import { createOffering, updateOffering } from "@/lib/actions/offerings";
import { fieldsFor, OFFERING_COLORS } from "@/lib/offerings";
import {
  CATEGORY_SUGGESTIONS,
  OFFERING_TYPE_LABEL,
  PRICING_MODEL_LABEL,
  type Offering,
  type OfferingType,
  type PricingModel,
} from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

const MODELS: PricingModel[] = ["once_off", "monthly", "per_unit_monthly", "quote"];
const TYPES: OfferingType[] = ["standard", "custom", "addon"];

const TYPE_HINT: Record<OfferingType, string> = {
  standard: "A fixed-scope package sold at a list price. Picking it on a deal pre-fills everything.",
  custom: "No list price. The scope and the quote are typed on each deal.",
  addon: "An extra bolted onto a standard or custom sale. Can be once-off or monthly.",
};

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
  const [type, setType] = React.useState<OfferingType>(offering?.offering_type ?? "standard");

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  const isCustom = type === "custom";
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
            <Input name="name" required defaultValue={offering?.name} placeholder="Launch Website" />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink">Type</span>
            <input type="hidden" name="offering_type" value={type} />
            <div role="radiogroup" aria-label="Offering type" className="flex rounded-[10px] border border-line p-0.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => setType(t)}
                  className={
                    type === t
                      ? "flex-1 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-paper"
                      : "flex-1 rounded-lg px-3 py-2 text-[13px] text-muted hover:bg-well hover:text-ink"
                  }
                >
                  {OFFERING_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{TYPE_HINT[type]}</p>
          </div>

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

          {isCustom ? null : (
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
          )}

          {isCustom ? (
            <p className="rounded-[10px] bg-well px-3.5 py-2.5 text-[13px] text-muted">
              Priced per deal. The catalogue shows “Quote”, and each deal carries its own
              scope and quoted amount.
            </p>
          ) : model === "quote" ? (
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

          {shows.units && !isCustom ? (
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

          <section className="flex flex-col gap-3 rounded-[10px] bg-well p-3.5">
            <div>
              <h3 className="text-[13px] font-semibold">What it costs you</h3>
              <p className="text-xs text-muted">
                Your own cost to deliver — sub-contractors, licences, hosting, your time if you
                price it. Blank means not costed yet, which is not the same as free.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Once-off cost">
                <Input
                  name="cost_setup_zar"
                  inputMode="decimal"
                  defaultValue={offering?.cost_setup_zar ?? ""}
                  placeholder="2500"
                />
              </Field>
              <Field label="Monthly cost">
                <Input
                  name="cost_monthly_zar"
                  inputMode="decimal"
                  defaultValue={offering?.cost_monthly_zar ?? ""}
                  placeholder="400"
                />
              </Field>
            </div>
            <Field label="Cost notes" hint="What makes up that number">
              <Textarea
                name="cost_notes"
                rows={2}
                defaultValue={offering?.cost_notes ?? ""}
                placeholder="Hosting R120/mo, Cloudinary R280/mo"
              />
            </Field>
          </section>

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

          <Field label="Ideal for" hint="One line on who this is for">
            <Input
              name="ideal_for"
              defaultValue={offering?.ideal_for ?? ""}
              placeholder="Local businesses that need to be found on Google."
            />
          </Field>

          <ListEditor
            name="deliverables"
            label="Deliverables"
            initial={offering?.deliverables ?? []}
            placeholder="Meta Business verification"
          />

          <ListEditor
            name="excludes"
            label="Not included"
            initial={offering?.excludes ?? []}
            placeholder="Meta conversation + broadcast fees"
          />

          <PortfolioEditor initial={offering?.portfolio ?? []} />

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
