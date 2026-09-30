"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { AdminItemForm } from "./admin-item-form";
import { deleteAdminItem, saveAdminItem, setAdminItemStatus } from "@/lib/actions/admin";
import { clientColor } from "@/lib/clients";
import { formatDate, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  ADMIN_STATUSES,
  ADMIN_STATUS_LABEL,
  ADMIN_TRACK_LABEL,
  type AdminItem,
  type AdminStatus,
  type AdminTrack,
  type Client,
} from "@/lib/types";

const TRACKS: AdminTrack[] = ["client", "business"];

const TRACK_BLURB: Record<AdminTrack, string> = {
  client: "Work, requests and admin that belongs to a client.",
  business: "Your own projects — the things you intend to sell.",
};

/**
 * Both tracks live in one client component so switching between them is a state
 * change rather than a round trip. The rows are already loaded either way.
 */
export function AdminBoard({ items, clients }: { items: AdminItem[]; clients: Client[] }) {
  const [track, setTrack] = React.useState<AdminTrack>("client");

  const counts = React.useMemo(() => {
    const out: Record<AdminTrack, number> = { client: 0, business: 0 };
    for (const item of items) if (item.status !== "done") out[item.track] += 1;
    return out;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Admin track"
        className="flex w-full gap-1 rounded-[12px] border border-line bg-card p-1 sm:w-auto sm:self-start"
      >
        {TRACKS.map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={track === value}
            onClick={() => setTrack(value)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors sm:flex-none",
              track === value ? "bg-ink text-white" : "text-muted hover:bg-well",
            )}
          >
            {ADMIN_TRACK_LABEL[value]}
            <span className={cn("money text-xs", track === value ? "opacity-70" : "text-muted-dark")}>
              {counts[value]}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[13px] text-muted">{TRACK_BLURB[track]}</p>

      <TrackPanel
        track={track}
        items={items.filter((i) => i.track === track)}
        clients={clients}
      />
    </div>
  );
}

function TrackPanel({
  track,
  items,
  clients,
}: {
  track: AdminTrack;
  items: AdminItem[];
  clients: Client[];
}) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const clientById = React.useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  function onAdd(event: React.FormEvent) {
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    const formData = new FormData();
    formData.set("track", track);
    formData.set("title", text);
    formData.set("status", "todo");
    if (track === "client") formData.set("client_id", clientId);
    setTitle("");
    startTransition(async () => {
      const result = await saveAdminItem(null, formData);
      if (!result.ok) toast(result.error, "error");
    });
  }

  function move(id: string, status: AdminStatus) {
    startTransition(async () => {
      const result = await setAdminItemStatus(id, status);
      if (!result.ok) toast(result.error, "error");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAdminItem(id);
      if (!result.ok) toast(result.error, "error");
      else toast(result.message ?? "Removed.");
    });
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={track === "client" ? "Send Britos the phase 2 scope" : "Package the invoicing tool"}
          aria-label={`Add to ${ADMIN_TRACK_LABEL[track]}`}
        />
        {track === "client" ? (
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-label="Client"
            className="sm:w-56"
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Button type="submit" variant="primary" className="sm:shrink-0">
          <Plus /> Add
        </Button>
      </form>

      {/* Three columns on a wide screen, stacked at 390px. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {ADMIN_STATUSES.map((status) => {
          const column = items.filter((i) => i.status === status);
          return (
            <section
              key={status}
              aria-label={ADMIN_STATUS_LABEL[status]}
              className="flex flex-col gap-2 rounded-[14px] bg-well p-3"
            >
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-[13px] font-semibold">{ADMIN_STATUS_LABEL[status]}</h3>
                <span className="money text-xs text-muted">{column.length}</span>
              </div>

              {column.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">Nothing here.</p>
              ) : (
                column.map((item) => {
                  const client = item.client_id ? clientById.get(item.client_id) : undefined;
                  const overdue =
                    item.due_date != null && item.status !== "done" && item.due_date < todayIso();
                  return (
                    <article
                      key={item.id}
                      className="group relative flex flex-col gap-1.5 overflow-hidden rounded-[10px] border border-line bg-card p-3"
                    >
                      {client ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-1"
                          style={{ background: clientColor(client) }}
                        />
                      ) : null}
                      <div className={cn("flex items-start justify-between gap-2", client && "pl-2")}>
                        <p
                          className={cn(
                            "text-[13px] font-medium",
                            item.status === "done" && "text-muted line-through",
                          )}
                        >
                          {item.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.title}`}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-dark opacity-0 transition-opacity hover:bg-well hover:text-alert focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      {item.detail ? (
                        <p className={cn("whitespace-pre-line text-xs leading-relaxed text-muted", client && "pl-2")}>
                          {item.detail}
                        </p>
                      ) : null}

                      <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", client && "pl-2")}>
                        {client ? <span className="text-muted">{client.name}</span> : null}
                        {item.due_date ? (
                          <span className={cn("money", overdue ? "text-alert" : "text-muted")}>
                            {formatDate(item.due_date)}
                          </span>
                        ) : null}
                      </div>

                      <div className={cn("flex flex-wrap gap-1.5 pt-1", client && "pl-2")}>
                        {ADMIN_STATUSES.filter((s) => s !== status).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => move(item.id, s)}
                            className="flex min-h-9 items-center rounded-lg border border-line px-2.5 text-xs text-muted hover:bg-well hover:text-ink"
                          >
                            {ADMIN_STATUS_LABEL[s]}
                          </button>
                        ))}
                        <AdminItemForm
                          item={item}
                          clients={clients}
                          trigger={
                            <button
                              type="button"
                              className="flex min-h-9 items-center rounded-lg border border-line px-2.5 text-xs text-muted hover:bg-well hover:text-ink"
                            >
                              Edit
                            </button>
                          }
                        />
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
