"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { todayIso, addDaysIso } from "@/lib/dates";
import { guard, ok, fail, withUser, ensureSettings, type ActionResult } from "./helpers";
import { zDate, zInvoiceStatus, zMoney, zText, zodMessage } from "./schemas";

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

/** Draft invoice straight off a won deal — used by the Won flow. */
export async function createInvoiceFromDeal(dealId: string): Promise<ActionResult> {
  let createdId: string | null = null;

  const result = await guard(async () =>
    withUser(async (supabase, userId) => {
      const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
      if (!deal) return fail("Deal not found.");
      if (!deal.client_id) return fail("Link the deal to a client first.");

      await ensureSettings(supabase, userId);
      const { data: number, error: numberError } = await supabase.rpc("next_invoice_number");
      if (numberError || !number) return fail(numberError?.message ?? "Could not reserve a number.");

      let description = deal.title;
      let unitPrice = Number(deal.once_off_value_zar ?? 0);
      if (deal.offering_id) {
        const { data: offering } = await supabase
          .from("offerings")
          .select("name, setup_fee_zar")
          .eq("id", deal.offering_id)
          .maybeSingle();
        if (offering) {
          description = offering.name;
          if (!unitPrice) unitPrice = Number(offering.setup_fee_zar ?? 0);
        }
      }

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

      const { error: lineError } = await supabase.from("invoice_lines").insert({
        owner_id: userId,
        invoice_id: invoice.id,
        offering_id: deal.offering_id,
        tier_id: deal.tier_id,
        description,
        qty: deal.units ?? 1,
        unit_price_zar: unitPrice,
        sort: 1,
      });
      if (lineError) return fail(lineError.message);

      createdId = invoice.id;
      revalidatePath("/invoices");
      revalidatePath("/pipeline");
      return ok(`${number} drafted.`);
    }),
  );

  if (result.ok && createdId) redirect(`/invoices/${createdId}`);
  return result;
}

/** Subscription straight off a won deal — used by the Won flow. */
export async function createSubscriptionFromDeal(dealId: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase, userId) => {
      const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
      if (!deal) return fail("Deal not found.");
      if (!deal.client_id) return fail("Link the deal to a client first.");
      if (!deal.offering_id) return fail("Link the deal to an offering first.");

      let monthly = Number(deal.monthly_value_zar ?? 0);
      if (!monthly) {
        const { data: offering } = await supabase
          .from("offerings")
          .select("monthly_fee_zar")
          .eq("id", deal.offering_id)
          .maybeSingle();
        monthly = Number(offering?.monthly_fee_zar ?? 0);
      }

      const { error } = await supabase.from("subscriptions").insert({
        owner_id: userId,
        client_id: deal.client_id,
        offering_id: deal.offering_id,
        tier_id: deal.tier_id,
        units: deal.units ?? 1,
        monthly_fee_zar: monthly,
        started_at: todayIso(),
        status: "active",
        notes: `From deal: ${deal.title}`,
      });
      if (error) return fail(error.message);

      revalidatePath("/pipeline");
      revalidatePath("/clients");
      revalidatePath("/");
      return ok("Subscription created.");
    }),
  );
}
