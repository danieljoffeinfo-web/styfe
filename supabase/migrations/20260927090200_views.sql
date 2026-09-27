-- Styfe HQ — derived numbers live here, never in the UI.
-- Every view is security_invoker so the caller's RLS applies.

-- ------------------------------------------------------- invoice totals ----

create or replace view public.v_invoice_totals
with (security_invoker = true) as
select
  i.id                                                as invoice_id,
  i.owner_id,
  coalesce(sum(l.qty * l.unit_price_zar), 0)::numeric(12,2) as subtotal_zar,
  (coalesce(sum(l.qty * l.unit_price_zar), 0)
    * case when coalesce(s.vat_enabled, false) then coalesce(s.vat_rate, 0.15) else 0 end
  )::numeric(12,2)                                    as vat_zar,
  (coalesce(sum(l.qty * l.unit_price_zar), 0)
    * (1 + case when coalesce(s.vat_enabled, false) then coalesce(s.vat_rate, 0.15) else 0 end)
  )::numeric(12,2)                                    as total_zar
from public.invoices i
left join public.invoice_lines l on l.invoice_id = i.id
left join public.settings s on s.owner_id = i.owner_id
group by i.id, i.owner_id, s.vat_enabled, s.vat_rate;

-- An invoice is overdue the moment it is past due and still unpaid, whatever
-- the stored status says.
create or replace view public.v_invoices
with (security_invoker = true) as
select
  i.*,
  c.name  as client_name,
  c.slug  as client_slug,
  c.contact_name,
  c.contact_phone,
  c.contact_email,
  t.subtotal_zar,
  t.vat_zar,
  t.total_zar,
  case
    when i.status in ('paid', 'void', 'draft') then i.status
    when i.due_at is not null and i.due_at < current_date then 'overdue'
    else i.status
  end as effective_status
from public.invoices i
join public.clients c on c.id = i.client_id
join public.v_invoice_totals t on t.invoice_id = i.id;

-- ------------------------------------------------------------------ MRR ----

create or replace view public.v_mrr
with (security_invoker = true) as
select
  s.owner_id,
  coalesce(sum(s.monthly_fee_zar * s.units), 0)::numeric(12,2) as mrr_zar,
  coalesce(sum(o.unit_cost_monthly_zar * s.units), 0)::numeric(12,2) as unit_cost_zar,
  count(*)::int                                                as subscription_count,
  coalesce(sum(s.units), 0)::int                               as unit_count
from public.subscriptions s
join public.offerings o on o.id = s.offering_id
where s.status = 'active' and (s.ended_at is null or s.ended_at > current_date)
group by s.owner_id;

-- ---------------------------------------------------------- receivables ----

create or replace view public.v_receivables
with (security_invoker = true) as
select
  v.*,
  case
    when v.due_at is not null and v.due_at < current_date then (current_date - v.due_at)
    else null
  end as days_overdue
from public.v_invoices v
where v.status not in ('paid', 'void');

-- -------------------------------------------------------- monthly income ---

-- Grouped by FNB statement month (4th to the 3rd), split recurring vs once-off
-- using categories.recurring.
create or replace view public.v_monthly_income
with (security_invoker = true) as
select
  t.owner_id,
  public.statement_month(t.date)                                          as month,
  sum(t.amount_zar)::numeric(12,2)                                        as total_zar,
  sum(t.amount_zar) filter (where c.recurring)::numeric(12,2)             as recurring_zar,
  sum(t.amount_zar) filter (where not c.recurring)::numeric(12,2)         as once_off_zar
from public.transactions t
join public.categories c on c.slug = t.category
where c."group" = 'income' and not t.is_internal
group by t.owner_id, public.statement_month(t.date);

-- --------------------------------------------------------- monthly spend ---

create or replace view public.v_monthly_spend
with (security_invoker = true) as
select
  t.owner_id,
  public.statement_month(t.date)          as month,
  c."group"                               as category_group,
  t.category,
  sum(-t.amount_zar)::numeric(12,2)       as spend_zar,
  count(*)::int                           as tx_count
from public.transactions t
join public.categories c on c.slug = t.category
where t.amount_zar < 0 and not t.is_internal
group by t.owner_id, public.statement_month(t.date), c."group", t.category;

-- -------------------------------------------------------- offering stats ---

