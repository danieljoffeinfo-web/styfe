"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { MoneyCents } from "@/components/money";
import { commitImport } from "@/lib/actions/transactions";
import { parseStatement, type ParsedRow, type Rule } from "@/lib/csv";
import { toCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Category } from "@/lib/types";

export function ImportWizard({ categories, rules }: { categories: Category[]; rules: Rule[] }) {
  const toast = useToast();
  const router = useRouter();
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();

  const known = React.useMemo(() => new Set(categories.map((c) => c.slug)), [categories]);
  const internal = React.useMemo(
    () => new Set(categories.filter((c) => c.group === "internal").map((c) => c.slug)),
    [categories],
  );
  const labelFor = React.useMemo(
    () => new Map(categories.map((c) => [c.slug, c.label])),
    [categories],
  );

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = parseStatement(text, rules, internal, known);
    setFileName(file.name);
    setRows(result.rows);
    setErrors(result.errors);
    if (result.rows.length === 0 && result.errors.length === 0) {
      setErrors(["Nothing readable in that file."]);
    }
  }

  function setCategory(index: number, category: string) {
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, category, is_internal: internal.has(category) } : row,
      ),
    );
  }

  function commit() {
    startTransition(async () => {
      const result = await commitImport(
        rows.map(({ date, description, amount_zar, category, is_internal, occurrence }) => ({
          date,
          description,
          amount_zar,
          category,
          is_internal,
          occurrence,
        })),
        "fnb_statement_import",
      );
      if (result.ok) {
        toast(result.message ?? "Imported.");
        router.push("/spend");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  }

  const inCents = rows.filter((r) => r.amount_zar > 0).reduce((acc, r) => acc + toCents(r.amount_zar), 0);
  const outCents = rows.filter((r) => r.amount_zar < 0).reduce((acc, r) => acc - toCents(r.amount_zar), 0);
  const guessed = rows.filter((r) => !r.fromFile).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <CardHeader title="1 · Pick the file" aside="CSV exported from FNB online banking" />
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-control px-4 py-8 text-center hover:bg-well">
            <Upload className="size-5 text-muted" />
            <span className="text-sm font-medium">{fileName ?? "Choose a CSV"}</span>
            <span className="text-[13px] text-muted">
              Date, description and amount columns — Debit and Credit columns work too.
            </span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>

          {errors.length ? (
            <div className="rounded-[10px] bg-alert-wash px-3.5 py-3 text-[13px] text-alert">
              <p className="font-medium">{errors.length} row{errors.length === 1 ? "" : "s"} could not be read:</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {errors.slice(0, 8).map((error) => (
                  <li key={error}>{error}</li>
                ))}
                {errors.length > 8 ? <li>…and {errors.length - 8} more.</li> : null}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {rows.length > 0 ? (
        <>
          <Card>
            <CardBody>
              <CardHeader title="2 · Check the categories" aside={`${rows.length} rows`} />
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span>
                  In <MoneyCents cents={inCents} className="font-medium" />
                </span>
                <span>
                  Out <MoneyCents cents={outCents} className="font-medium" />
                </span>
                <span className="text-muted">{guessed} categorised by rule</span>
              </div>

              <div className="max-h-[520px] overflow-y-auto rounded-[10px] border border-line">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-well">
                    <tr className="text-left text-xs text-muted">
                      <th className="px-3 py-2 font-normal">Date</th>
                      <th className="px-3 py-2 font-normal">Description</th>
                      <th className="px-3 py-2 text-right font-normal">Amount</th>
                      <th className="px-3 py-2 font-normal">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.date}-${index}`} className="border-t border-line-soft">
                        <td className="whitespace-nowrap px-3 py-1.5 text-muted">{formatDate(row.date)}</td>
                        <td className="max-w-[240px] truncate px-3 py-1.5">{row.description || "—"}</td>
                        <td className="money whitespace-nowrap px-3 py-1.5 text-right">
                          <MoneyCents cents={toCents(row.amount_zar)} withCents />
                        </td>
                        <td className="px-3 py-1.5">
                          <Select
                            aria-label={`Category for ${row.description || "row"}`}
                            value={row.category}
                            onChange={(e) => setCategory(index, e.target.value)}
                            className="h-9 text-xs"
                          >
                            {categories.map((category) => (
                              <option key={category.slug} value={category.slug}>
                                {labelFor.get(category.slug) ?? category.slug}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardHeader title="3 · Import" aside="Rows already in the database are skipped" />
              <Button variant="primary" disabled={pending} onClick={commit} className="self-start">
                {pending ? "Importing…" : `Import ${rows.length} rows`}
              </Button>
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
