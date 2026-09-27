"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createInvoiceFromDeal, createSubscriptionFromDeal } from "@/lib/actions/invoices";
import type { Deal, Offering } from "@/lib/types";

/**
 * What a win should produce: a subscription for recurring offerings, a draft
 * invoice for once-off ones. Dan confirms — nothing is created behind his back.
 */
export function WonDialog({
  deal,
  offering,
  onClose,
}: {
  deal: Deal | null;
  offering: Offering | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  if (!deal) return null;

  const recurring =
    offering?.pricing_model === "monthly" || offering?.pricing_model === "per_unit_monthly";
  const needsClient = !deal.client_id;

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast(result.message ?? "Done.");
        onClose();
      } else {
        toast(result.error ?? "Something went wrong.", "error");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent title={`${deal.title} is won`} description="Turn it into money now.">
        <div className="flex flex-col gap-3">
          {needsClient ? (
            <p className="rounded-[10px] bg-alert-wash px-3.5 py-2.5 text-[13px] text-alert">
              This deal is not linked to a client yet. Edit the deal and pick one first.
            </p>
          ) : recurring ? (
            <>
              <p className="text-sm text-muted">
                {offering?.name} bills monthly. Create the subscription so it starts counting toward MRR.
              </p>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => run(() => createSubscriptionFromDeal(deal.id))}
              >
                {pending ? "Creating…" : "Create the subscription"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                {offering?.name ?? "This deal"} is once-off. Draft the invoice so you can send it today.
              </p>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => run(() => createInvoiceFromDeal(deal.id))}
              >
                {pending ? "Drafting…" : "Draft the invoice"}
              </Button>
            </>
          )}

          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
