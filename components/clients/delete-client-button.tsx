"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteClient } from "@/lib/actions/clients";

/**
 * Deleting a client is not undoable, so it asks first and says what will go
 * with it. The action refuses outright if invoices or subscriptions still point
 * at the client — this is the confirmation, not the safety net.
 */
export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const toast = useToast();
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      const result = await deleteClient(id);
      if (!result.ok) {
        toast(result.error, "error");
        setOpen(false);
        return;
      }
      toast(result.message ?? "Client deleted.");
      setOpen(false);
      router.push("/clients");
    });
  }

  return (
    <>
      <Button variant="ghost" className="text-muted hover:text-alert" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`Delete ${name}?`}
          description="This cannot be undone. Revenue entries and admin items keep their history but lose the link to this client."
        >
          <div className="flex flex-col gap-3">
            <p className="rounded-[10px] bg-alert-wash px-3.5 py-2.5 text-[13px] text-alert">
              If you only want them off the active list, set the status to ended instead.
            </p>
            <Button variant="primary" disabled={pending} onClick={confirm}>
              {pending ? "Deleting…" : "Delete this client"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
