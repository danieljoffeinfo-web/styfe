# Styfe HQ — working rules

Dan Joffe's business command centre. Single user, ZAR, Africa/Johannesburg.
Source brief: `docs/HANDOVER.md`. Approved design: `design/overview-mockup.dc.html`.

## Stack (non-negotiable)

- Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn-style primitives
  in `components/ui/` (Radix + cva + tailwind-merge, hand-written so there is no
  generator to re-run).
- Supabase: Postgres, magic-link auth, RLS on every table.
- Server components read, server actions write, **every action is zod-validated**.
- Recharts for charts.
- Money columns are `numeric(12,2)`. Never do float maths in the UI — go through
  `lib/money.ts`, which works in integer cents.
- Every table has `owner_id`, `created_at`, `updated_at`.

## Rules that are easy to break

1. **No service-role key in `app/` or `components/`.** `SUPABASE_SECRET_KEY`
   lives in `.env.local` and is read only by `scripts/`. The app talks to
   Supabase with the publishable key and Dan's session, so RLS always applies.
2. **Derived numbers live in SQL views**, not in components: `v_mrr`,
   `v_receivables`, `v_invoices`, `v_monthly_revenue`, `v_monthly_income`,
   `v_monthly_spend`, `v_offering_stats`. If a number is typed into a
   component, that is a bug.
3. **Money maths in cents.** `toCents` on the way in, `formatZar` on the way out.
4. **Schema changes are migrations.** `supabase/migrations/`, never the
   dashboard. Views must be `security_invoker = true` and must be granted to
   `authenticated` and revoked from `anon` in the same migration that creates
   them — Supabase's default privileges hand new relations to `anon` otherwise.
5. **Prices are ex VAT everywhere.** VAT is applied once, in
   `v_invoice_totals` and in `vatOnCents`, from the global setting.
6. **Statement months, not calendar months** — for anything derived from the
   bank statement. Revenue is typed in by hand and sits on calendar months.
   See below.
7. **390px is a supported width.** Tables become cards, the sidebar becomes a
   sheet, touch targets stay at 44px.
8. No emoji, no gradient washes. Inter for titles and UI, JetBrains Mono for
   every money figure. Titles use the `.display` utility (Inter 600, -0.022em
   tracking); `.money` is mono with tabular figures.

## Design tokens

Defined once as Tailwind v4 theme variables in `app/globals.css`:

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#F3F1EC` | page background |
| `card` / `line` | `#FFFFFF` / `#E2DED5` | cards, 14px radius |
| `ink` / `muted` | `#17171B` / `#5E5B55` | text |
| `green` | `#1D6B4F` | recurring money, positive |
| `sand` | `#C9A77A` | once-off income |
| `blue` | `#2F5D8A` | products / SaaS |
| `alert` / `alert-wash` | `#8A3E12` / `#FBE7DA` | warnings |

## The statement month

This still governs anything read out of `transactions`, even though the sample
data is gone. FNB's cycle runs from the 4th of a month to the 3rd of the next
and is labelled with the month it starts in. Bucketing Dan's CSV by calendar month gives
Jun 43.0k / Jul 43.0k / Aug 32.2k; bucketing by statement month gives
**Jun 72.1k · Jul 43.9k · Aug 8.7k**, which is exactly what his statements say.

So: `public.statement_month(date)` in SQL and `statementMonth()` in
`lib/dates.ts` both shift the date back three days before truncating to the
month. Every view over `transactions` groups this way. Invoice dates, goal
deadlines and **`revenue_entries`** are ordinary calendar dates — Dan types
revenue in himself, so there is no statement to reconcile against and "this
month" should mean the month on the calendar.

## Decisions taken where the brief was ambiguous

- **`transactions.occurrence`.** The brief's unique key
  `(date, description, amount_zar, source)` collapses 170 real rows (R1,873) in
  Dan's own CSV — a day has several identical R8 bank fees and repeated R49.94
  Uber rides. The key is therefore
  `(owner_id, date, description, amount_zar, source, occurrence)`, where
  `occurrence` is the 1-based index of that identical tuple within its source
  file. Re-importing the same file produces the same occurrence numbers, so
  imports stay idempotent while genuinely distinct rows survive.
- **Recurring vs once-off income** is a `recurring` flag on `categories`
  (`income_proto` and `income_ie_global` are on), editable in Settings, rather
  than hard-coded in the chart.
- **Blank descriptions are bank fees.** FNB posts 277 fee rows with an empty
  description and a few as a bare `260801`. The default rule set matches `^$`
  and `^[0-9]{6}$` to `bank_fees`. The shipped rules reproduce 98.8% of the
  categories in Dan's CSV; the rest are cases where the rule is arguably better
  than the label in the file.
- **The importer trusts the file's own `category` column** when it names a
  category that exists, and falls back to the rules otherwise. Rules are what a
  fresh FNB export (no category column) goes through.
- **Carry-over** of unticked tasks happens automatically on the first load of
  the Overview each day, through a server action; the source task is deleted as
  it moves, so it is safe to call repeatedly.
- **Reordering offerings** is drag-and-drop on a pointer plus up/down buttons,
  because HTML5 drag does not work on touch.
