-- Styfe HQ seed data — state as at 27 Sep 2026
-- Run AFTER migrations:  npm run db:seed        (or psql -f seed/seed.sql)
-- Transactions load separately from seed/transactions_2026-03_to_2026-09.csv
-- via scripts/import-transactions.ts.
--
-- Every row is owned by public.seed_owner(), which resolves to Dan's auth user.
-- Re-running this file is safe: every insert is ON CONFLICT DO NOTHING.

do $$
begin
  if public.seed_owner() is null then
    raise exception using
      message = 'No owner for the seed data.',
      hint = 'Create the auth user danieljoffeinfo@gmail.com first (npm run db:seed does this), or run scripts/claim-seed.ts after Dan''s first login.';
  end if;
end $$;

-- Reference data from the migrations may have been inserted before Dan's auth
-- user existed, in which case owner_id is null and RLS hides it from him.
-- Claim anything orphaned before seeding on top of it.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'path_segments', 'categories', 'category_rules', 'clients',
    'offerings', 'offering_tiers', 'subscriptions', 'invoices', 'invoice_lines',
    'transactions', 'deals', 'deal_addons', 'goals', 'goal_entries',
    'weekly_targets', 'weekly_scores', 'daily_tasks', 'alerts'
  ]
  loop
    execute format('update public.%I set owner_id = public.seed_owner() where owner_id is null', t);
  end loop;
end $$;

-- CLIENTS -------------------------------------------------------------
-- Each client gets its own swatch so the list is legible on a fresh install.
-- `color` null would still render, via the relationship fallback in lib/clients.ts,
-- but then every project client would look the same.
-- billing_type is set here rather than left to the migration's backfill:
-- migrations run before the seed, so a backfill never sees these rows.
insert into clients (slug, name, contact_name, relationship, billing_type, status, color, notes) values
  ('proto-trading',   'Proto Trading',             'George',            'retainer', 'recurring', 'active', '#1D6B4F', 'Pays R8,000/month regardless of workload. Paid on/around month end.'),
  ('visit-the-cape',  'Visit the Cape',            'Tanya Price',       'project',  'once_off',  'active', '#2C6E6B', 'Tour company — site, gallery, content.'),
  ('wulf-golf-carts', 'Wulf Golf Carts',           'Rian',              'project',  'once_off',  'active', '#6B6B31', 'Retainer pitch target.'),
  ('la-familia',      'La Familia Street Culture', 'Vato Kayde',        'project',  'once_off',  'active', '#6B3F63', null),
  ('britos',          'Britos',                    'Fernando da Silva', 'project',  'once_off',  'active', '#8A3E12', 'Website + AI services. R16,900 outstanding.'),
  ('cattle-baron',    'Cattle Baron',              'Shaun',             'project',  'once_off',  'active', '#C9A77A', 'R8,300 outstanding. WhatsApp onboarding planned in 3 phases. Top retainer pitch target.'),
  ('ie-global',       'IE Global',                 null,                'employer', 'recurring', 'ended',  '#2F5D8A', 'Salary R6,500/month (pays as Patin Trading 84 T/A). Ended Sep 2026.')
on conflict (owner_id, slug) do nothing;

-- OFFERINGS -----------------------------------------------------------
-- The catalogue itself now ships in supabase/migrations/20260929090000_offerings_v2.sql,
-- the same way the spend categories ship in 20260927090300_reference_data.sql.
-- Migrations run against every environment and the seed does not, and the v2
-- migration has to create the new slugs anyway so it can repoint the deals and
-- invoice lines that used to hang off whatsapp-ai and custom-bms. Restating the
-- twelve rows here as well would only let the two copies drift.
--
-- Everything below still looks offerings up by slug, so it keeps working.

-- Which client is on which recurring offering
insert into subscriptions (client_id, offering_id, units, monthly_fee_zar, started_at, status)
select c.id, o.id, 1, 8000, date '2026-06-01', 'active'
from clients c, offerings o
where c.slug = 'proto-trading' and o.slug = 'proto-retainer'
  and c.owner_id = public.seed_owner() and o.owner_id = public.seed_owner()
  and not exists (
    select 1 from subscriptions s where s.client_id = c.id and s.offering_id = o.id
  );

-- INVOICES (open receivables) ----------------------------------------
insert into invoices (client_id, number, issued_at, due_at, status, notes)
select c.id, v.number, v.issued_at, v.due_at, v.status, v.notes
from (values
  ('britos',        'INV-LEGACY-001', null::date,        date '2026-09-30', 'overdue', 'Carried over from before Styfe HQ.'),
  ('cattle-baron',  'INV-LEGACY-002', null::date,        date '2026-09-30', 'overdue', 'Carried over from before Styfe HQ.'),
  ('proto-trading', 'INV-LEGACY-003', date '2026-09-01', date '2026-09-30', 'sent',    null)
) as v(client_slug, number, issued_at, due_at, status, notes)
join clients c on c.slug = v.client_slug and c.owner_id = public.seed_owner()
on conflict (owner_id, number) do nothing;

