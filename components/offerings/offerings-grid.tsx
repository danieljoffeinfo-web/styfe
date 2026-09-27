"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { OfferingCard } from "./offering-card";
import { OfferingForm } from "./offering-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reorderOfferings } from "@/lib/actions/offerings";
import type { CatalogueEntry } from "@/lib/queries/offerings";

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

  const grouped = new Map<string, CatalogueEntry[]>();
  for (const entry of order) {
    const list = grouped.get(entry.offering.category) ?? [];
    list.push(entry);
    grouped.set(entry.offering.category, list);
  }

  if (order.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-control p-8 text-center">
        <p className="font-medium">No offerings yet.</p>
        <p className="mt-1 text-[13px] text-muted">
          Start with the thing you sell most — a website build, a retainer, a SaaS seat.
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
    <div className="flex flex-col gap-7">
      {[...grouped.entries()].map(([category, items]) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="eyebrow">{category}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((entry) => (
              <div
                key={entry.offering.id}
                draggable
                onDragStart={() => setDragging(entry.offering.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(entry.offering.id)}
                className={dragging === entry.offering.id ? "opacity-50" : undefined}
              >
                <div className="relative h-full">
                  <OfferingCard entry={entry} />
                  <div className="absolute right-3 top-12 flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(entry.offering.id, -1)}
                      aria-label={`Move ${entry.offering.name} earlier`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-dark hover:bg-well hover:text-ink"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(entry.offering.id, 1)}
                      aria-label={`Move ${entry.offering.name} later`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-dark hover:bg-well hover:text-ink"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <span
                      aria-hidden
                      className="hidden size-7 cursor-grab items-center justify-center text-muted-dark lg:flex"
                    >
                      <GripVertical className="size-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
