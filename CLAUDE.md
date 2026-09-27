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
   `v_receivables`, `v_invoices`, `v_monthly_income`, `v_monthly_spend`,
   `v_offering_stats`. If a number is typed into a component, that is a bug.
3. **Money maths in cents.** `toCents` on the way in, `formatZar` on the way out.
4. **Schema changes are migrations.** `supabase/migrations/`, never the
   dashboard. Views must be `security_invoker = true` and must be granted to
   `authenticated` and revoked from `anon` in the same migration that creates
   them — Supabase's default privileges hand new relations to `anon` otherwise.
5. **Prices are ex VAT everywhere.** VAT is applied once, in
   `v_invoice_totals` and in `vatOnCents`, from the global setting.
6. **Statement months, not calendar months.** See below.
7. **390px is a supported width.** Tables become cards, the sidebar becomes a
   sheet, touch targets stay at 44px.
8. No emoji, no gradient washes. Instrument Serif for titles, IBM Plex Sans for
   UI, IBM Plex Mono for every money figure.

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

FNB's cycle runs from the 4th of a month to the 3rd of the next and is labelled
with the month it starts in. Bucketing Dan's CSV by calendar month gives
Jun 43.0k / Jul 43.0k / Aug 32.2k; bucketing by statement month gives
**Jun 72.1k · Jul 43.9k · Aug 8.7k**, which is exactly what his statements say.

So: `public.statement_month(date)` in SQL and `statementMonth()` in
`lib/dates.ts` both shift the date back three days before truncating to the
month. Every income and spend view groups this way. Invoice dates and goal
deadlines are ordinary calendar dates.

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
- **The mockup's sidebar says "Chom HQ" and "Products".** The product is Styfe
  HQ and the brief's nav says "Offerings", so the app uses those. Everything
  else follows the mockup.
- **Path-to-target segments** support `subscriptions` (live MRR filtered by
  offering or category), `project_average` (trailing three statement months of
  once-off income) and `manual` (not tracked). All editable in Settings.
- **No PDF library.** The printable invoice is a print stylesheet, so
  "Save as PDF" in the browser produces the file.

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
npm run setup                # push + seed + import + check
```
