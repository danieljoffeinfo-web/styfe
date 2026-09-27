import { cn } from "@/lib/utils";

export function Empty({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-[10px] border border-dashed border-control px-4 py-6",
        className,
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="text-[13px] text-muted">{body}</p> : null}
      {action}
    </div>
  );
}
