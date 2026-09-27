# Styfe HQ — Claude Code build prompt

Paste this entire file into Claude Code as your first message. Put the `seed/` and `design/` folders from this bundle in the repo root first.

---

## 0. Setup

- **Repo:** `https://github.com/danieljoffeinfo-web/styfe.git` (empty). Clone it, build on `main`, commit after every phase with clear messages, and push.
- **Supabase project URL:** `https://jhorjrhictommktoobvd.supabase.co`
- **Publishable key:** `sb_publishable_knEukXVzYy0g0RdmXZEgHQ_oh6MAthk`
- **Env files:**
  - Write both values to `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - Commit a `.env.example` with empty values.
  - `.env.local` must be in `.gitignore`.
- **Server-only secrets:** migrations and seeding need the **secret key** (`SUPABASE_SECRET_KEY`) and/or the **database password**. **Stop and ask Dan for them.** They go in `.env.local` only. Never commit them, never log them, never import them into client code.
- Use the Supabase CLI (`supabase link`, `supabase db push`) with migrations in `supabase/migrations/`. Do not hand-edit tables in the dashboard.
- Create a `CLAUDE.md` in the repo with the rules in this prompt and keep it updated.

## 1. What you're building

**Styfe HQ** is Dan Joffe's personal business command centre. Dan is a Cape Town founder: he runs an AI/dev agency, holds client retainers and builds his own SaaS products (Moto Desk, Chom Learn).

It has four jobs:

1. **Money at a glance:** secured monthly income (MRR), money owed, cash earned, spend.
2. **Sell and track:** his own catalogue of products and services, a deal pipeline and clients, so he gets from **R8k secured to R50k/month**.
3. **Bill:** invoices built from catalogue items.
4. **Discipline:** weekly scorecard, goals, daily admin checklist.

Single user (Dan). Currency ZAR, displayed as `R16,900`. Prices are stored ex VAT, with a global VAT setting (15%, toggle on/off because he may not be VAT-registered). Timezone Africa/Johannesburg. Ship a real v1, not a demo.

## 2. Stack (non-negotiable)

- Next.js (App Router, TypeScript, strict) + Tailwind + shadcn/ui, deployed on Vercel
- Supabase: Postgres, Auth (email magic link, allowlist `danieljoffeinfo@gmail.com` only), RLS on every table (`auth.uid()` = owner)
- Server components for reads, server actions for writes, zod validation on every action
- Recharts for charts
- Money columns are `numeric(12,2)`; never floats in the UI maths
- Every table has `owner_id uuid default auth.uid()`, plus `created_at` and `updated_at`

## 3. Design

`design/overview-mockup.dc.html` is the approved Overview screen. Match it exactly, and use the same system on every page:

- **Colours:**
  - Background `#F3F1EC`; white cards with a `1px #E2DED5` border and 14px radius; ink `#17171B`; muted text `#5E5B55`
  - Green `#1D6B4F`: recurring money / positive
  - Sand `#C9A77A`: once-off income
  - Blue `#2F5D8A`: products / SaaS
  - Alert: `#8A3E12` text on `#FBE7DA`
- **Fonts:** Instrument Serif for page titles and the greeting, IBM Plex Sans for UI, IBM Plex Mono for every money figure
- **Sidebar:** dark (`#17171B`), items Overview · Revenue · Invoices · Pipeline · Clients · **Offerings** · Spend · Goals · Week · Settings
- **Mobile:** fully usable at 390px. The sidebar becomes a menu sheet, cards stack and tables become cards.
- No emoji, no gradient washes. Touch targets ≥44px. Real buttons, links and labels.

## 4. Offerings: the products and services catalogue

This is the core of the app. Dan must be able to **add, edit, archive and reorder his own products and services** from the UI: a standard website build, a WhatsApp AI assistant, a custom business management system, a retainer, a SaaS product, anything new. Everything else (deals, invoices, subscriptions, revenue analytics) links back to an offering.

### Data model

```
offerings        id, slug unique, name, kind (service|product),
                 category text (free text with suggestions: Web, AI, Systems, Retainer, SaaS…),
                 pricing_model (once_off | monthly | per_unit_monthly | quote),
                 setup_fee_zar null, monthly_fee_zar null,
                 unit_label null            -- e.g. "dealership", "school", "user"
                 unit_cost_monthly_zar null -- running cost per unit, for margin
                 delivery_days int null, description text,
                 deliverables jsonb default '[]' -- ["Meta verification", "AI tuning", …]
                 status (active|archived), sort int, color text null
offering_tiers   id, offering_id fk, name, pricing_model, setup_fee_zar, monthly_fee_zar,
                 description, deliverables jsonb, sort    -- optional packages (e.g. Basic / Full API)
subscriptions    id, client_id fk, offering_id fk, tier_id null, units int default 1,
                 monthly_fee_zar, started_at, ended_at null, status (active|paused|cancelled)
```

### How pricing models behave

