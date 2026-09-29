/**
 * Fails loudly if the numbers in the database do not match Dan's statements.
 *
 *   npm run check                                  # against .env.local
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run check   # against production
 *
 * Expected values come from seed/transactions_2026-03_to_2026-09.csv and the
 * handover brief. Money is compared in cents with a R1 tolerance, because the
 * brief rounds some figures.
 */
import { adminClient, ownerId } from "./_client";
import { bold, dim, green, red } from "./_env";

const TOLERANCE_CENTS = 100;

type Check = { name: string; expected: string; actual: string; pass: boolean };
const checks: Check[] = [];

const rands = (cents: number) =>
  `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function expectMoney(name: string, actualCents: number, expectedCents: number) {
  checks.push({
    name,
    expected: rands(expectedCents),
    actual: rands(actualCents),
    pass: Math.abs(actualCents - expectedCents) <= TOLERANCE_CENTS,
  });
}

function expectNumber(name: string, actual: number, expected: number) {
  checks.push({ name, expected: String(expected), actual: String(actual), pass: actual === expected });
}

const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

/** Income by FNB statement month (the cycle runs 4th to the 3rd). */
const INCOME_BY_MONTH: Record<string, number> = {
  "2026-03": 981_500,
  "2026-04": 1_280_527,
  "2026-05": 871_300,
  "2026-06": 7_210_190,
  "2026-07": 4_391_750,
  "2026-08": 865_170,
};

const INCOME_BY_CATEGORY: Record<string, number> = {
  income_ie_global: 5_301_827,
  income_proto: 6_000_000,
  income_client_unlabelled: 2_910_190,
  income_britos: 741_750,
  income_other: 646_667,
};

const EXPECTED_TRANSACTIONS = 1469;
const EXPECTED_RECEIVABLES_CENTS = 3_320_000;
const EXPECTED_MRR_CENTS = 800_000;

/** The v2 catalogue, as supabase/migrations/20260929090000_offerings_v2.sql ships it. */
const CATALOGUE: Record<string, "standard" | "custom" | "addon"> = {
  "website-launch": "standard",
  "website-platform": "standard",
  "website-signature": "standard",
  "website-care": "addon",
  "whatsapp-assistant": "standard",
  "whatsapp-commerce": "standard",
  "whatsapp-care": "addon",
  "custom-build": "custom",
  "growth-retainer": "standard",
  "proto-retainer": "standard",
  "moto-desk": "standard",
  "chom-learn": "standard",
};

async function main() {
  const supabase = adminClient();
  const owner = await ownerId(supabase);

  // --- transactions ------------------------------------------------------
  const { count: txCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner);
  expectNumber("Transactions imported", txCount ?? 0, EXPECTED_TRANSACTIONS);

  // --- income by statement month -----------------------------------------
  const { data: monthly } = await supabase
    .from("v_monthly_income")
    .select("month, total_zar")
    .eq("owner_id", owner);
  const byMonth = new Map((monthly ?? []).map((r) => [String(r.month).slice(0, 7), toCents(r.total_zar)]));
  for (const [month, expected] of Object.entries(INCOME_BY_MONTH)) {
    expectMoney(`Income · ${month}`, byMonth.get(month) ?? 0, expected);
  }

  // --- income by category -------------------------------------------------
  const { data: income } = await supabase
    .from("transactions")
    .select("category, amount_zar")
    .eq("owner_id", owner)
    .like("category", "income_%")
    .limit(5000);

  const byCategory = new Map<string, number>();
  for (const row of income ?? []) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + toCents(row.amount_zar));
  }
  let totalEarned = 0;
  for (const [category, expected] of Object.entries(INCOME_BY_CATEGORY)) {
    expectMoney(`Earned · ${category}`, byCategory.get(category) ?? 0, expected);
    totalEarned += expected;
  }
  expectMoney(
    "Total earned",
    [...byCategory.values()].reduce((a, b) => a + b, 0),
    totalEarned,
  );

  // --- receivables and MRR -------------------------------------------------
  const { data: receivables } = await supabase
    .from("v_receivables")
    .select("total_zar")
    .eq("owner_id", owner);
  expectMoney(
    "Receivables",
    (receivables ?? []).reduce((acc, r) => acc + toCents(r.total_zar), 0),
    EXPECTED_RECEIVABLES_CENTS,
  );

  const { data: mrr } = await supabase.from("v_mrr").select("mrr_zar").eq("owner_id", owner).maybeSingle();
  expectMoney("MRR", toCents(mrr?.mrr_zar), EXPECTED_MRR_CENTS);

  // --- nothing orphaned ----------------------------------------------------
  const { count: orphaned } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .is("owner_id", null);
  expectNumber("Rows with no owner", orphaned ?? 0, 0);

  // --- catalogue -----------------------------------------------------------
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, slug, offering_type, status")
    .eq("owner_id", owner);
  const bySlug = new Map((offerings ?? []).map((o) => [o.slug, o]));

  const missing = Object.keys(CATALOGUE).filter((slug) => bySlug.get(slug)?.status !== "active");
  expectNumber(`Catalogue slugs active (${Object.keys(CATALOGUE).length})`, missing.length, 0);

  const wrongType = Object.entries(CATALOGUE).filter(
    ([slug, type]) => bySlug.has(slug) && bySlug.get(slug)!.offering_type !== type,
  );
  expectNumber("Catalogue types correct", wrongType.length, 0);

  // Renaming and archiving must never strand history.
  const offeringIds = new Set((offerings ?? []).map((o) => o.id));
  const { data: dealRefs } = await supabase
    .from("deals")
    .select("offering_id")
    .eq("owner_id", owner)
    .not("offering_id", "is", null);
  expectNumber(
    "Deals resolve to an offering",
    (dealRefs ?? []).filter((d) => !offeringIds.has(d.offering_id)).length,
    0,
  );

  const { data: lineRefs } = await supabase
    .from("invoice_lines")
    .select("offering_id")
    .eq("owner_id", owner)
    .not("offering_id", "is", null);
  expectNumber(
    "Invoice lines resolve to an offering",
    (lineRefs ?? []).filter((l) => !offeringIds.has(l.offering_id)).length,
    0,
  );

  // --- report --------------------------------------------------------------
  const width = Math.max(...checks.map((c) => c.name.length));
  console.log(bold("\n  Styfe HQ sanity checks\n"));
  for (const check of checks) {
    const mark = check.pass ? green("pass") : red("FAIL");
    const detail = check.pass
      ? dim(check.actual)
      : red(`got ${check.actual}, expected ${check.expected}`);
    console.log(`  ${mark}  ${check.name.padEnd(width)}  ${detail}`);
  }

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.error(red(`\n  ${failed.length} of ${checks.length} checks failed.\n`));
    process.exit(1);
  }
  console.log(green(`\n  All ${checks.length} checks passed.\n`));
}

main().catch((error) => {
  console.error(red(`\n  ${error instanceof Error ? error.message : String(error)}\n`));
  process.exit(1);
});
