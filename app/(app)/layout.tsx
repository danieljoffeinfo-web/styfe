import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { formatDate } from "@/lib/dates";
import { todayIso } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-dvh bg-paper">
      <Sidebar
        footer={
          <>
            Data: FNB CSV import, invoices, pipeline.
            <br />
            Today {formatDate(todayIso())}
            <form action="/auth/sign-out" method="post" className="mt-3">
              <button type="submit" className="text-sidebar-item underline underline-offset-4 hover:text-paper">
                Sign out
              </button>
            </form>
          </>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:gap-6 lg:px-10 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
