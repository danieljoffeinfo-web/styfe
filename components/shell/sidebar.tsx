"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 text-sm">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            // Every app route is server-rendered on demand, so the default
            // prefetch only fetches as far as the loading boundary. Forcing a
            // full prefetch pulls the whole RSC payload before the click, which
            // is the right trade for a single-user dashboard with ten links.
            prefetch
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-lg px-3 py-2.5 transition-colors",
              active
                ? "bg-paper font-semibold text-ink"
                : "text-sidebar-item hover:bg-white/10 hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <aside className="hidden w-[220px] shrink-0 flex-col gap-8 bg-ink px-5 py-8 text-paper lg:flex">
      <Link href="/" className="display text-3xl leading-none text-paper">
        Styfe HQ
      </Link>
      <SidebarNav />
      <div className="mt-auto text-xs leading-relaxed text-muted-dark">{footer}</div>
    </aside>
  );
}
