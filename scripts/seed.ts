/**
 * Runs seed/seed.sql against the linked Supabase project.
 *
 *   npm run db:seed
 *
 * Creates Dan's auth user first (so public.seed_owner() resolves) and then
 * executes the file in one transaction. Re-running it is safe.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { adminClient, ownerId } from "./_client";
import { DB_URL, OWNER_EMAIL, bold, green, red, dim } from "./_env";

async function main() {
  const supabase = adminClient();
  const owner = await ownerId(supabase);
  console.log(dim(`  Owner: ${OWNER_EMAIL} (${owner})`));

  const sql = readFileSync("seed/seed.sql", "utf8");
  const client = new Client({ connectionString: DB_URL() });
  await client.connect();

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(green("  Seed applied."));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  const counts = await Promise.all(
    ["clients", "offerings", "offering_tiers", "subscriptions", "invoices", "deals", "goals", "daily_tasks"].map(
      async (table) => {
        const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
        return `${table}: ${count ?? 0}`;
      },
    ),
  );
  console.log(bold("  " + counts.join("  ·  ")));
}

main().catch((error) => {
  console.error(red(`\n  ${error instanceof Error ? error.message : String(error)}\n`));
  process.exit(1);
});