create or replace view public.v_offering_stats
with (security_invoker = true) as
with subs as (
  select
    s.offering_id,
    count(*) filter (where s.status = 'active')::int                         as active_subscriptions,
    coalesce(sum(s.units) filter (where s.status = 'active'), 0)::int        as active_units,
    coalesce(sum(s.monthly_fee_zar * s.units) filter (where s.status = 'active'), 0)::numeric(12,2) as mrr_zar
  from public.subscriptions s
  group by s.offering_id
),
deal_stats as (
  select
    d.offering_id,
    count(*) filter (where d.stage not in ('won', 'lost'))::int              as open_deals,
    -- Twelve months of the recurring value plus the once-off, so a retainer
    -- and a project can be compared on one number.
    coalesce(sum(
      coalesce(d.monthly_value_zar, 0) * d.units * 12 + coalesce(d.once_off_value_zar, 0)
    ) filter (where d.stage not in ('won', 'lost')), 0)::numeric(12,2)       as pipeline_value_zar,
    count(*) filter (where d.stage = 'won')::int                             as won_deals,
    count(*) filter (where d.stage = 'lost')::int                            as lost_deals
  from public.deals d
  group by d.offering_id
),
invoiced as (
  select
    l.offering_id,
    coalesce(sum(l.qty * l.unit_price_zar), 0)::numeric(12,2)                as invoiced_zar,
    coalesce(sum(l.qty * l.unit_price_zar) filter (
      where i.status = 'paid'
        and i.paid_at >= date_trunc('year', current_date)::date
    ), 0)::numeric(12,2)                                                     as revenue_ytd_zar
  from public.invoice_lines l
  join public.invoices i on i.id = l.invoice_id
  where l.offering_id is not null
  group by l.offering_id
)
select
  o.id                                            as offering_id,
  o.owner_id,
  o.slug,
  o.name,
  o.category,
  coalesce(s.active_subscriptions, 0)             as active_subscriptions,
  coalesce(s.active_units, 0)                     as active_units,
  coalesce(s.mrr_zar, 0)::numeric(12,2)           as mrr_zar,
  coalesce(d.open_deals, 0)                       as open_deals,
  coalesce(d.pipeline_value_zar, 0)::numeric(12,2) as pipeline_value_zar,
  coalesce(d.won_deals, 0)                        as won_deals,
  coalesce(d.lost_deals, 0)                       as lost_deals,
  case
    when coalesce(d.won_deals, 0) + coalesce(d.lost_deals, 0) = 0 then null
    else round(
      coalesce(d.won_deals, 0)::numeric
      / (coalesce(d.won_deals, 0) + coalesce(d.lost_deals, 0)) * 100
    )::int
  end                                             as win_rate_pct,
  coalesce(inv.invoiced_zar, 0)::numeric(12,2)    as invoiced_zar,
  coalesce(inv.revenue_ytd_zar, 0)::numeric(12,2) as revenue_ytd_zar
from public.offerings o
left join subs s on s.offering_id = o.id
left join deal_stats d on d.offering_id = o.id
left join invoiced inv on inv.offering_id = o.id;

-- ------------------------------------------------------------- functions ---

-- Reserve the next invoice number atomically.
create or replace function public.next_invoice_number()
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_n      integer;
begin
  update public.settings
     set next_invoice_number = next_invoice_number + 1
   where owner_id = auth.uid()
  returning invoice_prefix, next_invoice_number - 1 into v_prefix, v_n;

  if v_prefix is null then
    raise exception 'No settings row for the current user';
  end if;

  return v_prefix || '-' || lpad(v_n::text, 4, '0');
end;
$$;

grant execute on function public.next_invoice_number() to authenticated;

-- First matching rule wins; falls back on the sign of the amount.
create or replace function public.categorise(p_description text, p_amount numeric)
returns text
language plpgsql
stable
as $$
declare
  v_category text;
begin
  select r.category into v_category
    from public.category_rules r
   where coalesce(p_description, '') ~* r.pattern
   order by r.priority asc, r.created_at asc
   limit 1;

  if v_category is not null then
    return v_category;
  end if;

  return case when p_amount >= 0 then 'income_other' else 'other' end;
end;
$$;

grant execute on function public.categorise(text, numeric) to authenticated, service_role;

-- ------------------------------------------------------------- grants -----
-- Supabase's default privileges grant new relations to `anon` as well, so each
-- view has to be locked down explicitly. RLS on the underlying tables does the
-- real work (every view is security_invoker), but anon should not even have the
-- grant. This has to live here rather than in the RLS migration, which runs
-- before these views exist.
do $$
declare v text;
begin
  foreach v in array array[
    'v_invoice_totals', 'v_invoices', 'v_mrr', 'v_receivables',
    'v_monthly_income', 'v_monthly_spend', 'v_offering_stats'
  ]
  loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated, service_role', v);
  end loop;
end $$;
