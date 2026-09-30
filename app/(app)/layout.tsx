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
            <div className="font-medium text-ink">Workspace</div>
            <div className="mt-1">Everything here is what you entered</div>
            <div className="mt-1">Today {formatDate(todayIso())}</div>
            <form action="/auth/sign-out" method="post" className="mt-3">
              <button type="submit" className="font-medium text-ink underline underline-offset-4 hover:text-muted">
                Sign out
              </button>
            </form>
          </>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="flex flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
