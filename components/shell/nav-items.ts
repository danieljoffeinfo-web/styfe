export const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/revenue", label: "Revenue" },
  { href: "/invoices", label: "Invoices" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/clients", label: "Clients" },
  { href: "/offerings", label: "Offerings" },
  { href: "/admin", label: "Admin" },
  { href: "/settings", label: "Settings" },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
