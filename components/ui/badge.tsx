import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-[3px] text-[11px] font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "border-line bg-track text-muted",
        green: "border-green-soft bg-green-wash text-green-deep",
        sand: "border-[#F2DDB0] bg-sand-soft text-sand",
        blue: "border-[#C8DDF5] bg-[#EAF2FC] text-blue",
        alert: "border-[#F7C8C4] bg-alert-wash text-alert",
        dark: "border-ink bg-ink text-white",
        outline: "border-line bg-card text-muted",
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
