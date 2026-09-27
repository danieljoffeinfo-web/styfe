/**
 * FNB CSV parsing, shared by the import screen.
 * Runs in the browser so Dan can see exactly what will land before committing.
 */

export interface ParsedRow {
  date: string;
  description: string;
  amount_zar: number;
  category: string;
  is_internal: boolean;
  occurrence: number;
  /** true when the category came from the file rather than a rule. */
  fromFile: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
  columns: { date: string; description: string; amount: string | null; debit: string | null; credit: string | null };
}

export interface Rule {
  pattern: string;
  category: string;
  priority: number;
}

const DATE_KEYS = ["date", "transaction date", "txn date", "posting date", "value date"];
const DESCRIPTION_KEYS = ["description", "details", "narrative", "transaction description", "reference"];
const AMOUNT_KEYS = ["amount", "amount_zar", "amount (zar)", "value", "transaction amount"];
const DEBIT_KEYS = ["debit", "debit amount", "money out"];
const CREDIT_KEYS = ["credit", "credit amount", "money in"];

/** Minimal RFC-4180 reader: handles quotes, escaped quotes and CRLF. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function findColumn(headers: string[], keys: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const key of keys) {
    const index = lower.indexOf(key);
    if (index >= 0) return headers[index];
  }
  for (const key of keys) {
    const index = lower.findIndex((h) => h.includes(key));
    if (index >= 0) return headers[index];
  }
  return null;
}

/** FNB writes dates as 2026-03-04, 04/03/2026 or 04 Mar 2026. */
export function normaliseDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const slash = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const written = value.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/);
  if (written) {
    const [, d, monthName, y] = written;
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = months.indexOf(monthName.slice(0, 3).toLowerCase());
    if (m >= 0) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${String(m + 1).padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

export function normaliseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[R\s,]/gi, "").replace(/^\((.*)\)$/, "-$1");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function applyRules(description: string, amount: number, rules: Rule[]): string {
  for (const rule of [...rules].sort((a, b) => a.priority - b.priority)) {
    try {
      if (new RegExp(rule.pattern, "i").test(description)) return rule.category;
    } catch {
      // A bad pattern should not stop an import; Settings validates new ones.
    }
  }
  return amount >= 0 ? "income_other" : "other";
}

export function parseStatement(
  text: string,
  rules: Rule[],
  internalCategories: Set<string>,
  knownCategories: Set<string>,
): ParseResult {
  const table = splitCsv(text);
  const errors: string[] = [];

  if (table.length < 2) {
    return {
      rows: [],
      errors: ["That file has no rows."],
      columns: { date: "", description: "", amount: null, debit: null, credit: null },
    };
  }

  const headers = table[0].map((h) => h.trim());
  const dateCol = findColumn(headers, DATE_KEYS);
  const descriptionCol = findColumn(headers, DESCRIPTION_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);
  const debitCol = findColumn(headers, DEBIT_KEYS);
  const creditCol = findColumn(headers, CREDIT_KEYS);
  const categoryCol = findColumn(headers, ["category"]);
  const internalCol = findColumn(headers, ["is_internal", "internal"]);

  const columns = {
    date: dateCol ?? "",
    description: descriptionCol ?? "",
    amount: amountCol,
    debit: debitCol,
    credit: creditCol,
  };

  if (!dateCol) errors.push("No date column. Expected one called Date.");
  if (!amountCol && !debitCol && !creditCol) {
    errors.push("No amount column. Expected Amount, or Debit and Credit.");
  }
  if (errors.length) return { rows: [], errors, columns };

  const index = (name: string | null) => (name ? headers.indexOf(name) : -1);
  const dateIdx = index(dateCol);
  const descIdx = index(descriptionCol);
  const amountIdx = index(amountCol);
  const debitIdx = index(debitCol);
  const creditIdx = index(creditCol);
  const categoryIdx = index(categoryCol);
  const internalIdx = index(internalCol);

  const seen = new Map<string, number>();
  const rows: ParsedRow[] = [];

  for (let i = 1; i < table.length; i += 1) {
    const cells = table[i];
    const date = normaliseDate(cells[dateIdx] ?? "");
    if (!date) {
      errors.push(`Row ${i + 1}: "${cells[dateIdx] ?? ""}" is not a date.`);
      continue;
    }

    let amount: number | null = null;
    if (amountIdx >= 0) {
      amount = normaliseAmount(cells[amountIdx] ?? "");
    } else {
      const debit = debitIdx >= 0 ? normaliseAmount(cells[debitIdx] ?? "") : null;
      const credit = creditIdx >= 0 ? normaliseAmount(cells[creditIdx] ?? "") : null;
      if (debit !== null) amount = -Math.abs(debit);
      else if (credit !== null) amount = Math.abs(credit);
    }
    if (amount === null) {
      errors.push(`Row ${i + 1}: no amount.`);
      continue;
    }

    const description = (descIdx >= 0 ? (cells[descIdx] ?? "") : "").trim();
    const fileCategory = categoryIdx >= 0 ? (cells[categoryIdx] ?? "").trim() : "";
    const fromFile = fileCategory !== "" && knownCategories.has(fileCategory);
    const category = fromFile ? fileCategory : applyRules(description, amount, rules);

    const isInternal =
      internalIdx >= 0
        ? ["true", "1", "yes"].includes((cells[internalIdx] ?? "").trim().toLowerCase())
        : internalCategories.has(category);

    const key = `${date}|${description}|${amount.toFixed(2)}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);

    rows.push({ date, description, amount_zar: amount, category, is_internal: isInternal, occurrence, fromFile });
  }

  return { rows, errors, columns };
}
