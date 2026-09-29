"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { todayIso, addDaysIso } from "@/lib/dates";
import { guard, ok, fail, withUser, ensureSettings, type ActionResult } from "./helpers";
import { zDate, zInvoiceStatus, zMoney, zText, zodMessage } from "./schemas";
import type { Offering } from "@/lib/types";

const lineSchema = z.object({
  description: z.string().trim().min(1, "Every line needs a description").max(300),
  qty: z
    .union([z.string(), z.number()])
    .transform((v) => Number(String(v).replace(/[\s,]/g, "")))
    .refine((v) => Number.isFinite(v) && v > 0, "Quantity must be more than zero"),
  unit_price_zar: zMoney.transform((v) => v ?? 0),
  offering_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
  tier_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
});

function readLines(formData: FormData) {
  const descriptions = formData.getAll("line_description");
  const qtys = formData.getAll("line_qty");
  const prices = formData.getAll("line_unit_price");
  const offerings = formData.getAll("line_offering_id");
  const tiers = formData.getAll("line_tier_id");

  const lines: z.infer<typeof lineSchema>[] = [];
  for (let i = 0; i < descriptions.length; i += 1) {
    const raw = String(descriptions[i] ?? "").trim();
    if (!raw) continue;
    const parsed = lineSchema.safeParse({
      description: raw,
      qty: qtys[i] ?? 1,
      unit_price_zar: prices[i] ?? 0,
      offering_id: offerings[i] ?? "",
      tier_id: tiers[i] ?? "",
    });
    if (!parsed.success) throw new Error(zodMessage(parsed.error));
    lines.push(parsed.data);
  }
  return lines;
}

const invoiceSchema = z.object({
  client_id: z.string().uuid("Pick a client"),
  issued_at: zDate,
  due_at: zDate,
  status: zInvoiceStatus,
  notes: zText,
});

export async function createInvoice(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;

  const result = await guard(async () => {
    const parsed = invoiceSchema.safeParse({
      client_id: formData.get("client_id"),
      issued_at: formData.get("issued_at"),
      due_at: formData.get("due_at"),
      status: formData.get("status") ?? "draft",
      notes: formData.get("notes"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    const lines = readLines(formData);
    if (lines.length === 0) return fail("Add at least one line.");

    return withUser(async (supabase, userId) => {
      await ensureSettings(supabase, userId);

      const { data: number, error: numberError } = await supabase.rpc("next_invoice_number");
      if (numberError || !number) return fail(numberError?.message ?? "Could not reserve a number.");

      const issued = parsed.data.issued_at ?? (parsed.data.status === "draft" ? null : todayIso());
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          owner_id: userId,
          client_id: parsed.data.client_id,
          number,
          issued_at: issued,
          due_at: parsed.data.due_at ?? (issued ? addDaysIso(issued, 30) : null),
          status: parsed.data.status,
          notes: parsed.data.notes,
        })
        .select("id")
        .single();
      if (error || !invoice) return fail(error?.message ?? "Could not create the invoice.");

      const { error: linesError } = await supabase.from("invoice_lines").insert(
        lines.map((line, index) => ({ ...line, owner_id: userId, invoice_id: invoice.id, sort: index + 1 })),
      );
      if (linesError) return fail(linesError.message);

      createdId = invoice.id;
      revalidatePath("/invoices");
      revalidatePath("/");
      return ok(`${number} created.`);
    });
  });

  if (result.ok && createdId) redirect(`/invoices/${createdId}`);
  return result;
}

export async function updateInvoice(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Missing invoice.");
    const parsed = invoiceSchema.safeParse({
      client_id: formData.get("client_id"),
      issued_at: formData.get("issued_at"),
      due_at: formData.get("due_at"),
      status: formData.get("status") ?? "draft",
      notes: formData.get("notes"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const lines = readLines(formData);
    if (lines.length === 0) return fail("Add at least one line.");

    return withUser(async (supabase, userId) => {
      const { error } = await supabase.from("invoices").update(parsed.data).eq("id", id);
      if (error) return fail(error.message);

      const { error: deleteError } = await supabase.from("invoice_lines").delete().eq("invoice_id", id);
      if (deleteError) return fail(deleteError.message);

      const { error: insertError } = await supabase.from("invoice_lines").insert(
        lines.map((line, index) => ({ ...line, owner_id: userId, invoice_id: id, sort: index + 1 })),
      );
      if (insertError) return fail(insertError.message);

      revalidatePath("/invoices");
      revalidatePath(`/invoices/${id}`);
      revalidatePath("/");
      return ok("Invoice saved.");
    });
  });
}

export async function setInvoiceStatus(
  id: string,
  status: "draft" | "sent" | "paid" | "void",
  paidAt?: string | null,
  transactionId?: string | null,
): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const update: Record<string, unknown> = { status };
      if (status === "paid") update.paid_at = paidAt ?? todayIso();
      if (status !== "paid") update.paid_at = null;
      if (status === "sent") {
        const { data: current } = await supabase.from("invoices").select("issued_at").eq("id", id).maybeSingle();
        if (!current?.issued_at) update.issued_at = todayIso();
      }

      const { error } = await supabase.from("invoices").update(update).eq("id", id);
      if (error) return fail(error.message);

      if (status === "paid" && transactionId) {
        const { error: linkError } = await supabase
          .from("transactions")
          .update({ invoice_id: id })
          .eq("id", transactionId);
        if (linkError) return fail(linkError.message);
      }

      revalidatePath("/invoices");
      revalidatePath(`/invoices/${id}`);
      revalidatePath("/");
      return ok(status === "paid" ? "Marked paid." : "Updated.");
    }),
  );
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { data: invoice } = await supabase.from("invoices").select("status").eq("id", id).maybeSingle();
      if (invoice && invoice.status !== "draft") {
        return fail("Only drafts can be deleted. Void the invoice instead.");
      }
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) return fail(error.message);
      revalidatePath("/invoices");
      return ok("Draft deleted.");
    }),
  );
}

