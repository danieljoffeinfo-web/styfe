"use client";

import * as React from "react";
import { deleteGoalEntry } from "@/lib/actions/misc";
import { useToast } from "@/components/ui/toast";

export function RemoveEntryButton({ id }: { id: string }) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteGoalEntry(id);
          if (!result.ok) toast(result.error, "error");
        })
      }
      className="text-xs text-muted underline underline-offset-4 hover:text-alert"
    >
      Remove
    </button>
  );
}
