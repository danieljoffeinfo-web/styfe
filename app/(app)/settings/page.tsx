import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { SegmentEditor } from "@/components/settings/segment-editor";
import { CategoryEditor, RuleEditor } from "@/components/settings/category-editor";
import { getCategories, getCategoryRules, getPathSegments, getSettings } from "@/lib/queries/settings";
import { getOfferings } from "@/lib/queries/offerings";
import { ALLOWED_EMAILS } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Styfe HQ" };

export default async function SettingsPage() {
  const [settings, segments, categories, rules, offerings] = await Promise.all([
    getSettings(),
    getPathSegments(),
    getCategories(),
    getCategoryRules(),
    getOfferings(true),
  ]);

  return (
    <>
      <PageHeader eyebrow="How Styfe HQ behaves" title="Settings" />

      <SettingsForm settings={settings} />

      <Card>
        <CardBody>
          <CardHeader title="Path to the monthly target" aside="Shown on the Overview" />
          <SegmentEditor segments={segments} offerings={offerings} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Categories" aside={`${categories.length} in use`} />
          <CategoryEditor categories={categories} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Category rules" aside={`${rules.length} rules`} />
          <RuleEditor rules={rules} categories={categories} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Access" />
          <p className="text-[13px] text-muted">
            Only {ALLOWED_EMAILS.join(", ")} can sign in. The allowlist is enforced in the middleware, in the
            sign-in callback and again in the database — every row-level security policy checks both the owner
            and the email, so the publishable key on its own reads nothing.
          </p>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="flex min-h-11 items-center rounded-[10px] border border-control bg-card px-4 text-sm hover:bg-well"
            >
              Sign out
            </button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
