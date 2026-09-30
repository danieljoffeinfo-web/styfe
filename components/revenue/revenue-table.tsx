"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyCents } from "@/components/money";
import { RevenueForm } from "./revenue-form";
import { useToast } from "@/components/ui/toast";
import { deleteRevenueEntry } from "@/lib/actions/revenue";
import { formatDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import type { Client, Offering, RevenueEntry } from "@/lib/types";

/**
 * Rows on a pointer, cards at 390px — the table would need a horizontal
 * scroll otherwise, which CLAUDE.md rules out.
 */
export function RevenueTable({
  entries,
  clients,
  offerings,
}: {
  entries: RevenueEntry[];
  clients: Client[];
  offerings: Offering[];
}) {
  const toast = useToast();
  const [, startTransition] = React.useTransition();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteRevenueEntry(id);
      if (!result.ok) toast(result.error, "error");
      else toast(result.message ?? "Removed.");
    });
  }

  if (entries.length === 0) {
    return (
      <p className="py-2 text-[13px] text-muted">
        Nothing yet. Add what you have actually been paid — it drives the chart and the Overview.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{entry.description}</span>
              <Badge tone={entry.recurring ? "green" : "sand"}>
                {entry.recurring ? "Recurring" : "Once-off"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {[formatDate(entry.date), entry.client_id ? clientName.get(entry.client_id) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:shrink-0">
            <span className="money text-sm font-medium">
              <MoneyCents cents={toCents(entry.amount_zar)} />
            </span>
            <RevenueForm
              entry={entry}
              clients={clients}
              offerings={offerings}
              trigger={
                <Button variant="ghost" className="h-9 px-2.5 text-[13px]">
                  Edit
                </Button>
              }
            />
            <Button
              variant="ghost"
              className="h-9 px-2.5 text-[13px] text-muted hover:text-alert"
              onClick={() => remove(entry.id)}
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
