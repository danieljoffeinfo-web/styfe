"use client";

import * as React from "react";
import { useActionState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { SendOfferingDialog } from "./send-offering-dialog";
import {
  getOfferingPdfUrl,
  removeOfferingPdf,
  saveOfferingTemplate,
  uploadOfferingPdf,
} from "@/lib/actions/offering-send";
import { formatDate } from "@/lib/dates";
import type { Client, Offering, OfferingSend } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

/**
 * Everything that leaves the building for one offering: the PDF, the covering
 * email, the send button and the record of what actually went out.
 */
export function OfferingDeliveryPanel({
  offering,
  clients,
  sends,
  fromEmail,
}: {
  offering: Offering;
  clients: Client[];
  sends: OfferingSend[];
  fromEmail: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <PdfCard offering={offering} clients={clients} fromEmail={fromEmail} />
      <TemplateCard offering={offering} />
      {sends.length ? (
        <Card className="xl:col-span-2">
          <CardBody>
            <CardHeader title="Sent" aside={`${sends.length} recorded`} />
            <ul className="flex flex-col divide-y divide-line-soft text-sm">
              {sends.map((send) => (
                <li key={send.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{send.subject}</p>
                    <p className="text-xs text-muted">
                      {send.to_email} · {formatDate(String(send.created_at).slice(0, 10))}
                    </p>
                    {send.error ? <p className="mt-0.5 text-xs text-alert">{send.error}</p> : null}
                  </div>
                  <Badge tone={send.status === "sent" ? "green" : "alert"}>{send.status}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function PdfCard({
  offering,
  clients,
  fromEmail,
}: {
  offering: Offering;
  clients: Client[];
  fromEmail: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(uploadOfferingPdf, null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Uploaded.");
      formRef.current?.reset();
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  function preview() {
    startTransition(async () => {
      const result = await getOfferingPdfUrl(offering.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      // Signed for ten minutes — the bucket itself stays private.
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeOfferingPdf(offering.id);
      if (!result.ok) toast(result.error, "error");
      else toast(result.message ?? "Removed.");
    });
  }

  return (
    <Card>
      <CardBody>
        <CardHeader title="The PDF" aside="Attached to every send">
          <SendOfferingDialog
            offering={offering}
            clients={clients}
            fromEmail={fromEmail}
            trigger={<Button size="sm" variant="primary">Email it</Button>}
          />
        </CardHeader>

        {offering.pdf_path ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-well px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText className="size-4 shrink-0 text-muted" />
              <span className="truncate text-[13px] font-medium">{offering.pdf_name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" onClick={preview} disabled={pending}>
                Preview
              </Button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                aria-label="Remove the PDF"
                className="flex size-8 items-center justify-center rounded-md text-muted-dark hover:bg-card hover:text-alert"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted">
            Nothing uploaded yet. Clients get this attached to the covering email.
          </p>
        )}

        <form ref={formRef} action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="offering_id" value={offering.id} />
          <Input
            type="file"
            name="pdf"
            accept="application/pdf"
            required
            className="h-11 py-2 text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-well file:px-3 file:py-1.5 file:text-[12px] file:font-medium"
          />
          <SubmitButton className="sm:shrink-0">
            <Upload /> {offering.pdf_path ? "Replace" : "Upload"}
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}

function TemplateCard({ offering }: { offering: Offering }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    saveOfferingTemplate,
    null,
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast(state.message ?? "Saved.");
    else toast(state.error, "error");
  }, [state, toast]);

  return (
    <Card>
      <CardBody>
        <CardHeader title="The covering email" aside="Saved default for this offering" />
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="offering_id" value={offering.id} />

          <Field label="Subject">
            <Input
              name="email_subject"
              defaultValue={offering.email_subject ?? ""}
              placeholder={`${offering.name} — from {{business_name}}`}
            />
          </Field>

          <Field
            label="Body (HTML)"
            hint="Tokens: {{client_name}}, {{contact_name}}, {{offering_name}}, {{price}}, {{business_name}}"
          >
            <Textarea
              name="email_html"
              rows={12}
              className="font-mono text-[12px]"
              defaultValue={offering.email_html ?? ""}
              placeholder="<p>Hi {{contact_name}},</p>"
            />
          </Field>

          <div>
            <SubmitButton variant="primary">Save template</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
