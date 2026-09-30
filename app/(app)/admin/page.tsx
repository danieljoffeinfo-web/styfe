import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { AdminBoard } from "@/components/admin/admin-board";
import { AdminItemForm } from "@/components/admin/admin-item-form";
import { getAdminItems } from "@/lib/queries/admin";
import { getClients } from "@/lib/queries/clients";
import { getDailyTasks } from "@/lib/queries/misc";
import { todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Styfe HQ" };

export default async function AdminPage() {
  const today = todayIso();
  const [items, clients, tasks] = await Promise.all([
    getAdminItems(),
    getClients(),
    getDailyTasks(today),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Everything you owe someone, including yourself"
        title="Admin"
        actions={
          <AdminItemForm clients={clients} trigger={<Button variant="primary">New item</Button>} />
        }
      />

      {/* Reminders live inside each track, so the Business side never shows
          client work. The Overview's five-task card links in here. */}
      <AdminBoard items={items} clients={clients} tasks={tasks} date={today} />
    </>
  );
}
