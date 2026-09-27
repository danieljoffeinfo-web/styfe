import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { ImportWizard } from "@/components/spend/import-wizard";
import { getCategories, getCategoryRules } from "@/lib/queries/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import statement · Styfe HQ" };

export default async function ImportPage() {
  const [categories, rules] = await Promise.all([getCategories(), getCategoryRules()]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/spend" className="hover:underline">
            ← Spend
          </Link>
        }
        title="Import a statement"
      />
      <ImportWizard
        categories={categories}
        rules={rules.map((r) => ({ pattern: r.pattern, category: r.category, priority: r.priority }))}
      />
    </>
  );
}
