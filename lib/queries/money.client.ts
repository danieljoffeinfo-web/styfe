/** Shared with lib/queries/money.ts — kept here so client components can use it. */
export function merchantName(description: string): string {
  const cleaned = description
    .replace(
      /^(POS Purchase|Card Purchase|Internet Pmt To|Magtape (Credit|Debit)|FNB App (Geo )?(Payment|Transfer) (To|From)|Send Money App Dr Send|Payshap (Account|Credit) (On|Off)-Us|Rtc Credit|Airtime Topup)\s*/i,
      "",
    )
    .replace(/\b(Dl|New|S2S|Yoco|Tabbs|Ap|Ik)\s*\*?\s*/i, "")
    .replace(/[*]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || "Bank fees";
}
