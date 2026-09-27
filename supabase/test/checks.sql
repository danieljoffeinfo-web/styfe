-- Loads the bundled statement and asserts the derived numbers.
-- Run through scripts/verify-sql.sh, never against the real project.
\set ON_ERROR_STOP on
set client_min_messages = warning;

create table if not exists _csv_raw (
  line bigserial primary key,
  date date, description text, amount_zar numeric(12,2),
  category text, is_internal boolean, source text
);
truncate _csv_raw restart identity;
\copy _csv_raw(date, description, amount_zar, category, is_internal, source) from 'seed/transactions_2026-03_to_2026-09.csv' with (format csv, header true)

-- Mirrors scripts/import-transactions.ts.
insert into transactions (owner_id, date, description, amount_zar, category, is_internal, client_id, source, occurrence)
select
  public.seed_owner(), r.date, coalesce(r.description, ''), r.amount_zar, r.category,
  coalesce(r.is_internal, false), c.id, coalesce(r.source, 'fnb_statement_import'),
  row_number() over (
    partition by r.date, coalesce(r.description, ''), r.amount_zar, coalesce(r.source, 'fnb_statement_import')
    order by r.line
  )
from _csv_raw r
left join clients c on c.slug = case r.category
  when 'income_proto'     then 'proto-trading'
  when 'income_britos'    then 'britos'
  when 'income_ie_global' then 'ie-global'
end
on conflict (owner_id, date, description, amount_zar, source, occurrence) do nothing;

do $$
declare
  n bigint;
  v numeric;
  expected constant jsonb := jsonb_build_object(
    '2026-03', 9815.00, '2026-04', 12805.27, '2026-05', 8713.00,
    '2026-06', 72101.90, '2026-07', 43917.50, '2026-08', 8651.70
  );
  k text;
begin
  select count(*) into n from transactions;
  if n <> 1469 then
    raise exception 'Expected 1469 transactions, found %', n;
  end if;

  for k in select jsonb_object_keys(expected) loop
    select total_zar into v from v_monthly_income where to_char(month, 'YYYY-MM') = k;
    if v is null or abs(v - (expected ->> k)::numeric) > 1 then
      raise exception 'Income for % is %, expected %', k, coalesce(v, 0), expected ->> k;
    end if;
  end loop;

  select sum(total_zar) into v from v_receivables;
  if abs(coalesce(v, 0) - 33200) > 1 then
    raise exception 'Receivables are %, expected 33200', coalesce(v, 0);
  end if;

  select mrr_zar into v from v_mrr;
  if abs(coalesce(v, 0) - 8000) > 1 then
    raise exception 'MRR is %, expected 8000', coalesce(v, 0);
  end if;

  select sum(amount_zar) into v from transactions where category like 'income_%';
  if abs(coalesce(v, 0) - 156004.34) > 1 then
    raise exception 'Total earned is %, expected 156004.34', coalesce(v, 0);
  end if;

  -- Re-importing the same file must add nothing.
  insert into transactions (owner_id, date, description, amount_zar, category, is_internal, source, occurrence)
  select public.seed_owner(), r.date, coalesce(r.description, ''), r.amount_zar, r.category,
         coalesce(r.is_internal, false), coalesce(r.source, 'fnb_statement_import'),
         row_number() over (
           partition by r.date, coalesce(r.description, ''), r.amount_zar, coalesce(r.source, 'fnb_statement_import')
           order by r.line
         )
  from _csv_raw r
  on conflict (owner_id, date, description, amount_zar, source, occurrence) do nothing;

  select count(*) into n from transactions;
  if n <> 1469 then
    raise exception 'Re-import created duplicates: % rows', n;
  end if;

  raise notice 'All SQL checks passed.';
end $$;

drop table _csv_raw;
