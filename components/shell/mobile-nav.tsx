"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { NAV_ITEMS, isActive } from "./nav-items";
import { SidebarNav } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const current = NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Styfe HQ";

  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur lg:hidden">
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger
          aria-label="Open menu"
          className="flex size-11 items-center justify-center rounded-[10px] border border-control bg-card"
        >
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col gap-8 bg-ink px-5 py-8 text-paper focus:outline-none">
            <DialogPrimitive.Title className="serif text-3xl leading-none">
              Styfe HQ
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Main navigation
            </DialogPrimitive.Description>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <Link href="/" className="serif text-xl leading-none">
        Styfe HQ
      </Link>
      <span className="ml-auto text-[13px] text-muted">{current}</span>
    </div>
  );
}
