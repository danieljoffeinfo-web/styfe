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
  // Settings is one long form with a single save. Tracking whether anything
  // has been touched is what lets the bar say so, rather than leaving Dan to
  // guess whether his banking details went anywhere.
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setDirty(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-4"
    >
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
          <CardHeader title="Bank details" aside="Printed on every invoice" />
          <p className="mb-3 text-[13px] text-muted">
            Where clients pay you. Left blank, the invoice simply leaves the section off.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bank">
              <Input name="bank_name" defaultValue={settings.bank.name} placeholder="FNB" />
            </Field>
            <Field label="Account name">
              <Input
                name="bank_account_name"
                defaultValue={settings.bank.accountName}
                placeholder="D Joffe"
              />
            </Field>
            <Field label="Account number">
              <Input
                name="bank_account_number"
                defaultValue={settings.bank.accountNumber}
                inputMode="numeric"
                className="money"
              />
            </Field>
            <Field label="Branch code">
              <Input
                name="bank_branch_code"
                defaultValue={settings.bank.branchCode}
                inputMode="numeric"
                className="money"
                placeholder="250655"
              />
            </Field>
            <Field label="SWIFT / BIC" hint="Only needed for payments from abroad">
              <Input name="bank_swift" defaultValue={settings.bank.swift} className="money" />
            </Field>
            <Field label="Payment reference" hint="Blank uses the invoice number">
              <Input name="payment_reference" defaultValue={settings.bank.reference} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Sending email" aside="Used when you email an offering" />
          <p className="mb-3 text-[13px] text-muted">
            Resend will only deliver to clients from a domain you have verified in its dashboard.
            Until then a send only reaches your own address.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="From name">
              <Input name="from_name" defaultValue={settings.fromName} placeholder="Dan Joffe" />
            </Field>
            <Field label="From email" hint="Must be on a domain verified in Resend">
              <Input
                name="from_email"
                type="email"
                defaultValue={settings.fromEmail}
                placeholder="dan@styfe.co.za"
              />
            </Field>
          </div>
          <Field label="Reply-to" hint="Optional — where replies land if not the from address">
            <Input name="reply_to" type="email" defaultValue={settings.replyTo} />
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

      {/* Sticky, because the bank details sit three cards above the button and
          a save you cannot see is a save that did not happen. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t border-line bg-paper/95 px-1 py-3 backdrop-blur">
        <SubmitButton variant="primary">Save settings</SubmitButton>
        <span className="text-[13px] text-muted">
          {dirty ? "Unsaved changes" : "Saves every section on this page"}
        </span>
      </div>
    </form>
  );
}