- **`owner_id` defaults to `public.seed_owner()`**, not bare `auth.uid()`. It
  returns `auth.uid()` when there is a session and Dan's user id when there is
  not, so migrations and seeds land under the right owner. It returns null if
  his auth user does not exist yet; `seed/seed.sql` claims those rows and
  `npm run db:claim` is the standalone repair.
- **`offerings.offering_type`** (`standard` / `custom` / `addon`) is separate from
  `kind` (service / product), because they answer different questions: kind is
  what the thing is, offering_type is how it is sold. A SaaS product is
  `standard` + `product`. The catalogue groups by `category` (the service line),
  then orders standard → custom → add-ons.
- **The v2 catalogue ships in the migration, not the seed.** Reference data
  already works this way (`20260927090300_reference_data.sql`): migrations run
  against every environment, the seed does not, and the v2 migration has to
  create the new slugs anyway so it can repoint the deals and invoice lines that
  hung off `whatsapp-ai` and `custom-bms`. Restating the rows in `seed/seed.sql`
  as well would only let the two copies drift.
- **Replaced offerings are archived, never deleted.** `subscriptions.offering_id`
  is `ON DELETE RESTRICT` and the history has to keep resolving, so
  `website-build` and `whatsapp-ai` remain as archived rows. `custom-bms` keeps
  its id and is renamed to `custom-build`. The migration ends with a check that
  raises if any deal, invoice line or subscription is left pointing at nothing.
- **`deal_addons.price_zar` null means "use the list price".** A number is a
  per-deal override. The same rule decides invoice lines and subscriptions when
  the deal is won: once-off items become one invoice with a line each, monthly
  items become one subscription each, and a custom line carries the deal's
  `scope` text so the invoice still reads correctly after the deal is edited.
- **The mockup's sidebar says "Chom HQ" and "Products".** The product is Styfe
  HQ and the brief's nav says "Offerings", so the app uses those. Everything
  else follows the mockup.
- **Path-to-target segments** support `subscriptions` (live MRR filtered by
  offering or category), `project_average` (trailing three statement months of
  once-off income) and `manual` (not tracked). All editable in Settings.
- **No PDF library.** The printable invoice is a print stylesheet, so
  "Save as PDF" in the browser produces the file.
- **Revenue is entered by hand, in `revenue_entries`.** It used to be derived
  from imported transactions. Revenue and the Overview now both read
  `v_monthly_revenue`, so the same month reads the same on both pages, and
  `revenue_entries` starts empty on purpose.
- **The imported statement was mock data and has been cleared.** All 1,469 rows
  were deleted from the live project; nothing in the app reads `transactions`
  any more. The table, `v_monthly_income`, `v_monthly_spend`, `statement_month()`
  and `npm run import:transactions` all remain, so a real FNB export can still be
  loaded, but `npm run setup` no longer imports the sample CSV and
  `npm run check` no longer asserts its figures — it checks structure instead
  (catalogue present and typed, nothing unowned, every relation readable).
  `seed/transactions_2026-03_to_2026-09.csv` is still in the repo and in its
  git history; `supabase/test/checks.sql` uses it to prove the importer and the
  statement-month maths on a throwaway Postgres.
- **Clients carry a colour.** `clients.color` is a `#RRGGBB` swatch, null until
  one is picked; `clientColor()` in `lib/clients.ts` falls back by relationship
  so a fresh row never renders grey. The seed gives each client a distinct
  swatch because migrations run before the seed, so a backfill would not reach
  rows that do not exist yet.
- **Invoicing details live on the client**, not on the invoice: billing email,
  billing address, VAT number, company registration and payment terms. The
  printable invoice prefers them and falls back to the contact details, and a
  blank due date is the issue date plus that client's payment terms rather than
  a flat 30 days.
- **Spend, Goals and Week are gone from the nav.** The tables, views, actions
  and the import script all remain, so nothing is lost and the routes can come
  back; only the unreachable pages and their components were deleted.
- **The Admin tab has two tracks**, `admin_items.track`: `client` (work,
  requests and admin that belongs to a client) and `business` (Dan's own
  projects, the ones meant to be sold). One table rather than two because they
  differ by whose work it is, not by shape. A business item cannot carry a
  client — the action nulls it rather than storing something nobody can explain
  later. Admin is also where the full daily checklist lives, at `/admin#today`;
  the Overview shows five of it.

## Not built (out of scope for v1)

Bank API sync, sending email, ads integrations, multi-user.

## Commands

```
npm run dev                  # local dev
npm run typecheck            # tsc --noEmit
npm run lint
npm run build

npm run db:link              # links the Supabase CLI to the project in .env.local
npm run db:push              # applies supabase/migrations
npm run db:seed              # creates Dan's auth user, then runs seed/seed.sql
npm run import:transactions  # loads seed/transactions_2026-03_to_2026-09.csv
npm run db:claim             # repair: gives orphaned rows to Dan
npm run check                # sanity checks against the live project — fails loudly
./scripts/verify-sql.sh      # migrations + seed + numbers on a throwaway local Postgres
npm run setup                # push + seed + check
```
