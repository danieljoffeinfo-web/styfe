-- Styfe HQ — calendar-month income, for the Overview.
--
-- v_monthly_income groups by public.statement_month(), which is right for the
-- Revenue and Spend pages: those numbers have to reconcile against what FNB
-- prints on a statement. The Overview is a different question — "how am I doing
-- this month" — and there a figure that starts on the 4th is just confusing.
-- So the dashboard reads calendar months and everything else keeps the
-- statement month.
--
-- Same shape as v_monthly_income so the chart component takes either.

create or replace view public.v_monthly_income_calendar
with (security_invoker = true) as
select
  t.owner_id,
  date_trunc('month', t.date)::date                                as month,
  sum(t.amount_zar)::numeric(12,2)                                 as total_zar,
  sum(t.amount_zar) filter (where c.recurring)::numeric(12,2)      as recurring_zar,
  sum(t.amount_zar) filter (where not c.recurring)::numeric(12,2)  as once_off_zar
from public.transactions t
join public.categories c on c.slug = t.category
where c."group" = 'income' and not t.is_internal
group by t.owner_id, date_trunc('month', t.date);

-- Supabase's default privileges hand new relations to anon, so every view has
-- to be locked down in the migration that creates it (CLAUDE.md rule 4).
revoke all on public.v_monthly_income_calendar from anon;
grant select on public.v_monthly_income_calendar to authenticated, service_role;