- **once_off:** a setup/project fee. It counts as once-off revenue when invoiced and paid.
- **monthly:** a flat monthly fee. A won deal creates a `subscription`, which counts toward MRR.
- **per_unit_monthly:** price × units (e.g. R8,000 × 3 dealerships). The subscription stores the units. The margin uses `unit_cost_monthly_zar`.
- **quote:** no list price. The deal holds the quoted amount. The UI shows "Quote" instead of a price.
- An offering can have both a setup fee and a monthly fee (e.g. setup R7,300 + R1,500/month care).

### Offerings page

- Grid of offering cards grouped by category, showing:
  - name, kind badge, price line (e.g. "R7,300 once-off", "R8,000 / dealership / month", "Quote")
  - live stats: active subscriptions/units, MRR from it, revenue this year, open deals and their pipeline value, win rate
- **New offering** button opens a sheet form with:
  - name, kind, category, pricing model (the form fields change with the model), fees, unit label, unit cost, delivery days, description
  - deliverables editor (add/remove/reorder lines)
  - optional tiers editor
  - colour
- Offering detail page: all of the above plus clients on it, its deals and invoices, and a revenue-over-time chart.
- Archive, don't delete, when an offering has history. Drag to reorder.
- **Duplicate** action to spin up a variant fast.
- **"Copy price sheet"** button: copies a clean text summary of all active offerings (name, price, deliverables), ready to paste into WhatsApp or email.

### Wired everywhere

- **New deal:** pick offering → tier → units. Values pre-fill from the offering and can be overridden.
- **New invoice line:** pick an offering/tier to pre-fill description and price. Free-text lines are allowed too.
- **Deal set to Won:**
  - Monthly/per-unit offerings: prompt to create the subscription.
  - Once-off offerings: prompt to create a draft invoice.
- **Revenue page:** breakdown by offering and by category.

## 5. Rest of the data model

```
clients         id, slug unique, name, contact_name, contact_phone, contact_email,
                relationship (retainer|project|employer), status (active|paused|ended), notes
invoices        id, client_id fk, number unique, issued_at, due_at, paid_at null,
                status (draft|sent|overdue|paid|void), notes
invoice_lines   id, invoice_id fk, offering_id null, tier_id null, description, qty, unit_price_zar
                -- invoice total = sum(qty*unit_price) (+VAT if enabled), computed in a view
transactions    id, date, description, amount_zar (+in/−out), category, is_internal bool,
                client_id null, invoice_id null, source, import_batch_id
                unique(date, description, amount_zar, source)   -- idempotent imports
categories      slug pk, label, "group" (income|business|personal|internal), color
category_rules  id, pattern (regex, case-insensitive), category fk, priority int
deals           id, offering_id fk null, tier_id null, client_id null, title, contact_name,
                stage (lead|meeting|proposal|pilot|won|lost), units int default 1,
                monthly_value_zar null, once_off_value_zar null, next_step, next_step_at,
                won_at null, lost_reason null
goals           id, slug, name, kind (savings|mrr|spend_cap), target_zar, current_zar, deadline, notes
goal_entries    id, goal_id, date, amount_zar, note
weekly_targets  metric pk, label, target int
weekly_scores   id, week_start date, metric, value int, unique(week_start, metric)
daily_tasks     id, date, label, done, sort
alerts          id, severity (low|med|high), title, body, resolved_at null
settings        singleton: vat_enabled bool default false, vat_rate numeric default 0.15,
                invoice_prefix text default 'STY', next_invoice_number int, business_name, business_details text
```

Also:
- Invoice numbers auto-increment from `settings`, formatted `STY-0001`.
- Add SQL views `v_mrr`, `v_receivables`, `v_monthly_income`, `v_offering_stats` so the numbers live in one place.

### Derived numbers (compute them, never type them in)

- **MRR** = sum of active `subscriptions.monthly_fee_zar × units`. Today it's R8,000 (Proto retainer).
- **Receivables** = invoice totals where status is not paid or void. Today R33,200.
- **Earned** = transactions where category starts with `income_`. Excludes internal, family and crypto.
- **Personal spend (month)** = negative transactions in personal-group categories, excluding internal.
- **Path to R50k:**
  - Segments are configurable in Settings. Default: Proto 8k, retainers 15k, Moto Desk 16k, projects 11k.
  - Each shows actual vs target. Actual comes from subscriptions grouped by offering/category; projects use the trailing 3-month average of once-off income.

## 6. Seed: load ALL of Dan's data

1. Migrations, then `seed/seed.sql`. It contains:
   - 7 clients
   - 7 offerings + WhatsApp AI tiers
   - Proto subscription
   - 3 open invoices (R33,200)
   - 8 deals
   - 3 goals
   - weekly targets
   - today's checklist
   - 1 alert
   Add `owner_id` handling: seed as Dan's user id. Create his auth user first, or backfill `owner_id` after his first login with a one-off script `scripts/claim-seed.ts`.
