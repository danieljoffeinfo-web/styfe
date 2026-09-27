"use client";

import * as React from "react";
import { MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatZar } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { InvoiceView } from "@/lib/types";
import type { ResolvedSettings } from "@/lib/queries/settings";

/** Digits only, with South Africa's country code when a local number is stored. */
function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

export function reminderText(invoice: InvoiceView, settings: ResolvedSettings): string {
  const name = invoice.contact_name ?? invoice.client_name;
  const amount = formatZar(invoice.total_zar);
  const due = invoice.due_at ? ` (due ${formatDate(invoice.due_at)})` : "";
  return [
    `Hi ${name},`,
    "",
    `Just a friendly reminder about invoice ${invoice.number} for ${amount}${due}.`,
    "",
    `Let me know if you need anything from my side.`,
    "",
    `Thanks,`,
    settings.businessName,
  ].join("\n");
}

export function ReminderButton({
  invoice,
  settings,
  size = "sm",
}: {
  invoice: InvoiceView;
  settings: ResolvedSettings;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = React.useState(false);
  const text = reminderText(invoice, settings);
  const wa = waNumber(invoice.contact_phone);
  const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : null;
  const mailHref = invoice.contact_email
    ? `mailto:${invoice.contact_email}?subject=${encodeURIComponent(
        `Invoice ${invoice.number} — ${formatZar(invoice.total_zar)}`,
      )}&body=${encodeURIComponent(text)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>Send reminder</Button>
      </DialogTrigger>
      <DialogContent
        title={`Remind ${invoice.client_name}`}
        description={`${invoice.number} · ${formatZar(invoice.total_zar)}`}
      >
        <div className="flex flex-col gap-4">
          <pre className="whitespace-pre-wrap rounded-[10px] border border-line bg-card p-3.5 text-[13px] leading-relaxed">
            {text}
          </pre>

          <div className="flex flex-col gap-2">
            {waHref ? (
              <Button asChild variant="primary">
                <a href={waHref} target="_blank" rel="noreferrer">
                  <MessageCircle /> Open WhatsApp
                </a>
              </Button>
            ) : (
              <p className="rounded-[10px] bg-alert-wash px-3.5 py-2.5 text-[13px] text-alert">
                No phone number on {invoice.client_name}. Add one on the client page to use WhatsApp.
              </p>
            )}

            {mailHref ? (
              <Button asChild>
                <a href={mailHref}>
                  <Mail /> Draft an email
                </a>
              </Button>
            ) : (
              <p className="rounded-[10px] bg-well px-3.5 py-2.5 text-[13px] text-muted">
                No email address on {invoice.client_name}.
              </p>
            )}

            <Button
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(text);
              }}
            >
              Copy the message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
