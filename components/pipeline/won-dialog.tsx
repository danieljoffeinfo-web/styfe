"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createInvoiceFromDeal, createSubscriptionFromDeal } from "@/lib/actions/invoices";
import { dealTotals } from "@/lib/offerings";
import { formatZar } from "@/lib/money";
import type { Deal, DealAddon, Offering } from "@/lib/types";

/**
 * What a win should produce. A deal can now carry both sides at once — a Launch
 * Website with a Care Plan is a once-off invoice *and* a monthly subscription —
 * so the dialog offers whichever sides the deal actually has rather than
 * guessing from the base offering's pricing model. Dan confirms each one;
 * nothing is created behind his back.
 */
export function WonDialog({
  deal,
  offering,
  offerings = [],
  addons = [],
  onClose,
}: {
  deal: Deal | null;
  offering: Offering | null;
  offerings?: Offering[];
  addons?: DealAddon[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState<{ invoice?: boolean; subscription?: boolean }>({});

  const offeringById = React.useMemo(
    () => new Map(offerings.map((o) => [o.id, o])),
    [offerings],
  );
  const dealAddons = React.useMemo(
    () => addons.filter((a) => a.deal_id === deal?.id),
    [addons, deal?.id],
  );

  if (!deal) return null;

  const totals = dealTotals(deal, dealAddons, offeringById);
  const needsClient = !deal.client_id;
  // Fall back to the base offering's list price so a deal saved without an
  // explicit value still offers the right action.
  const hasOnceOff =
    totals.onceOffCents > 0 || Number(offering?.setup_fee_zar ?? 0) > 0;
  const hasMonthly =
    totals.monthlyCents > 0 || Number(offering?.monthly_fee_zar ?? 0) > 0;

  function run(
    key: "invoice" | "subscription",
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast(result.error ?? "Something went wrong.", "error");
        return;
      }
      toast(result.message ?? "Done.");
      const next = { ...done, [key]: true };
      setDone(next);
      // Only close once there is nothing left to create.
      const invoiceLeft = hasOnceOff && !next.invoice;
      const subscriptionLeft = hasMonthly && !next.subscription;
      if (!invoiceLeft && !subscriptionLeft) onClose();
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
          ) : !hasOnceOff && !hasMonthly ? (
            <p className="rounded-[10px] bg-alert-wash px-3.5 py-2.5 text-[13px] text-alert">
              This deal has no value on it. Edit it and set a once-off or monthly amount.
            </p>
          ) : (
            <>
              {hasOnceOff ? (
                <>
                  <p className="text-sm text-muted">
                    <span className="money">{formatZar(totals.onceOffCents / 100)}</span> once-off
                    {dealAddons.length ? " across the base and its add-ons" : ""}. Draft the invoice
                    so you can send it today.
                  </p>
                  <Button
                    variant="primary"
                    disabled={pending || done.invoice}
                    onClick={() => run("invoice", () => createInvoiceFromDeal(deal.id))}
                  >
                    {done.invoice ? "Invoice drafted" : pending ? "Working…" : "Draft the invoice"}
                  </Button>
                </>
              ) : null}

              {hasMonthly ? (
                <>
                  <p className="text-sm text-muted">
                    <span className="money">{formatZar(totals.monthlyCents / 100)}</span> a month.
                    Create the subscription{dealAddons.length ? "s" : ""} so it starts counting
                    toward MRR.
                  </p>
                  <Button
                    variant={hasOnceOff ? "ghost" : "primary"}
                    disabled={pending || done.subscription}
                    onClick={() => run("subscription", () => createSubscriptionFromDeal(deal.id))}
                  >
                    {done.subscription
                      ? "Subscription created"
                      : pending
                        ? "Working…"
                        : "Create the subscription"}
                  </Button>
                </>
              ) : null}
            </>
          )}

          <Button variant="ghost" onClick={onClose}>
            {done.invoice || done.subscription ? "Done" : "Not now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
