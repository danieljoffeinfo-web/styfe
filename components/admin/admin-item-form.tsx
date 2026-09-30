"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/ui/toast";
import { saveAdminItem } from "@/lib/actions/admin";
import type { AdminItem, AdminTrack, Client } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

/** The quick add on the board covers the title; everything else lives here. */
export function AdminItemForm({
  item,
  track,
  clients,
  trigger,
}: {
  item?: AdminItem;
  track?: AdminTrack;
  clients: Client[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveAdminItem, null);
  const currentTrack = item?.track ?? track ?? "client";
  const [selectedTrack, setSelectedTrack] = React.useState<AdminTrack>(currentTrack);

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
      <SheetContent title={item ? "Edit item" : "New item"}>
        <form action={formAction} className="flex flex-col gap-5">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}

          <Field label="Title">
            <Input name="title" required defaultValue={item?.title} placeholder="Phase 2 scope" />
          </Field>

          <Field label="Detail">
            <Textarea name="detail" defaultValue={item?.detail ?? ""} />
          </Field>

          <Field label="Track">
            <Select
              name="track"
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value as AdminTrack)}
            >
              <option value="client">Clients</option>
              <option value="business">Business</option>
            </Select>
          </Field>

          {/* Done is the tick on the list, not a dropdown in here. */}
          <input type="hidden" name="status" value={item?.status ?? "todo"} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Business items are Dan's own, so the client picker goes away. */}
            {selectedTrack === "client" ? (
              <Field label="Client">
                <Select name="client_id" defaultValue={item?.client_id ?? ""}>
                  <option value="">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Due date">
              <DateInput name="due_date" defaultValue={item?.due_date ?? ""} />
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-paper px-5 py-4 sm:-mx-6 sm:px-6">
            <SubmitButton variant="primary">{item ? "Save" : "Add item"}</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
