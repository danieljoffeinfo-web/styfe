-- Styfe HQ — core schema
-- Single-user app. Every table carries owner_id (defaults to auth.uid()) plus
-- created_at / updated_at. Money is numeric(12,2), always ex VAT.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- helpers --

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The owner of every row. Normally the signed-in user; when migrations or the
-- seed run through the service role (where auth.uid() is null) it resolves to
-- Dan's auth user so seeded rows land under the right owner. Returns null if
-- that user does not exist yet, in which case scripts/claim-seed.ts backfills.
create or replace function public.seed_owner()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    auth.uid(),
    (select id from auth.users where lower(email) = 'danieljoffeinfo@gmail.com' limit 1)
  );
$$;

revoke all on function public.seed_owner() from public;
grant execute on function public.seed_owner() to authenticated, service_role;

-- FNB statement months run from the 4th to the 3rd of the next month and are
-- labelled with the month they start in.
create or replace function public.statement_month(d date)
returns date
language sql
immutable
as $$
  select date_trunc('month', d - interval '3 days')::date;
$$;

-- ---------------------------------------------------------------- settings --

create table if not exists public.settings (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid unique default public.seed_owner(),
  vat_enabled         boolean not null default false,
  vat_rate            numeric(5,4) not null default 0.15,
  invoice_prefix      text not null default 'STY',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0),
  business_name       text not null default 'Styfe',
  business_details    text,
  mrr_target_zar      numeric(12,2) not null default 50000,
  spend_cap_zar       numeric(12,2) not null default 15000,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Configurable "path to R50k" segments (Settings page).
create table if not exists public.path_segments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid default public.seed_owner(),
  slug          text not null,
  label         text not null,
  target_zar    numeric(12,2) not null default 0,
  -- how "actual" is measured
  source        text not null default 'subscriptions'
                check (source in ('subscriptions', 'project_average', 'manual')),
  offering_slug text,              -- when source = subscriptions, restrict to one offering
  category      text,              -- ... or to an offering category
  target_units  integer,           -- e.g. 2 dealerships, 2 retainers
  color         text,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, slug)
);

-- -------------------------------------------------------------- categories --

