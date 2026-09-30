import "server-only";

/**
 * Resend, called over plain fetch rather than the SDK: one endpoint, one shape,
 * and nothing to keep in step at upgrade time.
 *
 * Note on deliverability — Resend only sends to arbitrary recipients from a
 * domain verified in the Resend dashboard. Until Dan verifies one, a send to
 * a client bounces back as a 403 and the error is surfaced verbatim rather
 * than swallowed, because "it said sent but nothing arrived" is the worst
 * possible outcome here.
 */
const ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  attachments?: { filename: string; content: string }[];
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY is not set on this deployment." };
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach Resend." };
  }

  const body = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok) {
    // Resend's own wording is more useful than anything generic, so it goes
    // straight through to the toast.
    return { ok: false, error: body?.message ?? `Resend returned ${response.status}.` };
  }
  if (!body?.id) return { ok: false, error: "Resend accepted the send but returned no id." };

  return { ok: true, id: body.id };
}

/**
 * The handful of tokens a covering email needs. Deliberately not a template
 * language: `{{client_name}}` in the subject or the body, and that is it.
 */
export function renderTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => {
    const value = tokens[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}

export const EMAIL_TOKENS = [
  "client_name",
  "contact_name",
  "offering_name",
  "price",
  "business_name",
] as const;

/** Escapes a value before it goes into an HTML template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
