"use client";

import * as React from "react";
import { Copy, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteOffering, duplicateOffering, setOfferingStatus } from "@/lib/actions/offerings";
import type { Offering } from "@/lib/types";

export function OfferingActions({ offering, showDelete }: { offering: Offering; showDelete?: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast(result.message ?? "Done.");
      else toast(result.error ?? "Something went wrong.", "error");
    });
  }

  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      <Button size="sm" disabled={pending} onClick={() => run(() => duplicateOffering(offering.id))}>
        <Copy /> Duplicate
      </Button>
      {offering.status === "active" ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => setOfferingStatus(offering.id, "archived"))}>
          <Archive /> Archive
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => run(() => setOfferingStatus(offering.id, "active"))}>
          <ArchiveRestore /> Restore
        </Button>
      )}
      {showDelete ? (
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete ${offering.name}? This cannot be undone.`)) return;
            run(() => deleteOffering(offering.id));
          }}
        >
          <Trash2 /> Delete
        </Button>
      ) : null}
    </div>
  );
}