2. `scripts/import-transactions.ts` loads `seed/transactions_2026-03_to_2026-09.csv`: 1,469 FNB rows from 3 Mar to 3 Sep 2026, already categorised. It upserts on the unique key and links `income_proto` → proto-trading, `income_britos` → britos and `income_ie_global` → ie-global.
3. Seed `categories` from the distinct CSV categories:
   - Income: income_*
   - Internal: internal_transfer
   - Personal: eating_out, transport_uber, food_delivery, groceries, grooming, health_fitness, shopping, betting, travel, family, crypto, p2p_out, other
   - Business: software_tools, phone_data, bank_fees, utilities, debit_order_reversal
4. Seed `category_rules` (priority order, first match wins):
   - internal_transfer: `Payment To Investment|FNB App Transfer (To|From)|Payshap Account On-Us|Payshap Credit D Mayele Joffe|Investment Deposit`
   - income_ie_global: `Patin|Ie Global`
   - income_proto: `Magtape Credit Proto`
   - income_britos: `Britos`
   - debit_order_reversal: `Unpaid|Rm Ction|Rm Internal`
   - food_delivery: `Uber Eats|Mr D|Sixty60`
   - transport_uber: `Uber|Bolt`
   - eating_out, groceries, software_tools and the rest: derive merchant patterns from the CSV.
   - Fallback: positive → `income_other`, negative → `other`.

**Sanity checks** (a script that fails loudly):

- Income by statement month: Mar ≈ 9.8k · Apr ≈ 12.8k · May ≈ 8.7k · Jun ≈ 72.1k · Jul ≈ 43.9k · Aug ≈ 8.6k
- Total earned ≈ R155,900 (IE Global 53,018 · Proto 60,000 · unlabelled client 29,102 · Britos 7,418 · other ≈ 6,400)
- Receivables = R33,200; MRR = R8,000

## 7. Pages

1. **Overview:** as in the mockup.
   - KPI row: MRR vs 50k, receivables, earned (6 months), personal spend vs cap, MacBook fund + days left
   - Monthly income chart (recurring vs once-off), path-to-50k bar
   - Receivables table with Send reminder
   - Today checklist (tick, add, carry over unfinished tasks to tomorrow)
   - Pipeline summary by offering category
   - This-week scorecard, spend watch, client cards, open alerts
2. **Revenue:** 12-month income chart, breakdown by client, by offering and by category, recurring vs once-off.
3. **Invoices:**
   - List with filters; overdue is auto-flagged when past `due_at`
   - Create an invoice from offerings; mark paid (optionally match a transaction)
   - Printable/PDF view with business details from Settings
   - "Send reminder" opens a prefilled WhatsApp link (`https://wa.me/<phone>?text=…`) and a mailto draft. No email sending in v1.
4. **Pipeline:**
   - Kanban by stage with drag and drop, filters by offering and category
   - Deal cards show offering, value and next step, with the next-step date red when overdue
   - The Won flow is as in section 4
5. **Clients:** list + detail (subscriptions, invoices, transactions, deals, notes, contact buttons).
6. **Offerings:** section 4.
7. **Spend:**
   - Monthly category breakdown, top merchants, 6-month averages, spend-cap meter; internal transfers hidden by default
   - Transaction table with inline re-categorise; offer to create a rule from the edit
   - **CSV import:** upload an FNB CSV, preview with auto-categories, confirm; duplicates skipped
8. **Goals:** progress bars; add deposits; the MRR goal reads live MRR.
9. **Week:** +/− buttons per metric for the current week, history chart, targets editable.
10. **Settings:** VAT toggle/rate, invoice prefix/numbering, business details, path-to-50k segments, category and rule management.

## 8. Build order (commit + push after each)

1. Scaffold, Tailwind/shadcn theme tokens from section 3, fonts, layout + sidebar, auth + allowlist
2. Migrations (all tables, RLS, views)
3. Seed + import + claim script + sanity checks
4. Offerings (catalogue, forms, tiers, stats)
5. Overview
6. Invoices
7. Pipeline
8. Clients
9. Spend + CSV import + rules
10. Goals + Week
11. Revenue
12. Settings
13. Vercel deploy: set env vars, run the sanity checks against production

## 9. Definition of done

- Only Dan can log in; RLS blocks everything else, including via the publishable key
- Dan can create "Standard Website Build", set its price, add deliverables, create a deal from it, win it, and invoice it, all from the UI
- Overview matches the mockup and shows the seeded numbers
- Importing the same CSV twice creates no duplicates
- Works at 390px width
- No secrets in git (check with `git log -p | grep -i secret` before the final push)
- README covers setup, env vars, and the monthly routine (export FNB CSV → import → review categories)

**Out of scope for v1:** bank API sync, sending emails, ads integrations, multi-user.

When anything in this prompt is ambiguous, choose the simplest option that keeps the data model above intact, note it in `CLAUDE.md`, and keep going. Only stop for the secret key / DB password.
