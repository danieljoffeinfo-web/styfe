/**
 * Loads an FNB CSV into public.transactions.
 *
 *   npm run import:transactions                        # the bundled statement
 *   npm run import:transactions -- path/to/export.csv
 *
 * Idempotent: rows collide on (owner_id, date, description, amount_zar, source,
 * occurrence) and are skipped. `occurrence` is the 1-based index of an identical
 * (date, description, amount) tuple within the file, so genuinely repeated rows
 * — the R8 bank fees, the R49.94 Uber rides — all survive while a re-import of
 * the same file still adds nothing.
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { adminClient, ownerId } from "./_client";
import { bold, dim, green, red } from "./_env";

const DEFAULT_FILE = "seed/transactions_2026-03_to_2026-09.csv";
const CHUNK = 500;

interface CsvRow {
  date: string;
  description?: string;
  amount_zar: string;
  category?: string;
  is_internal?: string;
  source?: string;
}

/** Categories that map a payment straight onto a client. */
const CLIENT_BY_CATEGORY: Record<string, string> = {
  income_proto: "proto-trading",
  income_britos: "britos",
  income_ie_global: "ie-global",
};

async function main() {
  const file = process.argv[2] ?? DEFAULT_FILE;
  const supabase = adminClient();
  const owner = await ownerId(supabase);

  const raw = readFileSync(file, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];
  if (rows.length === 0) {
    console.error(red(`${file} has no rows.`));
    process.exit(1);
  }

  const { data: knownCategories } = await supabase.from("categories").select("slug");
  const known = new Set((knownCategories ?? []).map((c) => c.slug));
  if (known.size === 0) {
    console.error(red("No categories in the database. Run the migrations first."));
    process.exit(1);
  }

  const { data: clients } = await supabase.from("clients").select("id, slug").eq("owner_id", owner);
  const clientIdBySlug = new Map((clients ?? []).map((c) => [c.slug, c.id]));

  const seen = new Map<string, number>();
  const unknownCategories = new Set<string>();
  const batchId = crypto.randomUUID();

  const payload = rows.map((row, index) => {
    const date = row.date?.slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Row ${index + 2}: "${row.date}" is not a YYYY-MM-DD date.`);
    }
    const amount = Number(String(row.amount_zar).replace(/[\s,R]/g, ""));
    if (!Number.isFinite(amount)) {
      throw new Error(`Row ${index + 2}: "${row.amount_zar}" is not an amount.`);
    }

    const description = (row.description ?? "").trim();
    const source = row.source?.trim() || "fnb_statement_import";
    let category = row.category?.trim() || (amount >= 0 ? "income_other" : "other");
    if (!known.has(category)) {
      unknownCategories.add(category);
      category = amount >= 0 ? "income_other" : "other";
    }

    const key = `${date}|${description}|${amount.toFixed(2)}|${source}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);

    return {
      owner_id: owner,
      date,
      description,
      amount_zar: amount,
      category,
      is_internal: String(row.is_internal).toLowerCase() === "true",
      client_id: clientIdBySlug.get(CLIENT_BY_CATEGORY[category] ?? "") ?? null,
      source,
      import_batch_id: batchId,
      occurrence,
    };
  });

  console.log(bold(`Importing ${payload.length} rows from ${file}`));
  if (unknownCategories.size) {
    console.log(
      dim(`  Unknown categories fell back to income_other / other: ${[...unknownCategories].join(", ")}`),
    );
  }

  let inserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("transactions")
      .upsert(chunk, {
        onConflict: "owner_id,date,description,amount_zar,source,occurrence",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      console.error(red(`  Failed at row ${i + 1}: ${error.message}`));
      process.exit(1);
    }
    inserted += data?.length ?? 0;
    process.stdout.write(dim(`  ${Math.min(i + CHUNK, payload.length)}/${payload.length}\r`));
  }

  const skipped = payload.length - inserted;
  console.log(green(`\n  ${inserted} imported, ${skipped} already there.`));
}

main().catch((error) => {
  console.error(red(`\n  ${error instanceof Error ? error.message : String(error)}\n`));
  process.exit(1);
});
