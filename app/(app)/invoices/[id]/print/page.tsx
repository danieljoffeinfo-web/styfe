import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MoneyCents } from "@/components/money";
import { PrintButton } from "@/components/invoices/print-button";
import { getInvoice, getInvoiceLines } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { getClientById } from "@/lib/queries/clients";
import { toCents, vatOnCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const [lines, settings, client] = await Promise.all([
    getInvoiceLines(invoice.id),
    getSettings(),
    getClientById(invoice.client_id),
  ]);

  const subtotalCents = lines.reduce(
    (acc, line) => acc + Math.round(Number(line.qty) * toCents(line.unit_price_zar)),
    0,
  );
  const vatCents = vatOnCents(subtotalCents, settings.vatEnabled, settings.vatRate);

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <div className="print-hidden mb-5 flex flex-wrap gap-2">
        <Button asChild variant="ghost">
          <Link href={`/invoices/${invoice.id}`}>← Back</Link>
        </Button>
        <PrintButton />
      </div>

      <article className="rounded-[14px] border border-line bg-white p-8 sm:p-12 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="display text-4xl leading-none">{settings.businessName}</h1>
            {settings.businessDetails ? (
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted">
                {settings.businessDetails}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="eyebrow">Invoice</p>
            <p className="money mt-1 text-2xl">{invoice.number}</p>
            <dl className="mt-3 flex flex-col gap-0.5 text-[13px] text-muted">
              <div className="flex justify-end gap-3">
                <dt>Issued</dt>
                <dd className="money text-ink">{formatDate(invoice.issued_at)}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt>Due</dt>
                <dd className="money text-ink">{formatDate(invoice.due_at)}</dd>
              </div>
              {invoice.paid_at ? (
                <div className="flex justify-end gap-3">
                  <dt>Paid</dt>
                  <dd className="money text-ink">{formatDate(invoice.paid_at)}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </header>

        <section className="mt-10">
          <p className="eyebrow">Bill to</p>
          <p className="mt-1.5 text-lg font-semibold">{invoice.client_name}</p>
          {client?.billing_address ? (
            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted">
              {client.billing_address}
            </p>
          ) : null}
          <p className="text-[13px] text-muted">
            {[
              invoice.contact_name,
              // The billing address takes over from the contact email once it is set.
              client?.billing_email ?? invoice.contact_email,
              invoice.contact_phone,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {client?.vat_number || client?.registration_number ? (
            <p className="mt-1 text-[13px] text-muted">
              {[
                client.vat_number ? `VAT ${client.vat_number}` : null,
                client.registration_number ? `Reg ${client.registration_number}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </section>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="pb-2 font-normal">Description</th>
              <th className="pb-2 text-right font-normal">Qty</th>
              <th className="pb-2 text-right font-normal">Unit price</th>
              <th className="pb-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-line-soft">
                <td className="py-3">
                  {line.description}
                  {line.scope ? (
                    <span className="mt-1 block whitespace-pre-line text-[12px] leading-relaxed text-muted">
                      {line.scope}
                    </span>
                  ) : null}
                </td>
                <td className="money py-3 text-right">{Number(line.qty)}</td>
                <td className="money py-3 text-right">
                  <MoneyCents cents={toCents(line.unit_price_zar)} withCents />
                </td>
                <td className="money py-3 text-right">
                  <MoneyCents cents={Math.round(Number(line.qty) * toCents(line.unit_price_zar))} withCents />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-5 flex w-full max-w-[300px] flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="money">
              <MoneyCents cents={subtotalCents} withCents />
            </dd>
          </div>
          {settings.vatEnabled ? (
            <div className="flex justify-between">
              <dt>VAT {Math.round(settings.vatRate * 100)}%</dt>
              <dd className="money">
                <MoneyCents cents={vatCents} withCents />
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="money">
              <MoneyCents cents={subtotalCents + vatCents} withCents />
            </dd>
          </div>
        </dl>

        {!settings.vatEnabled ? (
          <p className="mt-4 text-xs text-muted">Not registered for VAT. No VAT charged.</p>
        ) : null}

        {settings.bank.accountNumber || settings.bank.name ? (
          <section className="mt-8 border-t border-line pt-5">
            <p className="eyebrow">Banking details</p>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[13px]">
              {settings.bank.accountName ? (
                <>
                  <dt className="text-muted">Account name</dt>
                  <dd>{settings.bank.accountName}</dd>
                </>
              ) : null}
              {settings.bank.name ? (
                <>
                  <dt className="text-muted">Bank</dt>
                  <dd>{settings.bank.name}</dd>
                </>
              ) : null}
              {settings.bank.accountNumber ? (
                <>
                  <dt className="text-muted">Account number</dt>
                  <dd className="money">{settings.bank.accountNumber}</dd>
                </>
              ) : null}
              {settings.bank.branchCode ? (
                <>
                  <dt className="text-muted">Branch code</dt>
                  <dd className="money">{settings.bank.branchCode}</dd>
                </>
              ) : null}
              {settings.bank.swift ? (
                <>
                  <dt className="text-muted">SWIFT</dt>
                  <dd className="money">{settings.bank.swift}</dd>
                </>
              ) : null}
              <dt className="text-muted">Reference</dt>
              {/* The invoice number is the reference unless Dan set one. */}
              <dd className="money">{settings.bank.reference || invoice.number}</dd>
            </dl>
          </section>
        ) : null}

        {invoice.notes ? (
          <section className="mt-8 border-t border-line pt-5">
            <p className="eyebrow">Notes</p>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed">{invoice.notes}</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
