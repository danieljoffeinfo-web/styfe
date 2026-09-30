"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  Gauge,
  Goal,
  HandCoins,
  LayoutGrid,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

const ICONS: Record<string, LucideIcon> = {
  "/": Gauge,
  "/revenue": CircleDollarSign,
  "/invoices": FileText,
  "/pipeline": BriefcaseBusiness,
  "/clients": Users,
  "/offerings": LayoutGrid,
  "/spend": HandCoins,
  "/goals": Goal,
  "/week": BadgeDollarSign,
  "/settings": Settings,
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 text-[13.5px]">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = ICONS[item.href] ?? LayoutGrid;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
              active
                ? "bg-ink font-semibold text-white"
                : "text-muted hover:bg-well hover:text-ink",
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-ink"
              />
            ) : null}
            <Icon size={17} strokeWidth={1.8} className="shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <aside className="hidden w-[228px] shrink-0 flex-col border-r border-line bg-card lg:flex">
      <div className="flex h-[72px] items-center border-b border-line px-5">
        <Link href="/" className="text-[18px] font-bold tracking-[-0.03em] text-ink">
          Styfe HQ
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-3 py-4">
        <SidebarNav />
        <div className="mt-auto border-t border-line px-2 pt-4 text-[11px] leading-relaxed text-muted">
          {footer}
        </div>
      </div>
    </aside>
  );
}
