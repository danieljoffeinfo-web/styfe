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
    'transactions', 'deals', 'goals', 'goal_entries', 'weekly_targets',
    'weekly_scores', 'daily_tasks', 'alerts'
  ]
  loop
    execute format('update public.%I set owner_id = public.seed_owner() where owner_id is null', t);
  end loop;
end $$;

-- CLIENTS -------------------------------------------------------------
insert into clients (slug, name, contact_name, relationship, status, notes) values
  ('proto-trading',   'Proto Trading',             'George',            'retainer', 'active', 'Pays R8,000/month regardless of workload. Paid on/around month end.'),
  ('visit-the-cape',  'Visit the Cape',            'Tanya Price',       'project',  'active', 'Tour company — site, gallery, content.'),
  ('wulf-golf-carts', 'Wulf Golf Carts',           'Rian',              'project',  'active', 'Retainer pitch target.'),
  ('la-familia',      'La Familia Street Culture', 'Vato Kayde',        'project',  'active', null),
  ('britos',          'Britos',                    'Fernando da Silva', 'project',  'active', 'Website + AI services. R16,900 outstanding.'),
  ('cattle-baron',    'Cattle Baron',              'Shaun',             'project',  'active', 'R8,300 outstanding. WhatsApp onboarding planned in 3 phases. Top retainer pitch target.'),
  ('ie-global',       'IE Global',                 null,                'employer', 'ended',  'Salary R6,500/month (pays as Patin Trading 84 T/A). Ended Sep 2026.')
on conflict (owner_id, slug) do nothing;

-- OFFERINGS (products & services catalogue — fully editable in the UI) --
-- pricing_model: once_off | monthly | per_unit_monthly | quote
-- price fields are ex VAT; null = not set yet (UI shows "Set price")
insert into offerings (slug, name, kind, category, pricing_model, setup_fee_zar, monthly_fee_zar, unit_label, unit_cost_monthly_zar, delivery_days, description, deliverables, color, status, sort) values
  ('website-build',     'Standard Website Build',            'service', 'Web',      'once_off',         null,  null,  null,         null, 14,
     'Marketing website: design, build, deploy, basic SEO.',
     '["Design", "Build", "Deploy", "Basic SEO"]'::jsonb, '#2F5D8A', 'active', 10),
  ('whatsapp-ai',       'WhatsApp AI Assistant',             'service', 'AI',       'once_off',         7300,  null,  null,         null, 7,
     'Meta Business verification (3–5 days), AI model tuning + testing, failsafes + human handover, catalogue/media upload. Client pays Meta + broadcast fees.',
     '["Meta Business verification (3–5 days)", "AI model tuning + testing", "Failsafes + human handover", "Catalogue / media upload"]'::jsonb, '#1D6B4F', 'active', 20),
  ('custom-bms',        'Custom Business Management System', 'service', 'Systems',  'quote',            null,  null,  null,         null, 30,
     'Bespoke back-office: dashboards, workflows, integrations, admin.',
     '["Discovery + spec", "Dashboards", "Workflows", "Integrations", "Admin + handover"]'::jsonb, '#2F5D8A', 'active', 30),
  ('growth-retainer',   'Growth Retainer',                   'service', 'Retainer', 'monthly',          null,  7500,  null,         null, null,
     'Website care, WhatsApp AI, monthly automations, monthly report.',
     '["Website care", "WhatsApp AI", "Monthly automations", "Monthly report"]'::jsonb, '#1D6B4F', 'active', 40),
  ('proto-retainer',    'Proto Trading Retainer',            'service', 'Retainer', 'monthly',          null,  8000,  null,         null, null,
     'Ongoing systems work for Proto Trading.',
     '["Systems work", "Support"]'::jsonb, '#1D6B4F', 'active', 45),
  ('moto-desk',         'Moto Desk',                         'product', 'SaaS',     'per_unit_monthly', null,  8000,  'dealership', null, null,
     'Cloud DMS for South African dealerships.',
     '["Stock management", "Leads + deals", "Reporting", "Support"]'::jsonb, '#2F5D8A', 'active', 50),
  ('chom-learn',        'Chom Learn',                        'product', 'SaaS',     'per_unit_monthly', null,  12000, 'school',     6000, null,
     'AI learning platform for SA high schools. CONFIRM price per school.',
     '["Learner accounts", "AI tutor", "Teacher dashboard", "Onboarding"]'::jsonb, '#2F5D8A', 'active', 60)
on conflict (owner_id, slug) do nothing;

-- Tiers / packages for offerings that have them
insert into offering_tiers (offering_id, name, pricing_model, setup_fee_zar, monthly_fee_zar, description, deliverables, sort)
select o.id, v.name, v.pricing_model, v.setup_fee_zar, null, v.description, v.deliverables, v.sort
from (values
  ('AI Assistant',         'once_off', 7300::numeric,  'Assistant setup as above.',
     '["Meta Business verification", "AI model tuning + testing", "Failsafes + human handover", "Catalogue / media upload"]'::jsonb, 1),
  ('Full API Integration', 'once_off', 18500::numeric, 'Full ordering on WhatsApp, card payments, order dashboard.',
     '["Everything in AI Assistant", "Ordering on WhatsApp", "Card payments", "Order dashboard"]'::jsonb, 2)
) as v(name, pricing_model, setup_fee_zar, description, deliverables, sort)
cross join (select id from offerings where slug = 'whatsapp-ai' and owner_id = public.seed_owner()) o
where not exists (
  select 1 from offering_tiers t
  where t.offering_id = o.id and t.name = v.name
);

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
