-- Styfe HQ — recurring revenue drives MRR, client billing type, task tracks.
--
-- Three things follow from the same decision: Dan enters everything by hand, so
-- "recurring" has to mean something the app acts on rather than a label on a
-- single row.

-- ----------------------------------------------- recurring revenue streams --

-- A recurring entry is a monthly stream, not a one-month row: one entry means
-- "this much, every month, from `date` until `ended_at`". Null means it is
-- still running, which is what makes it count toward secured MRR.
alter table public.revenue_entries
  add column if not exists ended_at date;

comment on column public.revenue_entries.ended_at is
  'Recurring entries only: the month the stream stops. Null means it is still running.';

-- A recurring entry now appears in every month it covers, so a retainer entered
-- once shows up every month rather than only in the month it was typed.
create or replace view public.v_monthly_revenue
with (security_invoker = true) as
with expanded as (
  select
    r.owner_id,
    date_trunc('month', r.date)::date as month,
    r.amount_zar,
    false as recurring
  from public.revenue_entries r
  where not r.recurring

  union all

  select
    r.owner_id,
    m::date as month,
    r.amount_zar,
    true as recurring
  from public.revenue_entries r
  cross join lateral generate_series(
    date_trunc('month', r.date),
    -- Run to the end date, or to today — whichever is later than the start, so
    -- an entry dated next month still produces its own month.
    date_trunc('month', coalesce(r.ended_at, greatest(r.date, current_date))),
    interval '1 month'
  ) as m
  where r.recurring
)
select
  e.owner_id,
  e.month,
  sum(e.amount_zar)::numeric(12,2)                              as total_zar,
  sum(e.amount_zar) filter (where e.recurring)::numeric(12,2)   as recurring_zar,
  sum(e.amount_zar) filter (where not e.recurring)::numeric(12,2) as once_off_zar
from expanded e
group by e.owner_id, e.month;

-- ------------------------------------------------------------ secured MRR --

-- MRR was subscriptions only, which meant a retainer Dan typed into Revenue
-- never reached the Overview. It is both sources now: a won deal's subscription
-- and a recurring revenue entry are the same promise of money next month.
create or replace view public.v_secured_mrr
with (security_invoker = true) as
with parts as (
  select
    s.owner_id,
    (s.monthly_fee_zar * s.units)::numeric(12,2)                  as monthly_zar,
    (coalesce(o.unit_cost_monthly_zar, 0) * s.units)::numeric(12,2) as cost_zar,
    s.units                                                        as units,
    1                                                              as is_subscription
  from public.subscriptions s
  join public.offerings o on o.id = s.offering_id
  where s.status = 'active' and (s.ended_at is null or s.ended_at > current_date)

  union all

  select
    r.owner_id,
    r.amount_zar,
    0::numeric(12,2),
    0,
    0
  from public.revenue_entries r
  where r.recurring and (r.ended_at is null or r.ended_at > current_date)
)
select
  p.owner_id,
  coalesce(sum(p.monthly_zar), 0)::numeric(12,2) as mrr_zar,
  coalesce(sum(p.cost_zar), 0)::numeric(12,2)    as unit_cost_zar,
  coalesce(sum(p.is_subscription), 0)::int       as subscription_count,
  coalesce(sum(p.units), 0)::int                 as unit_count,
  coalesce(sum(1 - p.is_subscription), 0)::int   as recurring_entry_count
from parts p
group by p.owner_id;

-- ------------------------------------------------- clients: how they bill --

-- `relationship` answered "what are they to me" (project / retainer / employer).
-- Dan wants the simpler question the invoice actually turns on: does this client
-- pay once, or every month. The old column stays for history; nothing reads it.
alter table public.clients
  add column if not exists billing_type text not null default 'once_off';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_billing_type_check') then
    alter table public.clients
      add constraint clients_billing_type_check
      check (billing_type in ('once_off', 'recurring'));
  end if;
end $$;

-- A retainer and an employer both pay monthly; a project does not.
update public.clients
   set billing_type = case relationship when 'project' then 'once_off' else 'recurring' end
 where billing_type = 'once_off' and relationship <> 'project';

-- ------------------------------------------------------ tasks by track ----

-- The Admin page has a Clients side and a Business side. Without a track the
-- daily list is shared, so client reminders surfaced while Dan was looking at
-- his own projects. Existing tasks are client work, which is what they were.
alter table public.daily_tasks
  add column if not exists track text not null default 'client';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'daily_tasks_track_check') then
    alter table public.daily_tasks
      add constraint daily_tasks_track_check
      check (track in ('client', 'business'));
  end if;
end $$;

create index if not exists daily_tasks_track_idx on public.daily_tasks (track, date, sort);

-- ---------------------------------------------------------------- grants --

do $$
declare v text;
begin
  foreach v in array array['v_monthly_revenue', 'v_secured_mrr']
  loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated, service_role', v);
  end loop;
end $$;
