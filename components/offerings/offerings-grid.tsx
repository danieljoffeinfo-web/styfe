"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { OfferingCard } from "./offering-card";
import { OfferingForm } from "./offering-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reorderOfferings } from "@/lib/actions/offerings";
import { groupByServiceLine } from "@/lib/offerings";
import { OFFERING_TYPE_ORDER, type OfferingType } from "@/lib/types";
import type { CatalogueEntry } from "@/lib/queries/offerings";

/** Sub-headings inside a service line, so packages and extras do not run together. */
const TYPE_HEADING: Record<OfferingType, string> = {
  standard: "Packages",
  custom: "Bespoke",
  addon: "Add-ons",
};

/**
 * Cards grouped by category. Reordering is drag-and-drop on a pointer and
 * up/down buttons everywhere else, and always writes the whole order at once.
 */
export function OfferingsGrid({
  entries,
  categories,
}: {
  entries: CatalogueEntry[];
  categories: string[];
}) {
  const toast = useToast();
  const [order, setOrder] = React.useState(entries);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => setOrder(entries), [entries]);

  function persist(next: CatalogueEntry[]) {
    setOrder(next);
    startTransition(async () => {
      const result = await reorderOfferings(next.map((e) => e.offering.id));
      if (!result.ok) toast(result.error, "error");
    });
  }

  function move(id: string, delta: number) {
    const index = order.findIndex((e) => e.offering.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }

  function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const from = order.findIndex((e) => e.offering.id === dragging);
    const to = order.findIndex((e) => e.offering.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  }

  // Grouped by service line, and inside each one standard -> custom -> add-ons.
  const grouped = groupByServiceLine(order);

  if (order.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-control p-8 text-center">
        <p className="font-medium">No offerings yet.</p>
        <p className="mt-1 text-[13px] text-muted">
          Start with the thing you sell most — a website build, a retainer, a
          SaaS seat.
        </p>
        <div className="mt-4 flex justify-center">
          <OfferingForm
            categories={categories}
            trigger={<Button variant="primary">New offering</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {[...grouped.entries()].map(([category, items]) => {
        const id = category
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        // Packages, bespoke and add-ons answer different questions, so each
        // gets its own labelled band rather than all sharing one grid.
        const byType = new Map<OfferingType, CatalogueEntry[]>();
        for (const entry of items) {
          const key = entry.offering.offering_type;
          byType.set(key, [...(byType.get(key) ?? []), entry]);
        }
        const bands = [...byType.entries()].sort(
          ([a], [b]) => OFFERING_TYPE_ORDER[a] - OFFERING_TYPE_ORDER[b],
        );

        return (
          <section
            key={category}
            id={`offering-${id}`}
            className="scroll-mt-24 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                {category}
              </h2>
              <span className="text-xs text-muted">{items.length}</span>
            </div>

            {bands.map(([type, bandItems]) => (
              <div key={type} className="flex flex-col gap-3">
                {/* Only worth labelling when the service line actually mixes types. */}
                {bands.length > 1 ? (
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-dark">
                    {TYPE_HEADING[type]}
                  </h3>
                ) : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {bandItems.map((entry) => (
                    <div
                      key={entry.offering.id}
                      draggable
                      onDragStart={() => setDragging(entry.offering.id)}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => drop(entry.offering.id)}
                      className={
                        dragging === entry.offering.id
                          ? "opacity-50"
                          : undefined
                      }
                    >
                      <div className="relative h-full">
                        <OfferingCard entry={entry} />
                        <div className="absolute right-3 top-12 flex flex-col gap-0.5 opacity-50 transition-opacity hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => move(entry.offering.id, -1)}
                            aria-label={`Move ${entry.offering.name} earlier`}
                            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-well hover:text-ink"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(entry.offering.id, 1)}
                            aria-label={`Move ${entry.offering.name} later`}
                            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-well hover:text-ink"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <span
                            aria-hidden
                            className="hidden size-7 cursor-grab items-center justify-center text-muted lg:flex"
                          >
                            <GripVertical className="size-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
