"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { sendOfferingEmail } from "@/lib/actions/offering-send";
import type { Client, Offering } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

/**
 * Sends one offering to one client: the saved subject and HTML, with the PDF
 * attached. Both are editable here without touching the saved template, so a
 * one-off tweak for a single client does not rewrite the default.
 */
export function SendOfferingDialog({
  offering,
  clients,
  fromEmail,
  trigger,
}: {
  offering: Offering;
  clients: Client[];
  fromEmail: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(sendOfferingEmail, null);

  const [clientId, setClientId] = React.useState("");
  const [toEmail, setToEmail] = React.useState("");
  const [attach, setAttach] = React.useState(Boolean(offering.pdf_path));

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Sent.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  // Picking a client fills the address from their billing email, falling back
  // to the contact one. Dan can still type over it.
  function pickClient(id: string) {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    setToEmail(client?.billing_email ?? client?.contact_email ?? "");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        title={`Email ${offering.name}`}
        description={fromEmail ? `Sending from ${fromEmail}` : "No sending address set yet"}
      >
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="offering_id" value={offering.id} />

          {!fromEmail ? (
            <p className="rounded-[10px] bg-alert-wash px-3.5 py-2.5 text-[13px] text-alert">
              Set a From email in Settings first. It has to be on a domain you have verified in
              Resend, otherwise the send is rejected.
            </p>
          ) : null}

          <Field label="Client">
            <Select name="client_id" value={clientId} onChange={(e) => pickClient(e.target.value)}>
              <option value="">No client — type an address</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="To">
            <Input
              name="to_email"
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="accounts@client.co.za"
            />
          </Field>

          <Field label="Subject">
            <Input
              name="subject"
              required
              defaultValue={offering.email_subject ?? `${offering.name} — from {{business_name}}`}
            />
          </Field>

          <Field label="Email body (HTML)" hint="{{client_name}}, {{contact_name}}, {{offering_name}}, {{price}}, {{business_name}}">
            <Textarea
              name="html"
              required
              rows={12}
              className="font-mono text-[12px]"
              defaultValue={offering.email_html ?? DEFAULT_HTML}
            />
          </Field>

          <div className="flex items-center justify-between rounded-[10px] bg-well px-3.5 py-3">
            <div>
              <p className="text-[13px] font-medium">Attach the PDF</p>
              <p className="text-xs text-muted">
                {offering.pdf_name ?? "No PDF uploaded for this offering yet."}
              </p>
            </div>
            <input type="hidden" name="attach_pdf" value={attach ? "true" : "false"} />
            <Switch
              checked={attach}
              onCheckedChange={setAttach}
              disabled={!offering.pdf_path}
              aria-label="Attach the PDF"
            />
          </div>

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-paper px-5 py-4 sm:-mx-6 sm:px-6">
            <SubmitButton variant="primary" disabled={!fromEmail}>
              Send it
            </SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const DEFAULT_HTML = `<p>Hi {{contact_name}},</p>
<p>Thanks for your time. I've attached the details on <strong>{{offering_name}}</strong>.</p>
<p>{{price}}</p>
<p>Any questions, just reply to this email.</p>
<p>{{business_name}}</p>`;
