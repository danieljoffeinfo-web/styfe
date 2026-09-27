import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[14px] border border-line bg-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  aside,
  className,
  children,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      {title ? <h2 className="text-[17px] font-semibold">{title}</h2> : null}
      {children}
      {aside ? <div className="text-xs text-muted">{aside}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4 p-5 sm:p-6", className)} {...props} />;
}
