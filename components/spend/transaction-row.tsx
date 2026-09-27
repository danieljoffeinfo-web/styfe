"use client";

import * as React from "react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { MoneyCents } from "@/components/money";
import { recategoriseTransaction, saveCategoryRule } from "@/lib/actions/transactions";
import { merchantName } from "@/lib/queries/money.client";
import { toCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Category, Transaction } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";
import { useActionState } from "react";

export function TransactionRow({
  transaction,
  categories,
}: {
  transaction: Transaction;
  categories: Category[];
}) {
  const toast = useToast();
  const [category, setCategory] = React.useState(transaction.category);
  const [ruleFor, setRuleFor] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function change(next: string) {
    const previous = category;
    setCategory(next);
    startTransition(async () => {
      const result = await recategoriseTransaction(transaction.id, next);
      if (!result.ok) {
        setCategory(previous);
        toast(result.error, "error");
        return;
      }
      // Offer to make it stick for everything that looks like this.
      setRuleFor(next);
    });
  }

  return (
    <>
      <tr className="border-t border-line-soft">
        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDate(transaction.date)}</td>
        <td className="max-w-[280px] truncate px-3 py-2 text-[13px]">{transaction.description || "—"}</td>
        <td className="money whitespace-nowrap px-3 py-2 text-right text-[13px]">
          <MoneyCents cents={toCents(transaction.amount_zar)} withCents />
        </td>
        <td className="px-3 py-2">
          <Select
            aria-label={`Category for ${transaction.description || "transaction"}`}
            value={category}
            onChange={(e) => change(e.target.value)}
            disabled={pending}
            className="h-9 text-xs"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </Select>
        </td>
      </tr>

      {ruleFor ? (
        <RuleDialog
          description={transaction.description}
          category={ruleFor}
          categories={categories}
          onClose={() => setRuleFor(null)}
        />
      ) : null}
    </>
  );
}

function RuleDialog({
  description,
  category,
  categories,
  onClose,
}: {
  description: string;
  category: string;
  categories: Category[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveCategoryRule, null);
  const suggestion = merchantName(description);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Rule saved.");
      onClose();
    } else {
      toast(state.error, "error");
    }
  }, [state, toast, onClose]);

  if (!suggestion) {
    onClose();
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        title="Make it a rule?"
        description={`Everything matching this pattern will go to ${
          categories.find((c) => c.slug === category)?.label ?? category
        }.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="priority" value="50" />

          <Field label="Pattern" hint="A case-insensitive regular expression">
            <Input name="pattern" defaultValue={suggestion} />
          </Field>

          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="apply_to_existing" className="size-4" defaultChecked />
            Apply it to transactions already imported
          </label>

          <div className="flex gap-2">
            <SubmitButton variant="primary">Save the rule</SubmitButton>
            <Button variant="ghost" onClick={onClose}>
              Just this one
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
