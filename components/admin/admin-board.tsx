"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { AdminItemForm } from "./admin-item-form";
import { TodayChecklist } from "@/components/overview/today-checklist";
import { deleteAdminItem, saveAdminItem, setAdminItemStatus } from "@/lib/actions/admin";
import { clientColor } from "@/lib/clients";
import { formatDate, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  ADMIN_TRACK_LABEL,
  type AdminItem,
  type AdminTrack,
  type Client,
  type DailyTask,
} from "@/lib/types";

const TRACKS: AdminTrack[] = ["client", "business"];

const TRACK_BLURB: Record<AdminTrack, string> = {
  client: "Work, requests and admin that belongs to a client.",
  business: "Your own projects — the things you intend to sell.",
};

/**
 * The two tracks are told apart by colour, not just by which chip is dark:
 * client work is blue, your own projects are green, and the accent carries
 * through the tab, the rail on each item and the reminders underneath.
 */
const TRACK_ACCENT: Record<AdminTrack, string> = {
  client: "#2F5D8A",
  business: "#1D6B4F",
};

/**
 * Both tracks live in one client component so switching between them is a state
 * change rather than a round trip. Reminders are filtered by the same track, so
 * client reminders never appear while you are looking at your own projects.
 */
export function AdminBoard({
  items,
  clients,
  tasks,
  date,
}: {
  items: AdminItem[];
  clients: Client[];
  tasks: DailyTask[];
  date: string;
}) {
  const [track, setTrack] = React.useState<AdminTrack>("client");

  const counts = React.useMemo(() => {
    const out: Record<AdminTrack, number> = { client: 0, business: 0 };
    for (const item of items) if (item.status !== "done") out[item.track] += 1;
    return out;
  }, [items]);

  const accent = TRACK_ACCENT[track];

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
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-[9px] px-5 text-sm font-medium transition-colors sm:flex-none",
              track === value ? "text-white" : "text-muted hover:bg-well",
            )}
            style={track === value ? { background: TRACK_ACCENT[value] } : undefined}
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
        key={track}
        track={track}
        accent={accent}
        items={items.filter((i) => i.track === track)}
        clients={clients}
        tasks={tasks.filter((t) => t.track === track)}
        date={date}
      />
    </div>
  );
}

function TrackPanel({
  track,
  accent,
  items,
  clients,
  tasks,
  date,
}: {
  track: AdminTrack;
  accent: string;
  items: AdminItem[];
  clients: Client[];
  tasks: DailyTask[];
  date: string;
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

  function toggleDone(item: AdminItem) {
    startTransition(async () => {
      const result = await setAdminItemStatus(item.id, item.status === "done" ? "todo" : "done");
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

  // Unfinished first; done drops to the bottom rather than into its own column.
  const ordered = [...items].sort(
    (a, b) => Number(a.status === "done") - Number(b.status === "done") || a.sort - b.sort,
  );

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

      <div className="flex flex-col gap-2">
        {ordered.length === 0 ? (
          <p className="rounded-[14px] bg-well px-4 py-6 text-center text-[13px] text-muted">
            Nothing here yet.
          </p>
        ) : (
          ordered.map((item) => {
            const client = item.client_id ? clientById.get(item.client_id) : undefined;
            const done = item.status === "done";
            const overdue = item.due_date != null && !done && item.due_date < todayIso();
            return (
              <article
                key={item.id}
                className="group relative flex items-start gap-3 overflow-hidden rounded-[12px] border border-line bg-card p-3.5 pl-5"
              >
                {/* The client's own colour when there is one, else the track's. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ background: client ? clientColor(client) : accent }}
                />

                <button
                  type="button"
                  onClick={() => toggleDone(item)}
                  aria-pressed={done}
                  aria-label={done ? `Reopen ${item.title}` : `Mark ${item.title} done`}
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[13px] text-white",
                    done ? "border-transparent" : "border-muted-dark bg-white",
                  )}
                  style={done ? { background: accent, borderColor: accent } : undefined}
                >
                  {done ? "✓" : ""}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", done && "text-muted line-through")}>
                    {item.title}
                  </p>
                  {item.detail ? (
                    <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted">
                      {item.detail}
                    </p>
                  ) : null}
                  {client || item.due_date ? (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                      {client ? <span className="text-muted">{client.name}</span> : null}
                      {item.due_date ? (
                        <span className={cn("money", overdue ? "text-alert" : "text-muted")}>
                          {formatDate(item.due_date)}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <AdminItemForm
                    item={item}
                    clients={clients}
                    trigger={
                      <button
                        type="button"
                        className="flex min-h-9 items-center rounded-lg px-2.5 text-xs text-muted hover:bg-well hover:text-ink"
                      >
                        Edit
                      </button>
                    }
                  />
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.title}`}
                    className="flex size-8 items-center justify-center rounded-md text-muted-dark opacity-0 transition-opacity hover:bg-well hover:text-alert focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Reminders belong to this track too — the other side never sees them. */}
      <section
        id="today"
        className="rounded-[14px] border border-line bg-card p-5"
        style={{ borderLeftWidth: 6, borderLeftColor: accent }}
      >
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">
            {track === "client" ? "Client reminders" : "Business reminders"}
          </h2>
          <span className="text-xs text-muted">{formatDate(date, "long")}</span>
        </div>
        <TodayChecklist tasks={tasks} date={date} track={track} />
      </section>
    </div>
  );
}
