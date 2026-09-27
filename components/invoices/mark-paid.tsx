"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setInvoiceStatus } from "@/lib/actions/invoices";
import { formatZar } from "@/lib/money";
import { formatDate, todayIso } from "@/lib/dates";
import type { InvoiceView, Transaction } from "@/lib/types";

export function MarkPaidButton({
  invoice,
  candidates,
}: {
  invoice: InvoiceView;
  /** Unlinked income transactions near the invoice total, newest first. */
  candidates: Transaction[];
}) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(todayIso());
  const [txId, setTxId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const toast = useToast();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">Mark paid</Button>
      </DialogTrigger>
      <DialogContent
        title={`Mark ${invoice.number} paid`}
        description={`${invoice.client_name} · ${formatZar(invoice.total_zar)}`}
      >
        <div className="flex flex-col gap-4">
          <Field label="Paid on">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <Field
            label="Match a transaction"
            hint={
              candidates.length
                ? "Optional — links the payment so the client page ties up."
                : "No unlinked income near this amount. Import a statement first."
            }
          >
            <Select value={txId} onChange={(e) => setTxId(e.target.value)} disabled={!candidates.length}>
              <option value="">Don&apos;t match anything</option>
              {candidates.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {formatDate(tx.date)} · {formatZar(tx.amount_zar)} · {tx.description || "No description"}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setInvoiceStatus(invoice.id, "paid", date, txId || null);
                if (result.ok) {
                  toast(result.message ?? "Marked paid.");
                  setOpen(false);
                } else {
                  toast(result.error, "error");
                }
              })
            }
          >
            {pending ? "Saving…" : "Mark paid"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceStatusButtons({ invoice }: { invoice: InvoiceView }) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function set(status: "draft" | "sent" | "void") {
    startTransition(async () => {
      const result = await setInvoiceStatus(invoice.id, status);
      if (result.ok) toast(result.message ?? "Updated.");
      else toast(result.error, "error");
    });
  }

  return (
    <>
      {invoice.status === "draft" ? (
        <Button disabled={pending} onClick={() => set("sent")}>
          Mark sent
        </Button>
      ) : null}
      {invoice.status !== "void" && invoice.status !== "paid" ? (
        <Button
          disabled={pending}
          onClick={() => {
            if (confirm(`Void ${invoice.number}? It stops counting as receivable.`)) set("void");
          }}
        >
          Void
        </Button>
      ) : null}
      {invoice.status === "paid" ? (
        <Button disabled={pending} onClick={() => set("sent")}>
          Undo paid
        </Button>
      ) : null}
    </>
  );
}
