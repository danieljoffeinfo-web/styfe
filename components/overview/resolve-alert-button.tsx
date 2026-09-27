"use client";

import * as React from "react";
import { X } from "lucide-react";
import { resolveAlert } from "@/lib/actions/misc";
import { useToast } from "@/components/ui/toast";

export function ResolveAlertButton({ id }: { id: string }) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      aria-label="Clear alert"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resolveAlert(id);
          if (!result.ok) toast(result.error, "error");
        })
      }
      className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-alert/10"
    >
      <X className="size-4" />
    </button>
  );
}
