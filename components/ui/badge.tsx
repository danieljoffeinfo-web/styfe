import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-[3px] text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-track text-muted",
        green: "bg-green-wash text-green-deep",
        sand: "bg-sand-soft text-[#6B5330]",
        blue: "bg-[#E4EBF3] text-blue",
        alert: "bg-alert-wash text-alert",
        dark: "bg-ink text-paper",
        outline: "border border-line text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