/**
 * A won deal can carry several things at once now: a base offering plus any
 * number of add-ons. The once-off side becomes one draft invoice with a line
 * per item, so what Dan sends matches what he sold rather than collapsing into
 * a single "Website" line.
 */
export async function createInvoiceFromDeal(dealId: string): Promise<ActionResult> {
  let createdId: string | null = null;

  const result = await guard(async () =>
    withUser(async (supabase, userId) => {
      const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
      if (!deal) return fail("Deal not found.");
      if (!deal.client_id) return fail("Link the deal to a client first.");

      const { data: addonRows } = await supabase
        .from("deal_addons")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at");
      const addons = addonRows ?? [];

      const offeringIds = [
        deal.offering_id,
        ...addons.map((a: { offering_id: string }) => a.offering_id),
      ].filter((id): id is string => Boolean(id));
      const { data: offeringRows } = offeringIds.length
        ? await supabase.from("offerings").select("*").in("id", offeringIds)
        : { data: [] as Offering[] };
      const byId = new Map<string, Offering>((offeringRows ?? []).map((o: Offering) => [o.id, o]));

      const lines: {
        description: string;
        qty: number;
        unit_price_zar: number;
        offering_id: string | null;
        tier_id: string | null;
        scope: string | null;
        sort: number;
      }[] = [];

      // The base offering, when any of it is once-off.
      const base = deal.offering_id ? byId.get(deal.offering_id) : undefined;
      const basePrice = Number(deal.once_off_value_zar ?? 0) || Number(base?.setup_fee_zar ?? 0);
      if (basePrice > 0) {
        lines.push({
          description: base?.name ?? deal.title,
          qty: deal.units ?? 1,
          unit_price_zar: basePrice,
          offering_id: deal.offering_id,
          tier_id: deal.tier_id,
          // The brief belongs on the invoice for bespoke work, and only there:
          // a standard package already describes itself.
          scope: base?.offering_type === "custom" ? deal.scope : null,
          sort: 1,
        });
      }

      for (const addon of addons) {
        if (addon.pricing_model === "monthly" || addon.pricing_model === "per_unit_monthly") continue;
        const offering = byId.get(addon.offering_id);
        const price =
          addon.price_zar !== null && addon.price_zar !== undefined
            ? Number(addon.price_zar)
            : Number(offering?.setup_fee_zar ?? 0);
        lines.push({
          description: offering?.name ?? "Add-on",
          qty: addon.qty ?? 1,
          unit_price_zar: price,
          offering_id: addon.offering_id,
          tier_id: addon.tier_id,
          scope: null,
          sort: lines.length + 1,
        });
      }

      if (lines.length === 0) {
        return fail("Nothing once-off on this deal — create the subscription instead.");
      }

      await ensureSettings(supabase, userId);
      const { data: number, error: numberError } = await supabase.rpc("next_invoice_number");
      if (numberError || !number) return fail(numberError?.message ?? "Could not reserve a number.");

      const issued = todayIso();
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          owner_id: userId,
          client_id: deal.client_id,
          number,
          issued_at: issued,
          due_at: addDaysIso(issued, 30),
          status: "draft",
          notes: `From deal: ${deal.title}`,
        })
        .select("id")
        .single();
      if (error || !invoice) return fail(error?.message ?? "Could not create the invoice.");

      const { error: lineError } = await supabase
        .from("invoice_lines")
        .insert(lines.map((line) => ({ ...line, owner_id: userId, invoice_id: invoice.id })));
      if (lineError) return fail(lineError.message);

      createdId = invoice.id;
      revalidatePath("/invoices");
      revalidatePath("/pipeline");
      return ok(`${number} drafted with ${lines.length} line${lines.length === 1 ? "" : "s"}.`);
    }),
  );

  if (result.ok && createdId) redirect(`/invoices/${createdId}`);
  return result;
}

