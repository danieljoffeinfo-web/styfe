"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteClient } from "@/lib/actions/clients";

/**
 * Deleting a client is not undoable, so it asks first and says what goes with
 * it. The action refuses outright while invoices or subscriptions still point
 * at the client — this dialog is the confirmation, not the safety net.
 *
 * `variant="icon"` is the one that sits on a client card. The card is a link,
 * so the button stops the click from reaching it and carries its own stacking
 * context; anything less and deleting would also navigate.
 */
export function DeleteClientButton({
  id,
  name,
  variant = "button",
}: {
  id: string;
  name: string;
  variant?: "button" | "icon";
}) {
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
      // From a card the list just needs to drop a row; from the detail page
      // there is no page left to stay on.
      if (variant === "icon") router.refresh();
      else router.push("/clients");
    });
  }

  function openDialog(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openDialog}
          aria-label={`Delete ${name}`}
          title={`Delete ${name}`}
          className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-dark opacity-0 transition-opacity hover:bg-well hover:text-alert focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <Button variant="ghost" className="text-muted hover:text-alert" onClick={openDialog}>
          Delete
        </Button>
      )}

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
