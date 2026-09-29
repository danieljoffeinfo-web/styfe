-- Styfe HQ — Offerings v2: standard / custom / add-on catalogue.
--
-- The catalogue previously had one flat shape, which could not express the
-- three things Dan actually sells: a fixed-scope package at a list price, a
-- bespoke build priced per deal, and an extra bolted onto either. `kind`
-- (service / product) stays as it was — it answers a different question.
--
-- Catalogue rows live here rather than in seed/seed.sql for the same reason
-- categories do (see 20260927090300_reference_data.sql): migrations run against
-- every environment, the seed does not.

-- ------------------------------------------------------------- schema -----

alter table public.offerings
  add column if not exists offering_type text not null default 'standard',
  add column if not exists portfolio     jsonb not null default '[]'::jsonb,
  add column if not exists ideal_for     text,
  add column if not exists excludes      jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'offerings_offering_type_check'
  ) then
    alter table public.offerings
      add constraint offerings_offering_type_check
      check (offering_type in ('standard', 'custom', 'addon'));
  end if;
end $$;

-- The free-text brief for bespoke work. Lives on the deal, and is copied onto
-- the invoice line when the deal is won so the invoice still reads correctly
-- after the deal is edited.
alter table public.deals         add column if not exists scope text;
alter table public.invoice_lines add column if not exists scope text;

