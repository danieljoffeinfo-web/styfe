import { formatZar } from "@/lib/money";
import type { Offering, OfferingTier, PricingModel } from "@/lib/types";

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

/** The text the "Copy price sheet" button puts on the clipboard. */
export function priceSheet(
  entries: { offering: Offering; tiers: OfferingTier[] }[],
  businessName: string,
): string {
  const lines: string[] = [`${businessName} — products & services`, ""];
  const byCategory = new Map<string, typeof entries>();

  for (const entry of entries) {
    if (entry.offering.status !== "active") continue;
    const list = byCategory.get(entry.offering.category) ?? [];
    list.push(entry);
    byCategory.set(entry.offering.category, list);
  }

  for (const [category, items] of byCategory) {
    lines.push(category.toUpperCase());
    for (const { offering, tiers } of items) {
      lines.push(`  ${offering.name} — ${priceLine(offering)}`);
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
      if (offering.delivery_days) lines.push(`    Delivery: ${offering.delivery_days} days`);
      lines.push("");
    }
  }

  lines.push("Prices exclude VAT.");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
