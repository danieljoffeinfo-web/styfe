/**
 * One-off repair: gives every row with a null owner_id to Dan.
 *
 *   npm run db:claim
 *
 * Only needed when data was inserted before his auth user existed — normally
 * `npm run db:seed` creates the user first and nothing is left to claim.
 */
import { adminClient, ownerId } from "./_client";
import { OWNER_EMAIL, bold, dim, green, red } from "./_env";

const TABLES = [
  "settings", "path_segments", "categories", "category_rules", "clients",
  "offerings", "offering_tiers", "subscriptions", "invoices", "invoice_lines",
  "transactions", "deals", "deal_addons", "goals", "goal_entries", "weekly_targets",
  "weekly_scores", "daily_tasks", "alerts",
];

async function main() {
  const supabase = adminClient();
  const owner = await ownerId(supabase);
  console.log(bold(`Claiming orphaned rows for ${OWNER_EMAIL} (${owner})`));

  let total = 0;
  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .update({ owner_id: owner })
      .is("owner_id", null)
      .select(table === "categories" || table === "weekly_targets" ? "slug" : "id");

    if (error) {
      // weekly_targets is keyed on `metric`, categories on `slug`.
      const { data: retry, error: retryError } = await supabase
        .from(table)
        .update({ owner_id: owner })
        .is("owner_id", null)
        .select();
      if (retryError) {
        console.error(red(`  ${table}: ${retryError.message}`));
        process.exitCode = 1;
        continue;
      }
      const n = retry?.length ?? 0;
      total += n;
      if (n) console.log(`  ${table}: ${n}`);
      continue;
    }

    const n = data?.length ?? 0;
    total += n;
    if (n) console.log(`  ${table}: ${n}`);
  }

  console.log(total ? green(`  ${total} rows claimed.`) : dim("  Nothing to claim."));
}

main().catch((error) => {
  console.error(red(`\n  ${error instanceof Error ? error.message : String(error)}\n`));
  process.exit(1);
});
