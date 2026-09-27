"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveSettings } from "@/lib/actions/settings";
import type { ResolvedSettings } from "@/lib/queries/settings";
import type { ActionResult } from "@/lib/actions/helpers";

export function SettingsForm({ settings }: { settings: ResolvedSettings }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveSettings, null);
  const [vat, setVat] = React.useState(settings.vatEnabled);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast(state.message ?? "Saved.");
    else toast(state.error, "error");
  }, [state, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <CardHeader title="VAT" aside="Prices everywhere are stored ex VAT" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Charge VAT on invoices</p>
              <p className="text-[13px] text-muted">
                Off until you are registered. Invoices then say so in the footer.
              </p>
            </div>
            <Switch name="vat_enabled" checked={vat} onCheckedChange={setVat} aria-label="Charge VAT" />
          </div>
          {vat ? (
            <Field label="VAT rate" hint="15 or 0.15 both work" className="max-w-[160px]">
              <Input name="vat_rate" defaultValue={settings.vatRate} inputMode="decimal" />
            </Field>
          ) : (
            <input type="hidden" name="vat_rate" value={settings.vatRate} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Invoicing" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Number prefix" hint="Invoices read STY-0001">
              <Input name="invoice_prefix" defaultValue={settings.invoicePrefix} maxLength={10} />
            </Field>
            <Field label="Next number">
              <Input name="next_invoice_number" inputMode="numeric" defaultValue={settings.nextInvoiceNumber} />
            </Field>
          </div>
          <Field label="Business name">
            <Input name="business_name" defaultValue={settings.businessName} required />
          </Field>
          <Field label="Business details" hint="Address, registration, banking — printed on every invoice">
            <Textarea name="business_details" defaultValue={settings.businessDetails} className="min-h-[120px]" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Targets" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Secured monthly income target">
              <Input name="mrr_target_zar" inputMode="decimal" defaultValue={settings.mrrTargetCents / 100} />
            </Field>
            <Field label="Personal spend cap (per month)">
              <Input name="spend_cap_zar" inputMode="decimal" defaultValue={settings.spendCapCents / 100} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <SubmitButton variant="primary" className="self-start">
        Save settings
      </SubmitButton>
    </form>
  );
}
