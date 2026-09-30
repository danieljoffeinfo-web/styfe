import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminBoard } from "@/components/admin/admin-board";
import { AdminItemForm } from "@/components/admin/admin-item-form";
import { TodayChecklist } from "@/components/overview/today-checklist";
import { getAdminItems } from "@/lib/queries/admin";
import { getClients } from "@/lib/queries/clients";
import { getDailyTasks } from "@/lib/queries/misc";
import { formatDate, todayIso } from "@/lib/dates";

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

      <AdminBoard items={items} clients={clients} />

      {/* The Overview shows five of these; this is the whole list. */}
      <Card id="today">
        <CardBody>
          <CardHeader title="Today" aside={formatDate(today, "long")} />
          <TodayChecklist tasks={tasks} date={today} />
        </CardBody>
      </Card>
    </>
  );
}
