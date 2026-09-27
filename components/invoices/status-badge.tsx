import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/types";

const TONE: Record<InvoiceStatus, "neutral" | "green" | "alert" | "outline" | "dark"> = {
  draft: "neutral",
  sent: "outline",
  overdue: "alert",
  paid: "green",
  void: "neutral",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={TONE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}
