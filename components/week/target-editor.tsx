"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deleteWeeklyTarget, saveWeeklyTarget } from "@/lib/actions/misc";
import type { WeeklyTarget } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function TargetEditor({ targets }: { targets: WeeklyTarget[] }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveWeeklyTarget, null);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      formRef.current?.reset();
    } else {
      toast(state.error, "error");
    }
  }, [state, toast]);

  return (
    <div className="flex flex-col gap-3">
      {targets.map((target) => (
        <form key={target.metric} action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="metric" value={target.metric} />
          <Field label="Metric" className="min-w-[160px] flex-1">
            <Input name="label" defaultValue={target.label} className="h-10" />
          </Field>
          <Field label="Weekly target" className="w-[120px]">
            <Input name="target" inputMode="numeric" defaultValue={target.target} className="h-10" />
          </Field>
          <SubmitButton className="h-10">Save</SubmitButton>
          <Button
            variant="danger"
            className="h-10"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Remove "${target.label}"? Its history goes too.`)) return;
              startTransition(async () => {
                const result = await deleteWeeklyTarget(target.metric);
                if (!result.ok) toast(result.error, "error");
                else toast(result.message ?? "Removed.");
              });
            }}
          >
            <Trash2 />
          </Button>
        </form>
      ))}

      <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <Field label="New metric" className="min-w-[160px] flex-1">
          <Input name="label" placeholder="Cold calls" required className="h-10" />
        </Field>
        <Field label="Weekly target" className="w-[120px]">
          <Input name="target" inputMode="numeric" defaultValue={5} className="h-10" />
        </Field>
        <SubmitButton variant="primary" className="h-10">
          Add metric
        </SubmitButton>
      </form>
    </div>
  );
}
