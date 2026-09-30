"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { NAV_ITEMS, isActive } from "./nav-items";
import { SidebarNav } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const current = NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Styfe HQ";

  return (
    <div className="sticky top-0 z-40 flex h-[60px] items-center gap-3 border-b border-line bg-card/95 px-4 backdrop-blur lg:hidden">
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger
          aria-label="Open menu"
          className="flex size-10 items-center justify-center rounded-lg border border-line bg-card text-ink"
        >
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[1px]" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-card text-ink focus:outline-none">
            <div className="flex h-[72px] items-center justify-between border-b border-line px-5">
              <DialogPrimitive.Title className="text-[18px] font-bold tracking-[-0.03em]">
                Styfe HQ
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="grid size-9 place-items-center rounded-lg hover:bg-well" aria-label="Close menu">
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
            <div className="px-3 py-4">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Link href="/" className="text-[15px] font-bold tracking-[-0.02em]">
        Styfe HQ
      </Link>
      <span className="ml-auto text-[12.5px] text-muted">{current}</span>
    </div>
  );
}
