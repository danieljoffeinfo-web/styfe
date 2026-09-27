# Styfe HQ

Dan Joffe's business command centre: what is secured, what is owed, what is
selling, and what still has to happen today.

Ten screens — Overview, Revenue, Invoices, Pipeline, Clients, Offerings, Spend,
Goals, Week, Settings — on Next.js and Supabase, for one user, in rand.

## Setup

**You need:** Node 20+, a Supabase project, and two server-only secrets from
that project (the secret key and the database password).

```bash
git clone https://github.com/danieljoffeinfo-web/styfe.git
cd styfe
npm install
cp .env.example .env.local     # then fill it in, see below
```

### Environment variables

`.env.local` is git-ignored. `.env.example` is the template.

| Variable | Where it is used | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | same page, the publishable (anon) key |
| `NEXT_PUBLIC_SITE_URL` | magic-link redirects | `http://localhost:3000` locally, the live URL on Vercel |
| `SUPABASE_SECRET_KEY` | **`scripts/` only** | Supabase → Project Settings → API keys → secret key |
| `SUPABASE_DB_URL` | **`scripts/` only** | Supabase → Project Settings → Database → connection string (URI), with your database password |

The two server-only values never reach the browser. Nothing under `app/` or
`components/` imports them, and there is no service-role client in the app —
every query the app makes runs as Dan, under row-level security.

### Database

```bash
npm run db:link              # links the Supabase CLI to the project in .env.local
npm run setup                # migrations, seed, transaction import, sanity checks
```

`npm run setup` is the four steps below in order; run them individually if one
fails.

```bash
npm run db:push              # applies supabase/migrations (schema, RLS, views, categories)
npm run db:seed              # creates the auth user, then runs seed/seed.sql
npm run import:transactions  # loads seed/transactions_2026-03_to_2026-09.csv (1,469 rows)
npm run check                # asserts the numbers match Dan's statements
```

`npm run check` fails loudly if anything is off. It asserts income per statement
month (Mar 9.8k · Apr 12.8k · May 8.7k · Jun 72.1k · Jul 43.9k · Aug 8.7k),
income per client, receivables of R33,200 and MRR of R8,000.

### Checking the SQL without Supabase

`./scripts/verify-sql.sh` spins up a throwaway local Postgres, applies every
migration, runs `seed/seed.sql` twice to prove it is idempotent, loads the
bundled statement and asserts the same numbers `npm run check` does. It needs
`postgresql` installed locally, never touches the real project, and must be run
as a normal (non-root) user. Use it before pushing a schema change.

### Auth

Sign-in is a magic link, and one address is allowed:
`danieljoffeinfo@gmail.com`. Enable the email provider in Supabase → 
Authentication → Providers, and add your site URL and `<site>/auth/callback`
under Authentication → URL Configuration.

The allowlist is enforced three times: in `middleware.ts`, in the sign-in
callback, and in every RLS policy (`public.is_allowed_user()`), so the
publishable key on its own reads nothing.

### Run it

```bash
npm run dev     # http://localhost:3000
```

## The monthly routine

1. **Export.** FNB online banking → your account → download the statement as
   CSV.
2. **Import.** Spend → Import statement → pick the file. Every row is previewed
   with the category the rules chose; change any of them before committing.
   Rows already in the database are skipped, so importing twice is safe.
3. **Review.** On Spend, work down the transaction table. Changing a category
   offers to turn it into a rule and backfill everything matching it, so the
   same merchant is right next month.
4. **Chase.** Overview → Receivables → Send reminder opens a prefilled WhatsApp
   message and an email draft.
5. **Check the numbers.** MRR, receivables and the path to the target on the
   Overview all recompute from the database. Nothing is typed in.

## How the money is worked out

Every figure comes from a SQL view, never from a component:

- **MRR** (`v_mrr`) — active subscriptions × units.
- **Receivables** (`v_receivables`) — invoice totals that are not paid or void.
  Overdue is derived from `due_at`, so an invoice flags itself.
- **Earned** (`v_monthly_income`) — income-group transactions, excluding
  internal transfers, split recurring vs once-off by a flag on the category.
- **Personal spend** (`v_monthly_spend`) — negative personal-group transactions,
  excluding internal transfers.
- **Offering stats** (`v_offering_stats`) — MRR, revenue, open deals and win
  rate per offering.

All of them group by the **FNB statement month**, which runs from the 4th to the
3rd. That is what reproduces Dan's statement totals exactly; see `CLAUDE.md`.

Prices are stored ex VAT. VAT is a global switch in Settings and is applied in
one place, so turning it on changes every invoice and nothing else.

## Deploying to Vercel

1. Import the repository.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
   `NEXT_PUBLIC_SITE_URL` (the production URL). Do **not** add the secret key —
   the running app does not use it.
3. Add the production URL and `<site>/auth/callback` to Supabase → 
   Authentication → URL Configuration.
4. Run `npm run check` locally against production to confirm the numbers:
   `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run check`.

## Layout

```
app/(app)/          the ten screens, all server components
app/login, app/auth magic-link sign-in and callback
lib/money.ts        every calculation, in integer cents
lib/dates.ts        statement months, week starts, Africa/Johannesburg today
lib/queries/        reads (server-only)
lib/actions/        writes (server actions, zod-validated)
lib/csv.ts          FNB CSV parsing for the import screen
components/ui/      shadcn-style primitives
supabase/migrations schema, RLS, views, default categories and rules
scripts/            seed, import, claim, sanity checks — the only secret-key code
seed/               Dan's starting data
design/             the approved Overview mockup
```

## Out of scope for v1

Bank API sync, sending email from the app, ads integrations, multi-user.
