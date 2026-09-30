import { z } from "zod";

/** Accepts "", "R7 300", "7,300.50" and turns it into a number or null. */
export const zMoney = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const cleaned = v.replace(/[Rr\s,]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || (v >= 0 && v < 1_000_000_000), "Amount looks wrong");

export const zMoneyRequired = zMoney.refine((v): v is number => v !== null, "Enter an amount");

export const zSignedMoney = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const cleaned = String(v).replace(/[Rr\s,]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => Number.isFinite(v), "Enter an amount");

export const zInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  });

export const zDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null));

export const zText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  });

export const zRequiredText = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, "Required").max(200));

export const zBool = z
  .union([z.string(), z.boolean(), z.null(), z.undefined()])
  .transform((v) => v === true || v === "true" || v === "on" || v === "1");

/** The portfolio editor posts label/url in matching order, so they zip back
 *  into pairs. A row with a blank url is dropped rather than saved half-built. */
export function parsePortfolio(
  labels: FormDataEntryValue[],
  urls: FormDataEntryValue[],
): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = String(urls[i] ?? "").trim();
    if (!url) continue;
    const label = String(labels[i] ?? "").trim();
    out.push({ label: label || url.replace(/^https?:\/\//, "").replace(/\/$/, ""), url });
  }
  return out.slice(0, 20);
}

/** A deliverables editor posts one `deliverables` field per line. */
export function parseList(values: FormDataEntryValue[]): string[] {
  return values
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
    .slice(0, 40);
}

export const PRICING_MODELS = ["once_off", "monthly", "per_unit_monthly", "quote"] as const;
export const zPricingModel = z.enum(PRICING_MODELS);
export const zOfferingKind = z.enum(["service", "product"]);
export const zOfferingType = z.enum(["standard", "custom", "addon"]);
export const zOfferingStatus = z.enum(["active", "archived"]);
export const zDealStage = z.enum(["lead", "meeting", "proposal", "pilot", "won", "lost"]);
export const zInvoiceStatus = z.enum(["draft", "sent", "overdue", "paid", "void"]);
export const zClientRelationship = z.enum(["retainer", "project", "employer"]);
export const zClientStatus = z.enum(["active", "paused", "ended"]);
export const zSubscriptionStatus = z.enum(["active", "paused", "cancelled"]);

/** A client colour is a #rrggbb swatch or nothing at all. Anything else is
 *  dropped rather than rejected, so a stale form never blocks a save. */
export const zHexColor = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const t = (v ?? "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toUpperCase() : null;
  });

/** Turns a zod error into the single sentence the forms show. */
export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Check the form and try again.";
  const path = issue.path.filter((p) => typeof p === "string").join(" ");
  return path ? `${path}: ${issue.message}` : issue.message;
}
