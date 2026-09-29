import { formatZar, toCents } from "@/lib/money";
import {
  OFFERING_TYPE_ORDER,
  type DealAddon,
  type Offering,
  type OfferingTier,
  type PricingModel,
} from "@/lib/types";

type Priced = Pick<
  Offering,
  "pricing_model" | "setup_fee_zar" | "monthly_fee_zar" | "unit_label"
>;

/**
 * The one-line price the catalogue, pickers and price sheet all show.
 * "R7,300 once-off" · "R8,000 / dealership / month" · "Quote"
 */
export function priceLine(item: Priced): string {
  const setup = item.setup_fee_zar === null ? null : Number(item.setup_fee_zar);
  const monthly = item.monthly_fee_zar === null ? null : Number(item.monthly_fee_zar);

  switch (item.pricing_model) {
    case "quote":
      return "Quote";

    case "per_unit_monthly": {
      if (monthly === null) return "Set price";
      const unit = item.unit_label ?? "unit";
      const base = `${formatZar(monthly)} / ${unit} / month`;
      return setup ? `${formatZar(setup)} setup + ${base}` : base;
    }

    case "monthly": {
      if (monthly === null) return "Set price";
      const base = `${formatZar(monthly)} / month`;
      return setup ? `${formatZar(setup)} setup + ${base}` : base;
    }

    case "once_off":
    default: {
      if (setup === null) return "Set price";
      return `${formatZar(setup)} once-off`;
    }
  }
}

export function tierPriceLine(tier: OfferingTier, offering: Offering): string {
  return priceLine({
    pricing_model: tier.pricing_model,
    setup_fee_zar: tier.setup_fee_zar,
    monthly_fee_zar: tier.monthly_fee_zar,
    unit_label: offering.unit_label,
  });
}

/** Which price fields a pricing model actually uses. */
export function fieldsFor(model: PricingModel) {
  return {
    setup: model === "once_off" || model === "monthly" || model === "per_unit_monthly",
    monthly: model === "monthly" || model === "per_unit_monthly",
    units: model === "per_unit_monthly",
  };
}

export const OFFERING_COLORS = [
  { value: "#1D6B4F", label: "Green" },
  { value: "#C9A77A", label: "Sand" },
  { value: "#2F5D8A", label: "Blue" },
  { value: "#8A3E12", label: "Rust" },
  { value: "#17171B", label: "Ink" },
];

/** Catalogue order inside a service line: packages, then bespoke, then extras. */
export function compareCatalogue(
  a: { offering: Offering },
  b: { offering: Offering },
): number {
  const byType =
    OFFERING_TYPE_ORDER[a.offering.offering_type] - OFFERING_TYPE_ORDER[b.offering.offering_type];
  if (byType !== 0) return byType;
  if (a.offering.sort !== b.offering.sort) return a.offering.sort - b.offering.sort;
  return a.offering.name.localeCompare(b.offering.name);
}

/**
 * Service line -> its offerings, each list in catalogue order. Insertion order
 * of the map follows the first offering seen for a line, which is the `sort`
 * order the page already queries in, so Dan's reordering still drives it.
 */
export function groupByServiceLine<T extends { offering: Offering }>(
  entries: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.offering.category) ?? [];
    list.push(entry);
    grouped.set(entry.offering.category, list);
  }
  for (const list of grouped.values()) list.sort(compareCatalogue);
  return grouped;
}

/** An add-on's price in cents: the per-deal override, else the list price. */
export function addonPriceCents(addon: Pick<DealAddon, "price_zar" | "qty" | "pricing_model">, offering?: Offering): number {
  const override = addon.price_zar;
  if (override !== null && override !== undefined && override !== "") {
    return toCents(override) * addon.qty;
  }
  if (!offering) return 0;
  const list =
    addon.pricing_model === "once_off" ? offering.setup_fee_zar : offering.monthly_fee_zar;
  return toCents(list) * addon.qty;
}

export function isRecurring(model: PricingModel): boolean {
  return model === "monthly" || model === "per_unit_monthly";
}

/**
 * What a deal is worth, split the way the win has to be actioned: the once-off
 * side becomes invoice lines, the monthly side becomes subscriptions. Base
 * values come off the deal itself (they are already the quoted amounts, tier
 * and custom quotes included); add-ons price themselves.
 */
export function dealTotals(
  deal: { units?: number | null; once_off_value_zar?: unknown; monthly_value_zar?: unknown },
  addons: Pick<DealAddon, "price_zar" | "qty" | "pricing_model" | "offering_id">[] = [],
  offeringsById: Map<string, Offering> = new Map(),
): { onceOffCents: number; monthlyCents: number; totalCents: number } {
  const units = deal.units && deal.units > 0 ? deal.units : 1;
  let onceOffCents = toCents(deal.once_off_value_zar as never) * units;
  let monthlyCents = toCents(deal.monthly_value_zar as never) * units;

  for (const addon of addons) {
    const cents = addonPriceCents(addon, offeringsById.get(addon.offering_id));
    if (isRecurring(addon.pricing_model)) monthlyCents += cents;
    else onceOffCents += cents;
  }

  return { onceOffCents, monthlyCents, totalCents: onceOffCents + monthlyCents };
}

/**
 * The text the "Copy price sheet" button puts on the clipboard.
 *
 * Standard packages and add-ons carry a price, so they are listed. Custom work
 * has none by definition, so a service line that contains any custom offering
 * gets one line saying so rather than an entry per bespoke build.
 */
export function priceSheet(
  entries: { offering: Offering; tiers: OfferingTier[] }[],
  businessName: string,
): string {
  const lines: string[] = [`${businessName} — products & services`, ""];
  const active = entries.filter((e) => e.offering.status === "active");

  for (const [serviceLine, items] of groupByServiceLine(active)) {
    lines.push(serviceLine.toUpperCase());

    for (const { offering, tiers } of items) {
      if (offering.offering_type === "custom") continue;

      const prefix = offering.offering_type === "addon" ? "Add-on: " : "";
      lines.push(`  ${prefix}${offering.name} — ${priceLine(offering)}`);
      if (offering.ideal_for) lines.push(`    For: ${offering.ideal_for}`);
      if (offering.description) lines.push(`    ${offering.description}`);

      for (const deliverable of offering.deliverables ?? []) {
        lines.push(`    • ${deliverable}`);
      }
      for (const tier of tiers) {
        lines.push(`    ${tier.name} — ${tierPriceLine(tier, offering)}`);
        for (const deliverable of tier.deliverables ?? []) {
          lines.push(`      • ${deliverable}`);
        }
      }
      for (const exclude of offering.excludes ?? []) {
        lines.push(`    Not included: ${exclude}`);
      }
      for (const link of offering.portfolio ?? []) {
        lines.push(`    See: ${link.label} — ${link.url}`);
      }
      if (offering.delivery_days) lines.push(`    Delivery: ${offering.delivery_days} days`);
      lines.push("");
    }

    if (items.some((e) => e.offering.offering_type === "custom")) {
      lines.push("  Custom builds: quoted per project.");
      lines.push("");
    }
  }

  lines.push("Prices exclude VAT.");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
