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
2. **Derived numbers live in SQL views**, not in components: `v_secured_mrr`,
   `v_offering_costing`,
   `v_receivables`, `v_invoices`, `v_monthly_revenue`, `v_monthly_income`,
   `v_monthly_spend`, `v_offering_stats`. If a number is typed into a
   component, that is a bug. (`v_mrr` still exists — subscriptions only — but
   nothing reads it; `v_secured_mrr` is the one the app uses.)
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
- **Dates are typed, not picked.** `DateInput` (`components/ui/date-input.tsx`)
  takes "8 oct", "8th October", "oct 8", "8/10", "08/10/2026", "today",
  "tomorrow", "next fri", "+30", or a bare "8", and posts ISO through a hidden
  field so nothing downstream changes. The native calendar is still behind the
  button. `parseLooseDate()` in `lib/parse-date.ts` is deliberately hand-rolled
  rather than a natural-language library: it reads numeric dates **day-first**
  (South African, so 8/10 is 8 October), and returns null for anything it is
  not sure of so the field says so instead of saving a wrong date. With no year
  given it uses the current one, unless that lands more than three months in
  the past — "8 Jan" typed in December means next January. `npm run check:dates`
  asserts all of that against a fixed Wednesday.
- **Settings has one save, and it is sticky.** The page is five cards long, so
  a button at the bottom reads as "it did not save" even when it did. The bar
  stays on screen and says "Unsaved changes" once anything is touched.
- **Categories and category rules are off the Settings page.** They only ever
  described imported bank transactions, which are gone, and 24 rows of slugs
  with their own per-row Save buttons sat directly beneath the one button that
  actually saves settings. The tables, queries and actions remain, so the
  importer still categorises; nothing renders them.
- **Bank details are structured, not prose.** They used to live inside
  `business_details`, a free-text blob, which could not be laid out as a
  labelled block — and a typo in an account number is the one invoice mistake
  that costs real money. Six columns on `settings`; the printed invoice renders
  the section only when there is something to render, and falls back to the
  invoice number as the payment reference.
- **An offering knows what it costs, not just what it charges.**
  `setup_fee_zar` / `monthly_fee_zar` are what the client pays;
  `cost_setup_zar` / `cost_monthly_zar` are what delivery costs Dan. Null is
  "not costed yet", which is deliberately not zero — `v_offering_costing`
  returns a null margin rather than reporting the full price as profit. A
  negative margin is shown as negative, never clamped.
- **The offering cards show costing, not activity.** Price, cost and margin
  replaced MRR / Revenue YTD / Pipeline, which all read R0 and answered nothing.
  A live client count only appears when there is one. Monthly offerings are
  judged on their monthly figures, everything else on the once-off ones.
- **Each offering carries its own PDF and covering email.** The PDF lives in a
  private `offering-pdfs` storage bucket under the owner's user id, which is
  what the storage policy keys on, and is reached through a ten-minute signed
  URL — the bucket is never public. `email_subject` and `email_html` are the
  saved default; the send sheet lets Dan edit both for one client without
  rewriting the template.
- **Email goes through Resend**, called over plain fetch in `lib/email.ts`.
  Resend only delivers to arbitrary recipients from a domain verified in its
  dashboard, so the from address is a setting (`settings.from_email`) rather
  than a constant, and a send with none set fails with that explanation rather
  than pretending to work. `RESEND_API_KEY` is a Vercel environment variable,
  never in the repo. Every send is logged to `offering_sends`, failures
  included, with Resend's own error text — "it said sent but nothing arrived"
  is the one outcome worth engineering against.
- **Email templates take five tokens**, not a template language:
  `{{client_name}}`, `{{contact_name}}`, `{{offering_name}}`, `{{price}}` and
  `{{business_name}}`. Values are HTML-escaped on the way in.
- **A recurring revenue entry is a monthly stream, not a row per month.** One
  entry means "this much, every month, from `date` until `ended_at`". Null
  `ended_at` means it is still running, which is exactly what makes it count
  toward secured MRR. `v_monthly_revenue` expands each recurring entry across
  every month it covers, so a retainer entered once shows up every month.
- **Secured MRR is both sources at once.** `v_secured_mrr` sums active
  subscriptions (from won deals) and live recurring revenue entries, because
  they are the same promise of money next month. It used to be subscriptions
  only, which meant a retainer typed into Revenue never reached the Overview.
  The MRR card on the Overview can add one without leaving the page.
- **`clients.billing_type`** (`once_off` / `recurring`) is the question the
  invoice actually turns on. `relationship` (project / retainer / employer) is
  kept for history and the colour fallback, but nothing asks for it any more.
  The seed sets `billing_type` directly, for the same reason it sets `color`.
- **Clients can be deleted, but not at the cost of the books.** The action
  refuses while invoices or subscriptions still point at the client and says
  which, rather than cascading. Revenue entries and admin items are
  `ON DELETE SET NULL`, so they survive with their history intact.
- **`daily_tasks.track`** matches `admin_items.track`. Without it the daily list
  was shared, so client reminders surfaced while Dan was looking at his own
  projects. Carry-over keys on `(track, label)` so the same wording on both
  sides survives.
- **Admin is a list with a tick, not three columns.** `status` still allows
  `doing` in the database, but nothing in the UI sets it: the columns read as
  unexplained jargon. The two tracks are told apart by colour — client work
  blue (`#2F5D8A`), Dan's own projects green (`#1D6B4F`) — carried through the
  tab, each item's rail and the reminders beneath.
- **No charts on Revenue or the Overview.** "Money in, by month" was the last
  thing carrying statement-era framing, and its empty state told Dan to import
  an FNB statement on a page that no longer exists. The stat cards answer the
  same question without it.
- **Invoices filter to Open, Sent and Paid.** Open is anything still owed, so a
  draft lives there rather than behind its own chip; Sent includes overdue.
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
- **Invoicing details also live on the client**, not on the invoice: billing email,
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
npm run check:dates          # asserts what loose date entry accepts
./scripts/verify-sql.sh      # migrations + seed + numbers on a throwaway local Postgres
npm run setup                # push + seed + check
```
