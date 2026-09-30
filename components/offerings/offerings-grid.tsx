"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyCents } from "@/components/money";
import { OfferingForm } from "./offering-form";
import { useToast } from "@/components/ui/toast";
import { reorderOfferings } from "@/lib/actions/offerings";
import { groupByServiceLine, priceLine } from "@/lib/offerings";
import { OFFERING_TYPE_LABEL, type OfferingType } from "@/lib/types";
import { toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CatalogueEntry } from "@/lib/queries/offerings";

const TYPE_TONE: Record<OfferingType, "outline" | "blue" | "sand"> = {
  standard: "outline",
  custom: "blue",
  addon: "sand",
};

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
  const grouped = React.useMemo(() => groupByServiceLine(order), [order]);
  const categoryNames = React.useMemo(() => [...grouped.keys()], [grouped]);
  const [openCategory, setOpenCategory] = React.useState<string | null>(categoryNames[0] ?? null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setOrder(entries);
  }, [entries]);

  React.useEffect(() => {
    if (!openCategory || !categoryNames.includes(openCategory)) {
      setOpenCategory(categoryNames[0] ?? null);
    }
  }, [categoryNames, openCategory]);

  function persist(next: CatalogueEntry[]) {
    setOrder(next);
    startTransition(async () => {
      const result = await reorderOfferings(next.map((entry) => entry.offering.id));
      if (!result.ok) toast(result.error, "error");
    });
  }

  function move(id: string, delta: number) {
    const index = order.findIndex((entry) => entry.offering.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }

  function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const from = order.findIndex((entry) => entry.offering.id === dragging);
    const to = order.findIndex((entry) => entry.offering.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  }

  function open(category: string) {
    setOpenCategory(category);
    requestAnimationFrame(() => {
      document.getElementById(categoryId(category))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  if (order.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-control p-8 text-center">
        <p className="font-medium">No offerings yet.</p>
        <p className="mt-1 text-[13px] text-muted">
          Start with the thing you sell most — a website build, a retainer, a SaaS seat.
        </p>
        <div className="mt-4 flex justify-center">
          <OfferingForm categories={categories} trigger={<Button variant="primary">New offering</Button>} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Offering categories" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => categoryNames[0] && open(categoryNames[0])}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-[12.5px] font-medium text-muted transition-colors hover:border-control hover:text-ink"
        >
          All
          <span className="text-muted-dark">{order.length}</span>
        </button>
        {categoryNames.map((category) => {
          const selected = openCategory === category;
          const tone = categoryTone(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => open(category)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium transition-colors",
                selected
                  ? tone.active
                  : "border-line bg-card text-muted hover:border-control hover:text-ink",
              )}
            >
              <span className={cn("size-2 rounded-full", tone.dot)} />
              {category}
              <span className={selected ? "opacity-70" : "text-muted-dark"}>
                {grouped.get(category)?.length ?? 0}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2">
        {[...grouped.entries()].map(([category, items]) => {
          const expanded = openCategory === category;
          return (
            <section
              key={category}
              id={categoryId(category)}
              className={cn(
                "scroll-mt-24 overflow-hidden rounded-xl border bg-card",
                categoryTone(category).border,
              )}
            >
              <button
                type="button"
                onClick={() => setOpenCategory(expanded ? null : category)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-well/60 sm:px-5"
                aria-expanded={expanded}
              >
                <span
                  aria-hidden
                  className={cn("size-2.5 shrink-0 rounded-full", categoryTone(category).dot)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{category}</h2>
                    <span className="rounded-full bg-track px-2 py-0.5 text-[11px] text-muted">
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-muted">{categoryDescription(category)}</p>
                </div>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")}
                />
              </button>

              {expanded ? (
                <div className="border-t border-line">
                  <div className="hidden grid-cols-[minmax(260px,1fr)_160px_90px_110px_110px_72px] gap-4 border-b border-line bg-well/45 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted lg:grid">
                    <div>Offering</div>
                    <div>Price</div>
                    <div>Live</div>
                    <div>MRR</div>
                    <div>Pipeline</div>
                    <div />
                  </div>

                  <div className="divide-y divide-line-soft">
                    {items.map((entry) => (
                      <OfferingRow
                        key={entry.offering.id}
                        entry={entry}
                        dragging={dragging === entry.offering.id}
                        onDragStart={() => setDragging(entry.offering.id)}
                        onDragEnd={() => setDragging(null)}
                        onDrop={() => drop(entry.offering.id)}
                        onMove={(delta) => move(entry.offering.id, delta)}
                        categories={categories}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OfferingRow({
  entry,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  categories,
}: {
  entry: CatalogueEntry;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (delta: number) => void;
  categories: string[];
}) {
  const { offering, stats, tiers } = entry;
  const mrrCents = toCents(stats?.mrr_zar);
  const pipelineCents = toCents(stats?.pipeline_value_zar);
  const liveCount =
    offering.pricing_model === "per_unit_monthly"
      ? (stats?.active_units ?? 0)
      : (stats?.active_subscriptions ?? 0);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group px-4 py-4 transition-colors hover:bg-well/45 sm:px-5 lg:grid lg:grid-cols-[minmax(260px,1fr)_160px_90px_110px_110px_72px] lg:items-center lg:gap-4",
        dragging && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/offerings/${offering.slug}`}
            className="font-semibold text-ink hover:underline"
          >
            {offering.name}
          </Link>
          <Badge tone={TYPE_TONE[offering.offering_type]}>{OFFERING_TYPE_LABEL[offering.offering_type]}</Badge>
          <Badge tone={offering.kind === "product" ? "blue" : "green"}>{offering.kind}</Badge>
          {offering.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
          {tiers.length ? <span className="text-[11px] text-muted">{tiers.length} tiers</span> : null}
        </div>

        {offering.description ? (
          <p className="mt-1 line-clamp-1 text-[12.5px] leading-relaxed text-muted">{offering.description}</p>
        ) : null}

        {offering.portfolio?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {offering.portfolio.slice(0, 2).map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[12px] text-blue underline-offset-3 hover:underline"
              >
                <ExternalLink className="size-3" />
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <Metric label="Price" className="mt-3 lg:mt-0">
        <OfferingForm
          offering={offering}
          categories={categories}
          trigger={
            <button
              type="button"
              className="group/price inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -ml-1.5 text-left transition-colors hover:bg-sand-soft"
              aria-label={`Edit price for ${offering.name}`}
            >
              <span className="money text-[12.5px] font-medium text-ink">{priceLine(offering)}</span>
              <Pencil className="size-3 text-sand opacity-0 transition-opacity group-hover/price:opacity-100" />
            </button>
          }
        />
      </Metric>
      <Metric label={offering.unit_label ? `Live ${offering.unit_label}s` : "Live"}>
        <span className="money font-medium">{liveCount}</span>
      </Metric>
      <Metric label="MRR">
        <span className={cn(
          "inline-flex rounded-md px-2 py-1 font-medium",
          mrrCents > 0 ? "bg-green-wash text-green-deep" : "text-ink",
        )}>
          <MoneyCents cents={mrrCents} />
        </span>
      </Metric>
      <Metric label="Pipeline">
        <span className={cn(
          "inline-flex rounded-md px-2 py-1 font-medium",
          pipelineCents > 0 ? "bg-[#EAF2FC] text-blue" : "text-ink",
        )}>
          <MoneyCents cents={pipelineCents} />
        </span>
      </Metric>

      <div className="mt-3 flex items-center gap-1 lg:mt-0 lg:justify-end">
        <button
          type="button"
          onClick={() => onMove(-1)}
          aria-label={`Move ${offering.name} earlier`}
          className="grid size-8 place-items-center rounded-md text-muted opacity-60 transition hover:bg-card hover:text-ink group-hover:opacity-100"
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          aria-label={`Move ${offering.name} later`}
          className="grid size-8 place-items-center rounded-md text-muted opacity-60 transition hover:bg-card hover:text-ink group-hover:opacity-100"
        >
          <ArrowDown className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-2 flex items-baseline justify-between gap-3 lg:mt-0 lg:block", className)}>
      <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-muted lg:hidden">{label}</span>
      <div className="text-[12.5px] text-ink">{children}</div>
    </div>
  );
}

function categoryId(category: string) {
  return `offering-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function categoryTone(category: string) {
  const value = category.toLowerCase();

  if (value.includes("web")) {
    return {
      dot: "bg-blue",
      border: "border-blue/20",
      active: "border-blue/30 bg-[#EAF2FC] text-blue",
    };
  }

  if (value.includes("whatsapp") || value.includes("ai")) {
    return {
      dot: "bg-green",
      border: "border-green/20",
      active: "border-green/30 bg-green-wash text-green-deep",
    };
  }

  if (value.includes("system")) {
    return {
      dot: "bg-[#6750A4]",
      border: "border-[#6750A4]/20",
      active: "border-[#6750A4]/30 bg-[#F1ECFB] text-[#553C8B]",
    };
  }

  if (value.includes("retainer")) {
    return {
      dot: "bg-sand",
      border: "border-sand/20",
      active: "border-sand/30 bg-sand-soft text-sand",
    };
  }

  if (value.includes("saas")) {
    return {
      dot: "bg-[#0F8B8D]",
      border: "border-[#0F8B8D]/20",
      active: "border-[#0F8B8D]/30 bg-[#E6F7F7] text-[#0A6668]",
    };
  }

  return {
    dot: "bg-muted-dark",
    border: "border-line",
    active: "border-ink bg-ink text-white",
  };
}

function categoryDescription(category: string) {
  const value = category.toLowerCase();
  if (value.includes("web")) return "Marketing sites, platforms and website care.";
  if (value.includes("whatsapp") || value.includes("ai")) return "AI assistants, commerce and automations.";
  if (value.includes("system")) return "Custom software and internal tools.";
  if (value.includes("retainer")) return "Ongoing support and recurring monthly work.";
  if (value.includes("saas")) return "Subscription products with per-seat or per-unit pricing.";
  return "Products and services in this line.";
}
