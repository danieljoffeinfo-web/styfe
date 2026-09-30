import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function Empty({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-xl bg-well text-muted">
        {icon ?? <Inbox className="size-5" strokeWidth={1.7} />}
      </div>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