create table if not exists public.deal_addons (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid default public.seed_owner(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  offering_id   uuid not null references public.offerings(id) on delete restrict,
  tier_id       uuid references public.offering_tiers(id) on delete set null,
  qty           integer not null default 1 check (qty > 0),
  -- null means "use the add-on's list price"; a number is a per-deal override.
  price_zar     numeric(12,2),
  pricing_model text not null default 'once_off'
                check (pricing_model in ('once_off', 'monthly', 'per_unit_monthly', 'quote')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists deal_addons_deal_idx on public.deal_addons (deal_id);
create index if not exists deal_addons_offering_idx on public.deal_addons (offering_id);

drop trigger if exists set_updated_at on public.deal_addons;
create trigger set_updated_at before update on public.deal_addons
  for each row execute function public.set_updated_at();

-- Same four policies as every other owned table.
alter table public.deal_addons enable row level security;
drop policy if exists owner_select on public.deal_addons;
drop policy if exists owner_insert on public.deal_addons;
drop policy if exists owner_update on public.deal_addons;
drop policy if exists owner_delete on public.deal_addons;
create policy owner_select on public.deal_addons for select to authenticated
  using (public.owns(owner_id));
create policy owner_insert on public.deal_addons for insert to authenticated
  with check (public.owns(owner_id));
create policy owner_update on public.deal_addons for update to authenticated
  using (public.owns(owner_id)) with check (public.owns(owner_id));
create policy owner_delete on public.deal_addons for delete to authenticated
  using (public.owns(owner_id));

revoke all on public.deal_addons from anon;
grant select, insert, update, delete on public.deal_addons to authenticated;

-- deal_addons has to claim alongside everything else on first sign-in.
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
    'transactions', 'deals', 'deal_addons', 'goals', 'goal_entries',
    'weekly_targets', 'weekly_scores', 'daily_tasks', 'alerts'
  ]
  loop
    execute format('update public.%I set owner_id = $1 where owner_id is null', t)
      using new.id;
  end loop;

  return new;
end;
$$;

revoke all on function public.claim_orphaned_rows() from public, anon, authenticated;

-- ------------------------------------------- rename before the upsert -----

-- Custom Build keeps custom-bms's id, so its deals, invoice lines and history
-- all survive. The upsert below then restates its copy.
update public.offerings set slug = 'custom-build'
 where slug = 'custom-bms'
   and not exists (select 1 from public.offerings o2 where o2.slug = 'custom-build');

-- --------------------------------------------------------- the catalogue --

with v (
  slug, name, kind, category, offering_type, pricing_model,
  setup_fee_zar, monthly_fee_zar, unit_label, unit_cost_monthly_zar,
  description, deliverables, portfolio, ideal_for, excludes, color, sort
) as (
  values
  -- WEBSITES ---------------------------------------------------------------
  ('website-launch', 'Launch Website', 'service', 'Websites', 'standard', 'once_off',
    null::numeric, null::numeric, null::text, null::numeric,
    'A marketing site that gets found on Google and turns visits into enquiries.',
    '["Up to 6 pages","Mobile-first design","On-page SEO (titles, meta, schema, sitemap, Google Business link-up)","Contact form + WhatsApp button","Google Analytics","Hosting setup + domain connect","1 revision round"]'::jsonb,
    '[{"label":"Wulf Golf Carts","url":"https://www.wulfgolfcarts.co.za"}]'::jsonb,
    'Local businesses that need to be found on Google and get enquiries.',
    '[]'::jsonb, '#2F5D8A', 10),

  ('website-platform', 'Platform Website', 'service', 'Websites', 'standard', 'once_off',
    null, null, null, null,
    'Everything in Launch, plus a dashboard the client runs the site from.',
    '["Everything in Launch","Listings / catalogue managed from an admin dashboard","Booking / enquiry flows with modals","Blog","Image CDN (Cloudinary)","Admin login for the client team"]'::jsonb,
    '[{"label":"Visit the Cape","url":"https://www.visitthecape.co.za"},{"label":"Visit the Cape — admin dashboard","url":"https://admin.visitthecape.co.za"}]'::jsonb,
    'Businesses that sell or book from their site and manage content themselves.',
    '[]'::jsonb, '#2F5D8A', 20),

  ('website-signature', 'Signature Website', 'service', 'Websites', 'standard', 'once_off',
    null, null, null, null,
    'A showpiece build: custom art direction and motion, tuned to stay fast.',
    '["Custom art direction","Scroll-driven animation","Performance-tuned build"]'::jsonb,
    '[{"label":"Lando Norris","url":"https://landonorris.com"},{"label":"Jesko Jets","url":"https://jeskojets.com"}]'::jsonb,
    'Premium brands where the site is the showpiece.',
    '[]'::jsonb, '#2F5D8A', 30),

  ('website-care', 'Website Care Plan', 'service', 'Websites', 'addon', 'monthly',
    null, null, null, null,
    'Keeps a site live, current and monitored after launch.',
    '["Hosting","Updates","Uptime","Monthly SEO check","1 hr content changes"]'::jsonb,
    '[]'::jsonb, null,
    '[]'::jsonb, '#C9A77A', 40),

  -- WHATSAPP AI ------------------------------------------------------------
  ('whatsapp-assistant', 'WhatsApp AI Assistant', 'service', 'WhatsApp AI', 'standard', 'once_off',
    7300, null, null, null,
    'An AI assistant on the business WhatsApp number, trained and handed over.',
    '["Meta Business verification (3–5 days)","AI trained on the business + tested","Failsafes + human handover","Catalogue / media upload"]'::jsonb,
    '[]'::jsonb, null,
    '["Meta conversation + broadcast fees (paid by client)"]'::jsonb, '#1D6B4F', 50),

  ('whatsapp-commerce', 'WhatsApp Commerce', 'service', 'WhatsApp AI', 'standard', 'once_off',
    18500, null, null, null,
    'Selling inside WhatsApp: catalogue orders, card payments, an order dashboard.',
    '["Everything in Assistant","Customers order straight from the WhatsApp catalogue","Card payments","Order dashboard"]'::jsonb,
    '[]'::jsonb, null,
    '["Meta conversation + broadcast fees (paid by client)"]'::jsonb, '#1D6B4F', 60),

  ('whatsapp-care', 'WhatsApp AI Care', 'service', 'WhatsApp AI', 'addon', 'monthly',
    null, null, null, null,
    'Keeps the assistant accurate as the business changes.',
    '["Monitoring","Prompt / knowledge updates","Monthly report"]'::jsonb,
    '[]'::jsonb, null,
    '[]'::jsonb, '#C9A77A', 70),

  -- SYSTEMS ----------------------------------------------------------------
  ('custom-build', 'Custom Build', 'service', 'Systems', 'custom', 'quote',
    null, null, null, null,
    'Bespoke software, scoped and quoted per project.',
    '["Discovery + written scope","Build","Handover + training"]'::jsonb,
    '[]'::jsonb,
    'Anything bespoke: management systems, portals, automations, integrations.',
    '[]'::jsonb, '#2F5D8A', 80),

  -- RETAINERS --------------------------------------------------------------
  ('growth-retainer', 'Growth Retainer', 'service', 'Retainers', 'standard', 'monthly',
    null, 7500, null, null,
    'Website care, WhatsApp AI, monthly automations, monthly report.',
    '["Website care","WhatsApp AI","Monthly automations","Monthly report"]'::jsonb,
    '[]'::jsonb, null,
    '[]'::jsonb, '#1D6B4F', 90),

  ('proto-retainer', 'Proto Trading Retainer', 'service', 'Retainers', 'standard', 'monthly',
    null, 8000, null, null,
    'Ongoing systems work for Proto Trading.',
    '["Systems work","Support"]'::jsonb,
    '[]'::jsonb, null,
    '[]'::jsonb, '#1D6B4F', 100),

  -- SAAS -------------------------------------------------------------------
  ('moto-desk', 'Moto Desk', 'product', 'SaaS', 'standard', 'per_unit_monthly',
    null, 8000, 'dealership', null,
    'Cloud DMS for South African dealerships.',
    '["Stock management","Leads + deals","Reporting","Support"]'::jsonb,
    '[]'::jsonb, null,
    '[]'::jsonb, '#2F5D8A', 110),

  ('chom-learn', 'Chom Learn', 'product', 'SaaS', 'standard', 'per_unit_monthly',
    null, 12000, 'school', 6000,
    'AI learning platform for SA high schools. CONFIRM price per school.',
    '["Learner accounts","AI tutor","Teacher dashboard","Onboarding"]'::jsonb,
    '[]'::jsonb, null,
    '[]'::jsonb, '#2F5D8A', 120)
),
updated as (
  update public.offerings o set
    name                  = v.name,
    kind                  = v.kind,
    category              = v.category,
    offering_type         = v.offering_type,
    pricing_model         = v.pricing_model,
    -- A price in the table wins; a null leaves whatever Dan already set, so
    -- re-running this never wipes a price entered in the UI.
    setup_fee_zar         = coalesce(v.setup_fee_zar, o.setup_fee_zar),
    monthly_fee_zar       = coalesce(v.monthly_fee_zar, o.monthly_fee_zar),
    unit_label            = v.unit_label,
    unit_cost_monthly_zar = coalesce(v.unit_cost_monthly_zar, o.unit_cost_monthly_zar),
    description           = v.description,
    deliverables          = v.deliverables,
    portfolio             = v.portfolio,
    ideal_for             = v.ideal_for,
    excludes              = v.excludes,
    status                = 'active'
  from v
  where o.slug = v.slug
  returning o.slug
)
insert into public.offerings (
  slug, name, kind, category, offering_type, pricing_model,
  setup_fee_zar, monthly_fee_zar, unit_label, unit_cost_monthly_zar,
  description, deliverables, portfolio, ideal_for, excludes, color, sort, status
)
select
  v.slug, v.name, v.kind, v.category, v.offering_type, v.pricing_model,
  v.setup_fee_zar, v.monthly_fee_zar, v.unit_label, v.unit_cost_monthly_zar,
  v.description, v.deliverables, v.portfolio, v.ideal_for, v.excludes, v.color, v.sort, 'active'
from v
where v.slug not in (select slug from updated);

-- ------------------------------------------------- repoint and archive ----

-- whatsapp-ai's two tiers become two standalone standard offerings, so its
-- deals and invoice lines move by tier name. A row with no tier predates the
-- tiers and is the base assistant.
update public.deals d
   set offering_id = target.id,
       tier_id     = null
  from public.offerings old, public.offerings target
 where old.slug = 'whatsapp-ai'
   and target.slug = 'whatsapp-assistant'
   and d.offering_id = old.id
   and (
     d.tier_id is null
     or exists (
       select 1 from public.offering_tiers ot
       where ot.id = d.tier_id and ot.name = 'AI Assistant'
     )
   );

update public.deals d
   set offering_id = target.id,
       tier_id     = null
  from public.offerings old, public.offerings target
 where old.slug = 'whatsapp-ai'
   and target.slug = 'whatsapp-commerce'
   and d.offering_id = old.id
   and exists (
     select 1 from public.offering_tiers ot
     where ot.id = d.tier_id and ot.name = 'Full API Integration'
   );

update public.invoice_lines l
   set offering_id = target.id,
       tier_id     = null
  from public.offerings old, public.offerings target
 where old.slug = 'whatsapp-ai'
   and target.slug = 'whatsapp-assistant'
   and l.offering_id = old.id
   and (
     l.tier_id is null
     or exists (
       select 1 from public.offering_tiers ot
       where ot.id = l.tier_id and ot.name = 'AI Assistant'
     )
   );

update public.invoice_lines l
   set offering_id = target.id,
       tier_id     = null
  from public.offerings old, public.offerings target
 where old.slug = 'whatsapp-ai'
   and target.slug = 'whatsapp-commerce'
   and l.offering_id = old.id
   and exists (
     select 1 from public.offering_tiers ot
     where ot.id = l.tier_id and ot.name = 'Full API Integration'
   );

update public.subscriptions s
   set offering_id = target.id,
       tier_id     = null
  from public.offerings old, public.offerings target
 where old.slug = 'whatsapp-ai'
   and target.slug = 'whatsapp-assistant'
   and s.offering_id = old.id;

-- Slugs the v2 catalogue replaces. Archived, never deleted: subscriptions FK
-- with ON DELETE RESTRICT and the history has to keep resolving.
update public.offerings
   set status = 'archived'
 where slug in ('website-build', 'whatsapp-ai');

-- ------------------------------------------------------------- verify -----

do $$
declare
  orphan_deals int;
  orphan_lines int;
  orphan_subs  int;
begin
  select count(*) into orphan_deals
    from public.deals d
   where d.offering_id is not null
     and not exists (select 1 from public.offerings o where o.id = d.offering_id);

  select count(*) into orphan_lines
    from public.invoice_lines l
   where l.offering_id is not null
     and not exists (select 1 from public.offerings o where o.id = l.offering_id);

  select count(*) into orphan_subs
    from public.subscriptions s
   where not exists (select 1 from public.offerings o where o.id = s.offering_id);

  if orphan_deals > 0 or orphan_lines > 0 or orphan_subs > 0 then
    raise exception
      'Offerings v2 left dangling references: % deals, % invoice lines, % subscriptions',
      orphan_deals, orphan_lines, orphan_subs;
  end if;
end $$;