/**
 * The monthly side of a won deal: one subscription per recurring item, so a
 * Launch Website + Care Plan sale produces a subscription for the care plan
 * without inventing one for the website.
 */
export async function createSubscriptionFromDeal(dealId: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase, userId) => {
      const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
      if (!deal) return fail("Deal not found.");
      if (!deal.client_id) return fail("Link the deal to a client first.");

      const { data: addonRows } = await supabase
        .from("deal_addons")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at");
      const addons = addonRows ?? [];

      const offeringIds = [
        deal.offering_id,
        ...addons.map((a: { offering_id: string }) => a.offering_id),
      ].filter((id): id is string => Boolean(id));
      const { data: offeringRows } = offeringIds.length
        ? await supabase.from("offerings").select("*").in("id", offeringIds)
        : { data: [] as Offering[] };
      const byId = new Map<string, Offering>((offeringRows ?? []).map((o: Offering) => [o.id, o]));

      const subs: {
        offering_id: string;
        tier_id: string | null;
        units: number;
        monthly_fee_zar: number;
      }[] = [];

      const base = deal.offering_id ? byId.get(deal.offering_id) : undefined;
      if (deal.offering_id) {
        const baseMonthly =
          Number(deal.monthly_value_zar ?? 0) || Number(base?.monthly_fee_zar ?? 0);
        if (baseMonthly > 0) {
          subs.push({
            offering_id: deal.offering_id,
            tier_id: deal.tier_id,
            units: deal.units ?? 1,
            monthly_fee_zar: baseMonthly,
          });
        }
      }

      for (const addon of addons) {
        if (addon.pricing_model !== "monthly" && addon.pricing_model !== "per_unit_monthly") continue;
        const offering = byId.get(addon.offering_id);
        const monthly =
          addon.price_zar !== null && addon.price_zar !== undefined
            ? Number(addon.price_zar)
            : Number(offering?.monthly_fee_zar ?? 0);
        subs.push({
          offering_id: addon.offering_id,
          tier_id: addon.tier_id,
          units: addon.qty ?? 1,
          monthly_fee_zar: monthly,
        });
      }

      if (subs.length === 0) {
        return fail("Nothing recurring on this deal — draft the invoice instead.");
      }

      const { error } = await supabase.from("subscriptions").insert(
        subs.map((sub) => ({
          ...sub,
          owner_id: userId,
          client_id: deal.client_id,
          started_at: todayIso(),
          status: "active",
          notes: `From deal: ${deal.title}`,
        })),
      );
      if (error) return fail(error.message);

      revalidatePath("/pipeline");
      revalidatePath("/clients");
      revalidatePath("/");
      return ok(`${subs.length} subscription${subs.length === 1 ? "" : "s"} created.`);
    }),
  );
}
