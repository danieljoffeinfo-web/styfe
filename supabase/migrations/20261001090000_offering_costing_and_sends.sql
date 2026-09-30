-- Styfe HQ — what an offering costs Dan, and sending it to a client.
--
-- The catalogue could say what a client pays but not what the work costs to
-- deliver, so nothing on the page answered "is this worth selling". It also
-- had nowhere to keep the PDF and the covering email that actually go out.

-- ------------------------------------------------------------- costing ----

-- Mirrors the price columns: setup_fee_zar / monthly_fee_zar are what the
-- client pays, these are what it costs Dan to deliver. Null means not worked
-- out yet, which is different from zero (free to deliver).
alter table public.offerings
  add column if not exists cost_setup_zar   numeric(12,2),
  add column if not exists cost_monthly_zar numeric(12,2),
  add column if not exists cost_notes       text;

comment on column public.offerings.cost_setup_zar is
  'What the once-off work costs Dan to deliver. Null means not costed yet.';
comment on column public.offerings.cost_monthly_zar is
  'What one month of delivery costs Dan. Null means not costed yet.';

-- ------------------------------------------------- the PDF and the email --

alter table public.offerings
  add column if not exists pdf_path      text,
  add column if not exists pdf_name      text,
  add column if not exists email_subject text,
  add column if not exists email_html    text;

comment on column public.offerings.pdf_path is
  'Object path inside the private offering-pdfs storage bucket.';

-- ------------------------------------------------------ margin, in SQL ----

-- Derived numbers belong in a view, not in a component (CLAUDE.md rule 2).
-- Margin is null rather than zero when the cost has not been entered, so an
-- uncosted offering reads as "unknown" instead of "100% margin".
create or replace view public.v_offering_costing
with (security_invoker = true) as
select
  o.id   as offering_id,
  o.owner_id,
  o.setup_fee_zar                                as price_setup_zar,
  o.monthly_fee_zar                              as price_monthly_zar,
  o.cost_setup_zar,
  o.cost_monthly_zar,
  case when o.cost_setup_zar is not null
       then (coalesce(o.setup_fee_zar, 0) - o.cost_setup_zar)::numeric(12,2)
  end as margin_setup_zar,
  case when o.cost_monthly_zar is not null
       then (coalesce(o.monthly_fee_zar, 0) - o.cost_monthly_zar)::numeric(12,2)
  end as margin_monthly_zar,
  case when o.cost_setup_zar is not null and coalesce(o.setup_fee_zar, 0) > 0
       then round((coalesce(o.setup_fee_zar, 0) - o.cost_setup_zar)
                  / o.setup_fee_zar * 100)::int
  end as margin_setup_pct,
  case when o.cost_monthly_zar is not null and coalesce(o.monthly_fee_zar, 0) > 0
       then round((coalesce(o.monthly_fee_zar, 0) - o.cost_monthly_zar)
                  / o.monthly_fee_zar * 100)::int
  end as margin_monthly_pct
from public.offerings o;

-- ---------------------------------------------------------- send log -----

-- Every send is recorded, successes and failures alike, so "did I actually
-- send Britos the WhatsApp pack" has an answer.
create table if not exists public.offering_sends (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default public.seed_owner(),
  offering_id uuid not null references public.offerings(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  to_email    text not null,
  subject     text not null,
  status      text not null default 'sent' check (status in ('sent', 'failed')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists offering_sends_offering_idx
  on public.offering_sends (offering_id, created_at desc);
create index if not exists offering_sends_client_idx
  on public.offering_sends (client_id);

-- ----------------------------------------------------- sending identity --

-- Resend will only deliver to arbitrary recipients from a verified domain, so
-- the from address is a setting Dan fills in once rather than a constant.
alter table public.settings
  add column if not exists from_name  text,
  add column if not exists from_email text,
  add column if not exists reply_to   text;

-- ------------------------------------------------ triggers, RLS, grants --

do $$
declare t text;
begin
  foreach t in array array['offering_sends']
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

revoke all on public.v_offering_costing from anon;
grant select on public.v_offering_costing to authenticated, service_role;

-- The new table has to claim alongside everything else on first sign-in.
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
    'offering_sends', 'goals', 'goal_entries', 'weekly_targets',
    'weekly_scores', 'daily_tasks', 'alerts'
  ]
  loop
    execute format('update public.%I set owner_id = $1 where owner_id is null', t)
      using new.id;
  end loop;

  return new;
end;
$$;

revoke all on function public.claim_orphaned_rows() from public, anon, authenticated;

-- ------------------------------------------------------------- storage ---

-- Guarded because the throwaway Postgres that scripts/verify-sql.sh builds has
-- no storage schema — that is Supabase's, not ours.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('offering-pdfs', 'offering-pdfs', false, 20971520, array['application/pdf'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    -- Private bucket: only a signed-in owner touches their own folder, which is
    -- keyed by their user id. anon gets nothing.
    execute $p$drop policy if exists offering_pdfs_select on storage.objects$p$;
    execute $p$drop policy if exists offering_pdfs_insert on storage.objects$p$;
    execute $p$drop policy if exists offering_pdfs_update on storage.objects$p$;
    execute $p$drop policy if exists offering_pdfs_delete on storage.objects$p$;

    execute $p$create policy offering_pdfs_select on storage.objects
      for select to authenticated
      using (bucket_id = 'offering-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy offering_pdfs_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'offering-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy offering_pdfs_update on storage.objects
      for update to authenticated
      using (bucket_id = 'offering-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'offering-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy offering_pdfs_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'offering-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
