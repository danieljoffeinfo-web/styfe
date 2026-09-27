"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deleteCategoryRule, saveCategory, saveCategoryRule } from "@/lib/actions/transactions";
import { CATEGORY_GROUP_LABEL, type Category, type CategoryRule } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function CategoryEditor({ categories }: { categories: Category[] }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveCategory, null);
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="pb-2 font-normal">Slug</th>
              <th className="pb-2 font-normal">Label</th>
              <th className="pb-2 font-normal">Group</th>
              <th className="pb-2 font-normal">Recurring income</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.slug} className="border-b border-line-soft last:border-b-0">
                <td className="py-1.5">
                  <code className="text-xs text-muted">{category.slug}</code>
                </td>
                <td colSpan={4} className="py-1.5">
                  <form action={formAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="is_edit" value="true" />
                    <input type="hidden" name="slug" value={category.slug} />
                    <Input
                      name="label"
                      defaultValue={category.label}
                      aria-label={`Label for ${category.slug}`}
                      className="h-9 w-[160px]"
                    />
                    <Select
                      name="group"
                      defaultValue={category.group}
                      aria-label={`Group for ${category.slug}`}
                      className="h-9 w-[130px]"
                    >
                      {(["income", "business", "personal", "internal"] as const).map((g) => (
                        <option key={g} value={g}>
                          {CATEGORY_GROUP_LABEL[g]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="color"
                      defaultValue={category.color ?? ""}
                      aria-label={`Colour for ${category.slug}`}
                      className="h-9 w-[100px]"
                      placeholder="#1D6B4F"
                    />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        name="recurring"
                        defaultChecked={category.recurring}
                        className="size-4"
                      />
                      Recurring
                    </label>
                    <SubmitButton size="sm">Save</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <Field label="New slug" hint="lowercase_with_underscores" className="w-[170px]">
          <Input name="slug" required pattern="[a-z0-9_]+" placeholder="school_fees" className="h-10" />
        </Field>
        <Field label="Label" className="w-[170px]">
          <Input name="label" required placeholder="School fees" className="h-10" />
        </Field>
        <Field label="Group" className="w-[140px]">
          <Select name="group" defaultValue="personal" className="h-10">
            {(["income", "business", "personal", "internal"] as const).map((g) => (
              <option key={g} value={g}>
                {CATEGORY_GROUP_LABEL[g]}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="primary" className="h-10">
          Add category
        </SubmitButton>
      </form>
    </div>
  );
}

export function RuleEditor({ rules, categories }: { rules: CategoryRule[]; categories: Category[] }) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveCategoryRule, null);
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
      <p className="text-[13px] text-muted">
        Rules run in priority order and the first match wins. Anything unmatched falls back to{" "}
        <code className="text-xs">income_other</code> for money in and <code className="text-xs">other</code> for money out.
      </p>

      {rules.map((rule) => (
        <form key={rule.id} action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={rule.id} />
          <Field label="Priority" className="w-[90px]">
            <Input name="priority" inputMode="numeric" defaultValue={rule.priority} className="h-10" />
          </Field>
          <Field label="Pattern" className="min-w-[220px] flex-1">
            <Input name="pattern" defaultValue={rule.pattern} className="money h-10 text-xs" />
          </Field>
          <Field label="Category" className="w-[170px]">
            <Select name="category" defaultValue={rule.category} className="h-10">
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex h-10 items-center gap-1.5 text-xs">
            <input type="checkbox" name="apply_to_existing" className="size-4" />
            Backfill
          </label>
          <SubmitButton className="h-10">Save</SubmitButton>
          <Button
            variant="danger"
            className="h-10"
            disabled={pending}
            onClick={() => {
              if (!confirm("Remove this rule?")) return;
              startTransition(async () => {
                const result = await deleteCategoryRule(rule.id);
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
        <Field label="Priority" className="w-[90px]">
          <Input name="priority" inputMode="numeric" defaultValue={100} className="h-10" />
        </Field>
        <Field label="Pattern" className="min-w-[220px] flex-1">
          <Input name="pattern" required placeholder="Woolworths|Checkers" className="h-10" />
        </Field>
        <Field label="Category" className="w-[170px]">
          <Select name="category" defaultValue={categories[0]?.slug} className="h-10">
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex h-10 items-center gap-1.5 text-xs">
          <input type="checkbox" name="apply_to_existing" className="size-4" defaultChecked />
          Backfill
        </label>
        <SubmitButton variant="primary" className="h-10">
          Add rule
        </SubmitButton>
      </form>
    </div>
  );
}
