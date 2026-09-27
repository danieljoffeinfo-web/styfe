import { cn } from "@/lib/utils";

export function Meter({
  value,
  tone = "green",
  className,
  height = 6,
}: {
  /** 0–100 */
  value: number;
  tone?: "green" | "sand" | "blue" | "alert" | "ink";
  className?: string;
  height?: number;
}) {
  const bg = {
    green: "bg-green",
    sand: "bg-sand",
    blue: "bg-blue",
    alert: "bg-alert",
    ink: "bg-ink",
  }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-track", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width]", bg)} style={{ width: `${pct}%` }} />
    </div>
  );
}
