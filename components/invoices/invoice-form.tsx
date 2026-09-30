"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/ui/toast";
import { MoneyCents } from "@/components/money";
import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import { toCents, vatOnCents } from "@/lib/money";
import { addDaysIso, todayIso } from "@/lib/dates";
import type { Client, InvoiceLine, InvoiceView, Offering, OfferingTier } from "@/lib/types";
import type { ResolvedSettings } from "@/lib/queries/settings";
import type { ActionResult } from "@/lib/actions/helpers";

interface Line {
  key: string;
  description: string;
  qty: string;
  unitPrice: string;
  offeringId: string;
  tierId: string;
}

const blankLine = (): Line => ({
  key: crypto.randomUUID(),
  description: "",
  qty: "1",
  unitPrice: "",
  offeringId: "",
  tierId: "",
});

export function InvoiceForm({
  invoice,
  lines: existingLines,
  clients,
  offerings,
  tiers,
  settings,
  defaultClientId,
}: {
  invoice?: InvoiceView;
  lines?: InvoiceLine[];
  clients: Client[];
  offerings: Offering[];
  tiers: OfferingTier[];
  settings: ResolvedSettings;
  defaultClientId?: string;
}) {
  const toast = useToast();
  const action = invoice ? updateInvoice : createInvoice;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  const [lines, setLines] = React.useState<Line[]>(() =>
    existingLines?.length
      ? existingLines.map((line) => ({
          key: line.id,
          description: line.description,
          qty: String(Number(line.qty)),
          unitPrice: String(Number(line.unit_price_zar)),
          offeringId: line.offering_id ?? "",
          tierId: line.tier_id ?? "",
        }))
      : [blankLine()],
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast(state.message ?? "Saved.");
    else toast(state.error, "error");
  }, [state, toast]);

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  /** Picking an offering or tier pre-fills the description and price; both stay editable. */
  function pick(key: string, value: string) {
    if (!value) {
      update(key, { offeringId: "", tierId: "" });
      return;
    }
    const [kind, id] = value.split(":");
    if (kind === "offering") {
      const offering = offerings.find((o) => o.id === id);
      if (!offering) return;
      const price = offering.setup_fee_zar ?? offering.monthly_fee_zar ?? "";
      update(key, {
        offeringId: offering.id,
        tierId: "",
        description: offering.name,
        unitPrice: price === "" ? "" : String(Number(price)),
      });
    } else {
      const tier = tiers.find((t) => t.id === id);
      if (!tier) return;
      const offering = offerings.find((o) => o.id === tier.offering_id);
      const price = tier.setup_fee_zar ?? tier.monthly_fee_zar ?? "";
      update(key, {
        offeringId: tier.offering_id,
        tierId: tier.id,
        description: offering ? `${offering.name} — ${tier.name}` : tier.name,
        unitPrice: price === "" ? "" : String(Number(price)),
      });
    }
  }

  const subtotalCents = lines.reduce(
    (acc, line) => acc + Math.round((Number(line.qty) || 0) * toCents(line.unitPrice)),
    0,
  );
  const vatCents = vatOnCents(subtotalCents, settings.vatEnabled, settings.vatRate);

  const today = todayIso();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}

      <Card>
        <CardBody>
          <CardHeader title={invoice ? `Invoice ${invoice.number}` : "New invoice"} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Client">
              <Select name="client_id" required defaultValue={invoice?.client_id ?? defaultClientId ?? ""}>
                <option value="" disabled>
                  Pick a client
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Issued">
              <DateInput name="issued_at" defaultValue={invoice?.issued_at ?? today} />
            </Field>
            <Field label="Due">
              <DateInput name="due_at" defaultValue={invoice?.due_at ?? addDaysIso(today, 30)} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={invoice?.status ?? "draft"}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Lines" aside="Pick an offering to pre-fill, or type your own" />

          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-2 rounded-[10px] border border-line p-3 sm:grid-cols-[1.2fr_2fr_70px_120px_44px] sm:items-end sm:border-0 sm:p-0"
              >
                <Field label={index === 0 ? "From catalogue" : ""} className="sm:[&>span]:sr-only">
                  <Select
                    aria-label="Offering"
                    value={line.tierId ? `tier:${line.tierId}` : line.offeringId ? `offering:${line.offeringId}` : ""}
                    onChange={(e) => pick(line.key, e.target.value)}
                  >
                    <option value="">Free text</option>
                    {offerings.map((offering) => (
                      <optgroup key={offering.id} label={offering.name}>
                        <option value={`offering:${offering.id}`}>{offering.name}</option>
                        {tiers
                          .filter((t) => t.offering_id === offering.id)
                          .map((tier) => (
                            <option key={tier.id} value={`tier:${tier.id}`}>
                              {tier.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>

                <Field label={index === 0 ? "Description" : ""} className="sm:[&>span]:sr-only">
                  <Input
                    name="line_description"
                    aria-label="Description"
                    value={line.description}
                    onChange={(e) => update(line.key, { description: e.target.value })}
                    placeholder="What you are billing for"
                  />
                </Field>

                <Field label={index === 0 ? "Qty" : ""} className="sm:[&>span]:sr-only">
                  <Input
                    name="line_qty"
                    aria-label="Quantity"
                    inputMode="decimal"
                    value={line.qty}
                    onChange={(e) => update(line.key, { qty: e.target.value })}
                  />
                </Field>

                <Field label={index === 0 ? "Unit price" : ""} className="sm:[&>span]:sr-only">
                  <Input
                    name="line_unit_price"
                    aria-label="Unit price"
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                    placeholder="0"
                  />
                </Field>

                <input type="hidden" name="line_offering_id" value={line.offeringId} />
                <input type="hidden" name="line_tier_id" value={line.tierId} />

                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1 ? [blankLine()] : current.filter((l) => l.key !== line.key),
                    )
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-control text-muted hover:bg-well hover:text-alert"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <Button className="self-start" onClick={() => setLines((current) => [...current, blankLine()])}>
            <Plus /> Add line
          </Button>

          <dl className="ml-auto flex w-full max-w-[280px] flex-col gap-1.5 border-t border-line pt-3 text-sm">
            <Row label="Subtotal" value={<MoneyCents cents={subtotalCents} withCents />} />
            {settings.vatEnabled ? (
              <Row label={`VAT ${Math.round(settings.vatRate * 100)}%`} value={<MoneyCents cents={vatCents} withCents />} />
            ) : null}
            <Row
              label="Total"
              strong
              value={<MoneyCents cents={subtotalCents + vatCents} withCents />}
            />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Field label="Notes" hint="Shows on the printable invoice">
            <Textarea name="notes" defaultValue={invoice?.notes ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex gap-2">
        <SubmitButton variant="primary">{invoice ? "Save invoice" : "Create invoice"}</SubmitButton>
      </div>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd className="money">{value}</dd>
    </div>
  );
}
