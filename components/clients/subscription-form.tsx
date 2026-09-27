"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { endSubscription, saveSubscription } from "@/lib/actions/clients";
import { todayIso } from "@/lib/dates";
import type { Client, Offering, OfferingTier, Subscription } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function SubscriptionForm({
  client,
  subscription,
  offerings,
  tiers,
  trigger,
}: {
  client: Client;
  subscription?: Subscription;
  offerings: Offering[];
  tiers: OfferingTier[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveSubscription, null);
  const [offeringId, setOfferingId] = React.useState(subscription?.offering_id ?? offerings[0]?.id ?? "");
  const [fee, setFee] = React.useState(
    subscription ? String(Number(subscription.monthly_fee_zar)) : "",
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  const offering = offerings.find((o) => o.id === offeringId);
  const offeringTiers = tiers.filter((t) => t.offering_id === offeringId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent title={subscription ? "Edit subscription" : "New subscription"} description={client.name}>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="client_id" value={client.id} />
          {subscription ? <input type="hidden" name="id" value={subscription.id} /> : null}

          <Field label="Offering">
            <Select
              name="offering_id"
              required
              value={offeringId}
              onChange={(e) => {
                setOfferingId(e.target.value);
                const picked = offerings.find((o) => o.id === e.target.value);
                setFee(picked?.monthly_fee_zar != null ? String(Number(picked.monthly_fee_zar)) : "");
              }}
            >
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>

          {offeringTiers.length ? (
            <Field label="Tier">
              <Select name="tier_id" defaultValue={subscription?.tier_id ?? ""}>
                <option value="">No tier</option>
                {offeringTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="tier_id" value="" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={offering?.unit_label ? `${offering.unit_label}s` : "Units"}>
              <Input name="units" inputMode="numeric" defaultValue={subscription?.units ?? 1} />
            </Field>
            <Field label="Monthly fee (ex VAT)" hint="Per unit">
              <Input
                name="monthly_fee_zar"
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Started">
              <Input type="date" name="started_at" defaultValue={subscription?.started_at ?? todayIso()} />
            </Field>
            <Field label="Ended">
              <Input type="date" name="ended_at" defaultValue={subscription?.ended_at ?? ""} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={subscription?.status ?? "active"}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea name="notes" defaultValue={subscription?.notes ?? ""} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton variant="primary">Save</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function EndSubscriptionButton({ id, label }: { id: string; label: string }) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`End the ${label} subscription? It stops counting toward MRR.`)) return;
        startTransition(async () => {
          const result = await endSubscription(id);
          if (result.ok) toast(result.message ?? "Ended.");
          else toast(result.error, "error");
        });
      }}
    >
      End
    </Button>
  );
}
