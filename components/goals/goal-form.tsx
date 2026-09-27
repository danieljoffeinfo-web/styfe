"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addGoalEntry, saveGoal } from "@/lib/actions/misc";
import { todayIso } from "@/lib/dates";
import type { Goal } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function GoalForm({ goal, trigger }: { goal?: Goal; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveGoal, null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent title={goal ? goal.name : "New goal"}>
        <form action={formAction} className="flex flex-col gap-5">
          {goal ? <input type="hidden" name="id" value={goal.id} /> : null}

          <Field label="Name">
            <Input name="name" required defaultValue={goal?.name} placeholder="MacBook Pro — cash" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" hint="MRR goals read live MRR">
              <Select name="kind" defaultValue={goal?.kind ?? "savings"} disabled={Boolean(goal)}>
                <option value="savings">Savings</option>
                <option value="mrr">Secured monthly income</option>
                <option value="spend_cap">Spend cap</option>
              </Select>
            </Field>
            <Field label="Target">
              <Input
                name="target_zar"
                inputMode="decimal"
                defaultValue={goal ? String(Number(goal.target_zar)) : ""}
                placeholder="50000"
              />
            </Field>
          </div>

          {goal ? <input type="hidden" name="kind" value={goal.kind} /> : null}

          <Field label="Deadline">
            <Input type="date" name="deadline" defaultValue={goal?.deadline ?? ""} />
          </Field>

          <Field label="Notes">
            <Textarea name="notes" defaultValue={goal?.notes ?? ""} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton variant="primary">Save goal</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function DepositForm({ goal }: { goal: Goal }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addGoalEntry, null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Recorded.");
      formRef.current?.reset();
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="goal_id" value={goal.id} />
      <Field label="Amount" className="w-[130px]">
        <Input name="amount_zar" inputMode="decimal" placeholder="2500" required className="h-10" />
      </Field>
      <Field label="Date" className="w-[150px]">
        <Input type="date" name="date" defaultValue={todayIso()} className="h-10" />
      </Field>
      <Field label="Note" className="min-w-[160px] flex-1">
        <Input name="note" placeholder="Proto payment" className="h-10" />
      </Field>
      <SubmitButton variant="primary" className="h-10">
        Add
      </SubmitButton>
    </form>
  );
}
