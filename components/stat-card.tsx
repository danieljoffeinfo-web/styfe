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
        "flex min-h-[132px] flex-col rounded-xl p-5",
        dark ? "bg-ink text-paper" : "border border-line bg-card",
      )}
    >
      <div className={cn("text-[12.5px] font-medium", dark ? "text-white/60" : "text-muted")}>{label}</div>
      <div className="money mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] sm:text-[30px]">
        {value}
        {suffix ? <span className="ml-1 text-sm text-muted-dark">{suffix}</span> : null}
      </div>
      {meter ? <Meter value={meter.value} tone={meter.tone ?? "green"} className="mt-4" height={5} /> : null}
      {note ? (
        <div
          className={cn(
            "mt-auto pt-3 text-xs",
            dark
              ? "text-white/60"
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
