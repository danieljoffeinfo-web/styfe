"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deletePathSegment, savePathSegment } from "@/lib/actions/settings";
import { OFFERING_COLORS } from "@/lib/offerings";
import type { Offering, PathSegment } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function SegmentEditor({
  segments,
  offerings,
}: {
  segments: PathSegment[];
  offerings: Offering[];
}) {
  const categories = [...new Set(offerings.map((o) => o.category))].sort();

  return (
    <div className="flex flex-col gap-4">
      {segments.map((segment) => (
        <SegmentRow key={segment.id} segment={segment} offerings={offerings} categories={categories} />
      ))}
      <div className="border-t border-line pt-4">
        <SegmentRow offerings={offerings} categories={categories} />
      </div>
    </div>
  );
}

function SegmentRow({
  segment,
  offerings,
  categories,
}: {
  segment?: PathSegment;
  offerings: Offering[];
  categories: string[];
}) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(savePathSegment, null);
  const [source, setSource] = React.useState(segment?.source ?? "subscriptions");
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      if (!segment) formRef.current?.reset();
    } else {
      toast(state.error, "error");
    }
  }, [state, toast, segment]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      {segment ? <input type="hidden" name="id" value={segment.id} /> : null}

      <Field label="Label" className="min-w-[160px] flex-1">
        <Input name="label" required defaultValue={segment?.label} placeholder="2 new retainers" className="h-10" />
      </Field>

      <Field label="Target / month" className="w-[130px]">
        <Input
          name="target_zar"
          inputMode="decimal"
          defaultValue={segment ? String(Number(segment.target_zar)) : ""}
          className="h-10"
        />
      </Field>

      <Field label="Actual from" className="w-[170px]">
        <Select
          name="source"
          value={source}
          onChange={(e) => setSource(e.target.value as PathSegment["source"])}
          className="h-10"
        >
          <option value="subscriptions">Live subscriptions</option>
          <option value="project_average">3-month project average</option>
          <option value="manual">Not tracked</option>
        </Select>
      </Field>

      {source === "subscriptions" ? (
        <>
          <Field label="Offering" className="w-[170px]">
            <Select name="offering_slug" defaultValue={segment?.offering_slug ?? ""} className="h-10">
              <option value="">Any in category</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" className="w-[140px]">
            <Select name="category" defaultValue={segment?.category ?? ""} className="h-10">
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Units" className="w-[80px]">
            <Input name="target_units" inputMode="numeric" defaultValue={segment?.target_units ?? ""} className="h-10" />
          </Field>
        </>
      ) : (
        <>
          <input type="hidden" name="offering_slug" value="" />
          <input type="hidden" name="category" value="" />
          <input type="hidden" name="target_units" value="" />
        </>
      )}

      <Field label="Colour" className="w-[120px]">
        <Select name="color" defaultValue={segment?.color ?? "#1D6B4F"} className="h-10">
          {OFFERING_COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton variant={segment ? "outline" : "primary"} className="h-10">
        {segment ? "Save" : "Add segment"}
      </SubmitButton>

      {segment ? (
        <Button
          variant="danger"
          className="h-10"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove "${segment.label}" from the path?`)) return;
            startTransition(async () => {
              const result = await deletePathSegment(segment.id);
              if (!result.ok) toast(result.error, "error");
              else toast(result.message ?? "Removed.");
            });
          }}
        >
          <Trash2 />
        </Button>
      ) : null}
    </form>
  );
}
