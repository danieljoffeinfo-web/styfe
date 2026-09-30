"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveRevenueEntry } from "@/lib/actions/revenue";
import { todayIso } from "@/lib/dates";
import type { Client, Offering, RevenueEntry } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

/**
 * Revenue is typed in rather than imported, so this is the only way money gets
 * onto the Revenue page and the Overview.
 */
export function RevenueForm({
  entry,
  clients,
  offerings,
  trigger,
}: {
  entry?: RevenueEntry;
  clients: Client[];
  offerings: Offering[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveRevenueEntry, null);
  const [recurring, setRecurring] = React.useState(entry?.recurring ?? false);

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
      <SheetContent
        title={entry ? "Edit revenue" : "Add revenue"}
        description="Money actually received, ex VAT."
      >
        <form action={formAction} className="flex flex-col gap-5">
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" name="date" required defaultValue={entry?.date ?? todayIso()} />
            </Field>
            <Field label="Amount (ex VAT)">
              <Input
                name="amount_zar"
                inputMode="decimal"
                required
                defaultValue={entry?.amount_zar != null ? String(Number(entry.amount_zar)) : ""}
                placeholder="8000"
              />
            </Field>
          </div>

          <Field label="Description">
            <Input
              name="description"
              required
              defaultValue={entry?.description}
              placeholder="Proto Trading — September retainer"
            />
          </Field>

          <div className="flex items-center justify-between rounded-[10px] bg-well px-3.5 py-3">
            <div>
              <p className="text-[13px] font-medium">Recurring</p>
              <p className="text-xs text-muted">
                Retainers and salary. Drives the recurring / once-off split.
              </p>
            </div>
            <input type="hidden" name="recurring" value={recurring ? "true" : "false"} />
            <Switch checked={recurring} onCheckedChange={setRecurring} aria-label="Recurring" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Select name="client_id" defaultValue={entry?.client_id ?? ""}>
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Offering">
              <Select name="offering_id" defaultValue={entry?.offering_id ?? ""}>
                <option value="">No offering</option>
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea name="notes" defaultValue={entry?.notes ?? ""} />
          </Field>

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-paper px-5 py-4 sm:-mx-6 sm:px-6">
            <SubmitButton variant="primary">{entry ? "Save" : "Add revenue"}</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
