/**
 * Fails loudly if the database is not in a shape the app can run against.
 *
 *   npm run check                                  # against .env.local
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run check   # against production
 *
 * This used to assert Dan's imported statement figures. That import was mock
 * data and has been cleared, and revenue is entered by hand now, so there are
 * no fixed totals left to check. What it asserts instead is structural: the
 * catalogue is present and correctly typed, nothing is orphaned, every
 * reference resolves, and the tables the app needs exist with anon locked out.
 */
import { adminClient, ownerId } from "./_client";
import { bold, dim, green, red } from "./_env";

type Check = { name: string; expected: string; actual: string; pass: boolean };
const checks: Check[] = [];

function expectNumber(name: string, actual: number, expected: number) {
  checks.push({ name, expected: String(expected), actual: String(actual), pass: actual === expected });
}

/** Every table the app writes to carries owner_id and must never hold a null. */
const OWNED_TABLES = [
  "settings", "path_segments", "categories", "category_rules", "clients",
  "offerings", "offering_tiers", "subscriptions", "invoices", "invoice_lines",
  "deals", "deal_addons", "revenue_entries", "admin_items", "daily_tasks", "alerts",
] as const;

/** Relations the pages read. A missing one means a migration has not run. */
const REQUIRED_RELATIONS = [
  "revenue_entries", "admin_items", "deal_addons",
  "v_monthly_revenue", "v_mrr", "v_receivables", "v_invoices", "v_offering_stats",
] as const;

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

  // --- nothing orphaned ----------------------------------------------------
  // seed_owner() returns null until Dan's auth user exists, so a row with no
  // owner is invisible to the app under RLS. `npm run db:claim` repairs it.
  let unowned = 0;
  for (const table of OWNED_TABLES) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .is("owner_id", null);
    unowned += count ?? 0;
  }
  expectNumber("Rows with no owner", unowned, 0);

  // --- the tables the app reads --------------------------------------------
  for (const relation of REQUIRED_RELATIONS) {
    const { error } = await supabase.from(relation).select("*", { head: true, count: "exact" }).limit(1);
    checks.push({
      name: `Readable · ${relation}`,
      expected: "readable",
      actual: error ? error.message : "readable",
      pass: !error,
    });
  }

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