insert into invoice_lines (invoice_id, offering_id, description, qty, unit_price_zar, sort)
select i.id, o.id, v.description, 1, v.unit_price_zar, 1
from (values
  ('INV-LEGACY-001', null,             'Outstanding work',            16900::numeric),
  ('INV-LEGACY-002', null,             'Outstanding work',            8300::numeric),
  ('INV-LEGACY-003', 'proto-retainer', 'Retainer — September 2026',   8000::numeric)
) as v(invoice_number, offering_slug, description, unit_price_zar)
join invoices i on i.number = v.invoice_number and i.owner_id = public.seed_owner()
left join offerings o on o.slug = v.offering_slug and o.owner_id = public.seed_owner()
where not exists (
  select 1 from invoice_lines l where l.invoice_id = i.id
);

-- DEALS / PIPELINE ----------------------------------------------------
-- stages: lead | meeting | proposal | pilot | won | lost
insert into deals (offering_id, client_id, title, contact_name, stage, units, monthly_value_zar, once_off_value_zar, next_step, next_step_at, sort)
select o.id, c.id, v.title, v.contact_name, v.stage, 1, v.monthly_value_zar, null, v.next_step, v.next_step_at, v.sort
from (values
  ('moto-desk',       null,              'Mitmak Motors',                     'Uncle Bobby',       'meeting', 8000::numeric,  'Book pilot start date',        date '2026-10-02', 10),
  ('moto-desk',       null,              'Rob Gumede',                        'Rob Gumede',        'meeting', 8000::numeric,  'Pilot follow-up',              date '2026-10-02', 20),
  ('growth-retainer', 'cattle-baron',    'Cattle Baron — Growth Retainer',    'Shaun',             'lead',    7500::numeric,  'Send retainer pitch',          date '2026-09-29', 30),
  ('growth-retainer', 'wulf-golf-carts', 'Wulf Golf Carts — Growth Retainer', 'Rian',              'lead',    7500::numeric,  'Send retainer pitch',          date '2026-09-29', 40),
  ('growth-retainer', 'britos',          'Britos — Growth Retainer',          'Fernando da Silva', 'lead',    7500::numeric,  'Pitch after R16,900 is paid',  null::date,        50),
  ('growth-retainer', 'la-familia',      'La Familia — Growth Retainer',      'Vato Kayde',        'lead',    7500::numeric,  'Pitch',                        null::date,        60),
  ('chom-learn',      null,              '[School 1]',                        null,                'lead',    12000::numeric, 'Book pitch for 2027 budget',   null::date,        70),
  ('chom-learn',      null,              '[School 2]',                        null,                'lead',    12000::numeric, 'Book pitch for 2027 budget',   null::date,        80)
) as v(offering_slug, client_slug, title, contact_name, stage, monthly_value_zar, next_step, next_step_at, sort)
left join offerings o on o.slug = v.offering_slug and o.owner_id = public.seed_owner()
left join clients   c on c.slug = v.client_slug   and c.owner_id = public.seed_owner()
where not exists (
  select 1 from deals d where d.title = v.title and d.owner_id = public.seed_owner()
);

-- GOALS ---------------------------------------------------------------
insert into goals (slug, name, kind, target_zar, current_zar, deadline, notes, sort) values
  ('macbook',   'MacBook Pro — cash',          'savings',   50000, 0,    '2026-10-31', 'Buy only when R50k is in the pocket.', 10),
  ('mrr-50k',   'R50k secured monthly income', 'mrr',       50000, 8000, '2027-03-31', 'Proto 8k + 2 retainers 15k + 2 Moto Desk 16k + projects 11k.', 20),
  ('spend-cap', 'Personal spend cap',          'spend_cap', 15000, 0,    null,         'Monthly cap on personal (non-business) spend.', 30)
on conflict (owner_id, slug) do nothing;

-- WEEKLY SCORECARD TARGETS -------------------------------------------
insert into weekly_targets (metric, label, target, sort) values
  ('outreach_sent',    'Outreach sent',     15, 10),
  ('meetings_held',    'Meetings held',      3, 20),
  ('deep_work_blocks', 'Deep-work blocks',   5, 30),
  ('dealer_walkins',   'Dealer walk-ins',    2, 40)
on conflict (metric) do nothing;

-- TODAY'S ADMIN CHECKLIST --------------------------------------------
insert into daily_tasks (date, label, done, sort)
select v.date, v.label, false, v.sort
from (values
  (date '2026-09-27', 'Reminder to Fernando · R16,900',          1),
  (date '2026-09-27', 'Reminder to Shaun · R8,300',              2),
  (date '2026-09-27', 'Confirm Proto R8,000 for 30 Sep',         3),
  (date '2026-09-27', 'Sort Virgin Active debit order',          4),
  (date '2026-09-27', 'Open MacBook savings pocket',             5),
  (date '2026-09-27', 'Retainer pitch → Shaun, Rian',            6),
  (date '2026-09-27', 'Book Mitmak pilot date with Bobby',       7),
  (date '2026-09-27', 'Block next week: Moto Desk / Chom Learn', 8)
) as v(date, label, sort)
where not exists (
  select 1 from daily_tasks t
  where t.date = v.date and t.label = v.label and t.owner_id = public.seed_owner()
);

-- ALERTS --------------------------------------------------------------
insert into alerts (severity, title, body)
select 'high', 'Virgin Active debit order bounced',
       'R2,499 returned unpaid on 1 Aug and 1 Sep 2026. Pay arrears or cancel.'
where not exists (
  select 1 from alerts a
  where a.title = 'Virgin Active debit order bounced' and a.owner_id = public.seed_owner()
);
