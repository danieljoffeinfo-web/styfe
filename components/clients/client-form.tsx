"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveClient } from "@/lib/actions/clients";
import type { Client } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/helpers";

export function ClientForm({ client, trigger }: { client?: Client; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveClient, null);

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
      <SheetContent title={client ? client.name : "New client"}>
        <form action={formAction} className="flex flex-col gap-5">
          {client ? <input type="hidden" name="id" value={client.id} /> : null}

          <Field label="Name">
            <Input name="name" required defaultValue={client?.name} placeholder="Cattle Baron" />
          </Field>

          <Field label="Contact name">
            <Input name="contact_name" defaultValue={client?.contact_name ?? ""} placeholder="Shaun" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone" hint="Used for WhatsApp reminders">
              <Input
                name="contact_phone"
                type="tel"
                defaultValue={client?.contact_phone ?? ""}
                placeholder="082 123 4567"
              />
            </Field>
            <Field label="Email">
              <Input name="contact_email" type="email" defaultValue={client?.contact_email ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Relationship">
              <Select name="relationship" defaultValue={client?.relationship ?? "project"}>
                <option value="project">Project</option>
                <option value="retainer">Retainer</option>
                <option value="employer">Employer</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={client?.status ?? "active"}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea name="notes" defaultValue={client?.notes ?? ""} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton variant="primary">{client ? "Save client" : "Add client"}</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
