-- Styfe HQ — manual revenue, client billing details, and the Admin tracks.
--
-- Three changes that belong together because they all follow from the same
-- decision: the app stops deriving its numbers from an imported bank statement
-- and starts holding what Dan enters.

-- ------------------------------------------------------- manual revenue ---

-- Revenue was read out of public.transactions, which only exist because a CSV
-- was imported. With the Spend tab and its importer gone there is no path for
-- that data, so revenue becomes something entered directly.
create table if not exists public.revenue_entries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default public.seed_owner(),
  date        date not null default current_date,
  description text not null default '',
  amount_zar  numeric(12,2) not null,
  -- Drives the recurring / once-off split the chart and the Overview show.
  recurring   boolean not null default false,
  client_id   uuid references public.clients(id) on delete set null,
  offering_id uuid references public.offerings(id) on delete set null,
  invoice_id  uuid references public.invoices(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists revenue_entries_date_idx on public.revenue_entries (date desc);
create index if not exists revenue_entries_client_idx on public.revenue_entries (client_id);

-- Calendar months, not statement months: this is entered by hand, so there is
-- no bank cycle to reconcile against.
create or replace view public.v_monthly_revenue
with (security_invoker = true) as
select
  r.owner_id,
  date_trunc('month', r.date)::date                              as month,
  sum(r.amount_zar)::numeric(12,2)                               as total_zar,
  sum(r.amount_zar) filter (where r.recurring)::numeric(12,2)    as recurring_zar,
  sum(r.amount_zar) filter (where not r.recurring)::numeric(12,2) as once_off_zar
from public.revenue_entries r
group by r.owner_id, date_trunc('month', r.date);

-- v_monthly_income_calendar was added earlier today for the Overview and read
-- from transactions. Manual revenue replaces it; leaving it would give two
-- different answers to "what did I earn this month".
drop view if exists public.v_monthly_income_calendar;

-- --------------------------------------------- client colour + invoicing ---

alter table public.clients
  add column if not exists color               text,
  add column if not exists billing_email       text,
  add column if not exists billing_address     text,
  add column if not exists vat_number          text,
  add column if not exists registration_number text,
  add column if not exists payment_terms_days  integer not null default 30;

-- A starting colour per relationship so the list reads at a glance before Dan
-- has picked anything. Only fills blanks; it never overwrites a chosen colour.
update public.clients set color = case relationship
  when 'retainer' then '#1D6B4F'
  when 'employer' then '#2F5D8A'
  else '#C9A77A'
end
where color is null;

-- ------------------------------------------------------------ admin work --

-- Two tracks, deliberately one table: they are the same kind of row and the
-- Admin tab just groups them. `client` is work and requests for a client,
-- `business` is Dan's own projects.
create table if not exists public.admin_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default public.seed_owner(),
  track      text not null check (track in ('client', 'business')),
  title      text not null,
  detail     text,
  status     text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  client_id  uuid references public.clients(id) on delete set null,
  due_date   date,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_items_track_idx on public.admin_items (track, status, sort);
create index if not exists admin_items_client_idx on public.admin_items (client_id);

-- ------------------------------------------------ triggers, RLS, grants ---

do $$
declare t text;
begin
  foreach t in array array['revenue_entries', 'admin_items']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format(
      'create policy owner_select on public.%I for select to authenticated
         using (public.owns(owner_id))', t);
    execute format(
      'create policy owner_insert on public.%I for insert to authenticated
         with check (public.owns(owner_id))', t);
    execute format(
      'create policy owner_update on public.%I for update to authenticated
         using (public.owns(owner_id)) with check (public.owns(owner_id))', t);
    execute format(
      'create policy owner_delete on public.%I for delete to authenticated
         using (public.owns(owner_id))', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.v_monthly_revenue from anon;
grant select on public.v_monthly_revenue to authenticated, service_role;

-- Both new tables have to claim alongside everything else on first sign-in.
create or replace function public.claim_orphaned_rows()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare t text;
begin
  if not exists (
    select 1 from public.allowed_emails a
    where a.email = lower(coalesce(new.email, ''))
  ) then
    return new;
  end if;

  foreach t in array array[
    'settings', 'path_segments', 'categories', 'category_rules', 'clients',
    'offerings', 'offering_tiers', 'subscriptions', 'invoices', 'invoice_lines',
    'transactions', 'deals', 'deal_addons', 'revenue_entries', 'admin_items',
    'goals', 'goal_entries', 'weekly_targets', 'weekly_scores', 'daily_tasks',
    'alerts'
  ]
  loop
    execute format('update public.%I set owner_id = $1 where owner_id is null', t)
      using new.id;
  end loop;

  return new;
end;
$$;

revoke all on function public.claim_orphaned_rows() from public, anon, authenticated;
