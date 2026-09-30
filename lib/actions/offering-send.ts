"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok, fail, withUser, type ActionResult } from "./helpers";
import { zRequiredText, zText, zodMessage } from "./schemas";
import { escapeHtml, renderTokens, sendEmail } from "@/lib/email";
import { priceLine } from "@/lib/offerings";
import type { Client, Offering, Settings } from "@/lib/types";

const BUCKET = "offering-pdfs";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

/* ------------------------------------------------------------- the PDF --- */

/**
 * The file lands under the owner's own user id, which is what the storage
 * policy keys on — a path outside that folder is rejected by Postgres, not by
 * this code.
 */
export async function uploadOfferingPdf(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const offeringId = String(formData.get("offering_id") ?? "");
    if (!offeringId) return fail("Missing offering.");

    const file = formData.get("pdf");
    if (!(file instanceof File) || file.size === 0) return fail("Pick a PDF to upload.");
    if (file.type !== "application/pdf") return fail("That is not a PDF.");
    if (file.size > MAX_PDF_BYTES) return fail("That PDF is larger than 20MB.");

    return withUser(async (supabase, userId) => {
      const { data: offering } = await supabase
        .from("offerings")
        .select("id, slug, pdf_path")
        .eq("id", offeringId)
        .maybeSingle<Pick<Offering, "id" | "slug" | "pdf_path">>();
      if (!offering) return fail("That offering no longer exists.");

      // Timestamped so a re-upload never collides with a cached copy of the old
      // one; the previous object is deleted straight after.
      const path = `${userId}/${offering.slug}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) return fail(uploadError.message);

      const { error } = await supabase
        .from("offerings")
        .update({ pdf_path: path, pdf_name: file.name })
        .eq("id", offeringId);
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        return fail(error.message);
      }

      if (offering.pdf_path) await supabase.storage.from(BUCKET).remove([offering.pdf_path]);

      revalidatePath("/offerings");
      return ok(`${file.name} attached.`);
    });
  });
}

export async function removeOfferingPdf(offeringId: string): Promise<ActionResult> {
  return guard(async () =>
    withUser(async (supabase) => {
      const { data: offering } = await supabase
        .from("offerings")
        .select("pdf_path")
        .eq("id", offeringId)
        .maybeSingle<Pick<Offering, "pdf_path">>();

      const { error } = await supabase
        .from("offerings")
        .update({ pdf_path: null, pdf_name: null })
        .eq("id", offeringId);
      if (error) return fail(error.message);

      if (offering?.pdf_path) await supabase.storage.from(BUCKET).remove([offering.pdf_path]);
      revalidatePath("/offerings");
      return ok("PDF removed.");
    }),
  );
}

/** A short-lived link so Dan can check what a client would receive. */
export async function getOfferingPdfUrl(offeringId: string): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  try {
    return await withUser(async (supabase) => {
      const { data: offering } = await supabase
        .from("offerings")
        .select("pdf_path")
        .eq("id", offeringId)
        .maybeSingle<Pick<Offering, "pdf_path">>();
      if (!offering?.pdf_path) return { ok: false as const, error: "No PDF on this offering yet." };

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(offering.pdf_path, 60 * 10);
      if (error || !data) return { ok: false as const, error: error?.message ?? "Could not sign the link." };
      return { ok: true as const, url: data.signedUrl };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/* -------------------------------------------------------- the template --- */

const templateSchema = z.object({
  email_subject: zText,
  email_html: zText,
});

export async function saveOfferingTemplate(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const offeringId = String(formData.get("offering_id") ?? "");
    if (!offeringId) return fail("Missing offering.");

    const parsed = templateSchema.safeParse({
      email_subject: formData.get("email_subject"),
      email_html: formData.get("email_html"),
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));

    return withUser(async (supabase) => {
      const { error } = await supabase.from("offerings").update(parsed.data).eq("id", offeringId);
      if (error) return fail(error.message);
      revalidatePath("/offerings");
      return ok("Template saved.");
    });
  });
}

/* ------------------------------------------------------------ the send --- */

const sendSchema = z.object({
  offering_id: z.string().uuid("Missing offering"),
  client_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
  to_email: z.string().email("That is not an email address"),
  subject: zRequiredText,
  html: zRequiredText,
  attach_pdf: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v === "true" || v === "on"),
  cost_note: zText,
});

export async function sendOfferingEmail(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const parsed = sendSchema.safeParse({
      offering_id: formData.get("offering_id"),
      client_id: formData.get("client_id") ?? "",
      to_email: String(formData.get("to_email") ?? "").trim(),
      subject: formData.get("subject") ?? "",
      html: formData.get("html") ?? "",
      attach_pdf: formData.get("attach_pdf"),
      cost_note: null,
    });
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const input = parsed.data;

    return withUser(async (supabase, userId) => {
      const [{ data: offering }, { data: settings }, { data: client }] = await Promise.all([
        supabase.from("offerings").select("*").eq("id", input.offering_id).maybeSingle<Offering>(),
        supabase.from("settings").select("*").maybeSingle<Settings>(),
        input.client_id
          ? supabase.from("clients").select("*").eq("id", input.client_id).maybeSingle<Client>()
          : Promise.resolve({ data: null }),
      ]);

      if (!offering) return fail("That offering no longer exists.");

      const fromEmail = settings?.from_email?.trim();
      if (!fromEmail) {
        return fail(
          "No sending address yet. Add a From email in Settings — it has to be on a domain you have verified in Resend.",
        );
      }
      const fromName = settings?.from_name?.trim() || settings?.business_name || "Styfe";
      const from = `${fromName} <${fromEmail}>`;

      // The same tokens the editor advertises, filled from the chosen client.
      const tokens: Record<string, string> = {
        client_name: escapeHtml(client?.name ?? "there"),
        contact_name: escapeHtml(client?.contact_name ?? client?.name ?? "there"),
        offering_name: escapeHtml(offering.name),
        price: escapeHtml(priceLine(offering)),
        business_name: escapeHtml(settings?.business_name ?? "Styfe"),
      };
      const subject = renderTokens(input.subject, tokens);
      const html = renderTokens(input.html, tokens);

      const attachments: { filename: string; content: string }[] = [];
      if (input.attach_pdf) {
        if (!offering.pdf_path) return fail("No PDF on this offering to attach.");
        const { data: blob, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(offering.pdf_path);
        if (downloadError || !blob) {
          return fail(downloadError?.message ?? "Could not read the PDF back out of storage.");
        }
        attachments.push({
          filename: offering.pdf_name ?? `${offering.slug}.pdf`,
          content: Buffer.from(await blob.arrayBuffer()).toString("base64"),
        });
      }

      const result = await sendEmail({
        from,
        to: input.to_email,
        subject,
        html,
        replyTo: settings?.reply_to ?? null,
        attachments,
      });

      // Failures are logged too — "did I send it" has to have an honest answer.
      await supabase.from("offering_sends").insert({
        owner_id: userId,
        offering_id: offering.id,
        client_id: input.client_id,
        to_email: input.to_email,
        subject,
        status: result.ok ? "sent" : "failed",
        provider_id: result.ok ? result.id : null,
        error: result.ok ? null : result.error,
      });

      revalidatePath("/offerings");
      if (!result.ok) return fail(result.error);
      return ok(`Sent to ${input.to_email}.`);
    });
  });
}
