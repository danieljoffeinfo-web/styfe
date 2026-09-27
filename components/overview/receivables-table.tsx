import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { ReminderButton } from "@/components/invoices/reminder-button";
import { formatDateCompact } from "@/lib/dates";
import type { ReceivableView } from "@/lib/types";
import type { ResolvedSettings } from "@/lib/queries/settings";

export function ReceivablesTable({
  rows,
  settings,
}: {
  rows: ReceivableView[];
  settings: ResolvedSettings;
}) {
  if (rows.length === 0) {
    return <p className="py-2 text-[13px] text-muted">Nothing outstanding. Everything is paid.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden text-sm sm:block">
        <div className="grid grid-cols-[2fr_1.3fr_1fr_1fr_1.2fr] border-b border-line pb-2 text-xs text-muted">
          <div>Client</div>
          <div>Contact</div>
          <div className="text-right">Amount</div>
          <div className="pl-4">Status</div>
          <div className="text-right">Action</div>
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[2fr_1.3fr_1fr_1fr_1.2fr] items-center border-b border-line-soft py-2 last:border-b-0"
          >
            <div className="font-medium">
              <Link href={`/invoices/${row.id}`} className="hover:underline">
                {row.client_name}
              </Link>
            </div>
            <div className="text-muted">{row.contact_name ?? "—"}</div>
            <div className="money text-right">
              <Money value={row.total_zar} symbol={false} />
            </div>
            <div className="pl-4">
              <StatusBadge row={row} />
            </div>
            <div className="flex justify-end">
              <ReminderButton invoice={row} settings={settings} />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-[10px] border border-line p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/invoices/${row.id}`} className="font-medium hover:underline">
                  {row.client_name}
                </Link>
                <p className="text-[13px] text-muted">{row.contact_name ?? "—"}</p>
              </div>
              <Money value={row.total_zar} className="text-[15px]" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <StatusBadge row={row} />
              <ReminderButton invoice={row} settings={settings} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StatusBadge({ row }: { row: ReceivableView }) {
  if (row.effective_status === "overdue") {
    return <Badge tone="alert">Chase</Badge>;
  }
  if (row.effective_status === "draft") {
    return <Badge tone="neutral">Draft</Badge>;
  }
  return <Badge tone="green">Due {formatDateCompact(row.due_at)}</Badge>;
}