create table if not exists public.categories (
  slug       text primary key,
  label      text not null,
  "group"    text not null check ("group" in ('income', 'business', 'personal', 'internal')),
  color      text,
  recurring  boolean not null default false,  -- income that repeats (retainer, salary)
  sort       integer not null default 0,
  owner_id   uuid default public.seed_owner(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.category_rules (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default public.seed_owner(),
  pattern    text not null,                    -- case-insensitive regex
  category   text not null references public.categories(slug) on update cascade,
  priority   integer not null default 100,     -- lower runs first, first match wins
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists category_rules_priority_idx on public.category_rules (priority);

-- ----------------------------------------------------------------- clients --

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid default public.seed_owner(),
  slug          text not null,
  name          text not null,
  contact_name  text,
  contact_phone text,
  contact_email text,
  relationship  text not null default 'project'
                check (relationship in ('retainer', 'project', 'employer')),
  status        text not null default 'active'
                check (status in ('active', 'paused', 'ended')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, slug)
);

-- --------------------------------------------------------------- offerings --

create table if not exists public.offerings (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid default public.seed_owner(),
  slug                   text not null,
  name                   text not null,
  kind                   text not null default 'service' check (kind in ('service', 'product')),
  category               text not null default 'Other',
  pricing_model          text not null default 'once_off'
                         check (pricing_model in ('once_off', 'monthly', 'per_unit_monthly', 'quote')),
  setup_fee_zar          numeric(12,2),
  monthly_fee_zar        numeric(12,2),
  unit_label             text,
  unit_cost_monthly_zar  numeric(12,2),
  delivery_days          integer,
  description            text,
  deliverables           jsonb not null default '[]'::jsonb,
  status                 text not null default 'active' check (status in ('active', 'archived')),
  sort                   integer not null default 0,
  color                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists public.offering_tiers (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid default public.seed_owner(),
  offering_id     uuid not null references public.offerings(id) on delete cascade,
  name            text not null,
  pricing_model   text not null default 'once_off'
                  check (pricing_model in ('once_off', 'monthly', 'per_unit_monthly', 'quote')),
  setup_fee_zar   numeric(12,2),
  monthly_fee_zar numeric(12,2),
  description     text,
  deliverables    jsonb not null default '[]'::jsonb,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists offering_tiers_offering_idx on public.offering_tiers (offering_id, sort);

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid default public.seed_owner(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  offering_id     uuid not null references public.offerings(id) on delete restrict,
  tier_id         uuid references public.offering_tiers(id) on delete set null,
  units           integer not null default 1 check (units > 0),
  monthly_fee_zar numeric(12,2) not null default 0,
  started_at      date not null default current_date,
  ended_at        date,
  status          text not null default 'active'
                  check (status in ('active', 'paused', 'cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists subscriptions_client_idx on public.subscriptions (client_id);
create index if not exists subscriptions_offering_idx on public.subscriptions (offering_id);

-- ---------------------------------------------------------------- invoices --

create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default public.seed_owner(),
  client_id  uuid not null references public.clients(id) on delete restrict,
  number     text not null,
  issued_at  date,
  due_at     date,
  paid_at    date,
  status     text not null default 'draft'
             check (status in ('draft', 'sent', 'overdue', 'paid', 'void')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, number)
);

create index if not exists invoices_client_idx on public.invoices (client_id);
create index if not exists invoices_status_idx on public.invoices (status);

create table if not exists public.invoice_lines (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid default public.seed_owner(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  offering_id    uuid references public.offerings(id) on delete set null,
  tier_id        uuid references public.offering_tiers(id) on delete set null,
  description    text not null,
  qty            numeric(12,2) not null default 1 check (qty > 0),
  unit_price_zar numeric(12,2) not null default 0,
  sort           integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, sort);

-- ------------------------------------------------------------ transactions --

create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid default public.seed_owner(),
  date            date not null,
  description     text not null default '',
  amount_zar      numeric(12,2) not null,      -- positive = in, negative = out
  category        text not null references public.categories(slug) on update cascade,
  is_internal     boolean not null default false,
  client_id       uuid references public.clients(id) on delete set null,
  invoice_id      uuid references public.invoices(id) on delete set null,
  source          text not null default 'manual',
  import_batch_id uuid,
  -- Dan's statements legitimately repeat the same (date, description, amount)
  -- several times in one day (R8 bank fees, R49.94 Uber rides). `occurrence`
  -- is the 1-based index of that repeat within its source file, so a re-import
  -- of the same CSV still collides on the unique key and stays idempotent,
  -- without collapsing genuinely distinct rows. See CLAUDE.md §Deviations.
  occurrence      integer not null default 1 check (occurrence > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, date, description, amount_zar, source, occurrence)
);

create index if not exists transactions_date_idx on public.transactions (date desc);
create index if not exists transactions_category_idx on public.transactions (category);
create index if not exists transactions_statement_month_idx
  on public.transactions (public.statement_month(date));

-- ------------------------------------------------------------------- deals --

create table if not exists public.deals (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid default public.seed_owner(),
  offering_id        uuid references public.offerings(id) on delete set null,
  tier_id            uuid references public.offering_tiers(id) on delete set null,
  client_id          uuid references public.clients(id) on delete set null,
  title              text not null,
  contact_name       text,
  contact_phone      text,
  contact_email      text,
  stage              text not null default 'lead'
                     check (stage in ('lead', 'meeting', 'proposal', 'pilot', 'won', 'lost')),
  units              integer not null default 1 check (units > 0),
  monthly_value_zar  numeric(12,2),
  once_off_value_zar numeric(12,2),
  next_step          text,
  next_step_at       date,
  won_at             date,
  lost_reason        text,
  notes              text,
  sort               integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists deals_stage_idx on public.deals (stage, sort);
create index if not exists deals_offering_idx on public.deals (offering_id);

-- ------------------------------------------------------------------- goals --

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default public.seed_owner(),
  slug        text not null,
  name        text not null,
  kind        text not null check (kind in ('savings', 'mrr', 'spend_cap')),
  target_zar  numeric(12,2) not null default 0,
  current_zar numeric(12,2) not null default 0,
  deadline    date,
  notes       text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists public.goal_entries (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default public.seed_owner(),
  goal_id    uuid not null references public.goals(id) on delete cascade,
  date       date not null default current_date,
  amount_zar numeric(12,2) not null,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goal_entries_goal_idx on public.goal_entries (goal_id, date desc);

-- -------------------------------------------------------------- week + day --

create table if not exists public.weekly_targets (
  metric     text primary key,
  owner_id   uuid default public.seed_owner(),
  label      text not null,
  target     integer not null default 0,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_scores (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default public.seed_owner(),
  week_start date not null,
  metric     text not null references public.weekly_targets(metric) on update cascade on delete cascade,
  value      integer not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, week_start, metric)
);

create table if not exists public.daily_tasks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default public.seed_owner(),
  date       date not null default current_date,
  label      text not null,
  done       boolean not null default false,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_tasks_date_idx on public.daily_tasks (date, sort);

-- ------------------------------------------------------------------ alerts --

create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default public.seed_owner(),
  severity    text not null default 'med' check (severity in ('low', 'med', 'high')),
  title       text not null,
  body        text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- triggers --

do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'path_segments', 'categories', 'category_rules', 'clients',
    'offerings', 'offering_tiers', 'subscriptions', 'invoices', 'invoice_lines',
    'transactions', 'deals', 'goals', 'goal_entries', 'weekly_targets',
    'weekly_scores', 'daily_tasks', 'alerts'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
