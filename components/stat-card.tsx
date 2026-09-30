import { cn } from "@/lib/utils";
import { Meter } from "@/components/ui/meter";

export function StatCard({
  label,
  value,
  note,
  noteTone = "muted",
  meter,
  dark,
  suffix,
  action,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  noteTone?: "muted" | "alert" | "green";
  meter?: { value: number; tone?: "green" | "sand" | "blue" | "alert" | "ink" };
  dark?: boolean;
  suffix?: React.ReactNode;
  /** Sits at the foot of the card — for a stat you can add to from here. */
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[14px] p-[18px_20px]",
        dark ? "bg-ink text-paper" : "border border-line bg-card",
      )}
    >
      <div className={cn("text-[13px]", dark ? "text-muted-light" : "text-muted")}>{label}</div>
      <div className="money text-[26px] font-medium leading-tight sm:text-[30px]">
        {value}
        {suffix ? <span className="ml-1 text-base text-muted-dark">{suffix}</span> : null}
      </div>
      {meter ? <Meter value={meter.value} tone={meter.tone ?? "green"} /> : null}
      {note ? (
        <div
          className={cn(
            "text-xs",
            dark
              ? "text-muted-light"
              : noteTone === "alert"
                ? "text-alert"
                : noteTone === "green"
                  ? "text-green-deep"
                  : "text-muted",
          )}
        >
          {note}
        </div>
      ) : null}
      {action ? <div className="mt-0.5">{action}</div> : null}
    </div>
  );
}
