-- Styfe HQ — row level security
--
-- Two gates on every table:
--   1. the row's owner_id must equal auth.uid()
--   2. the signed-in email must be on the allowlist
-- The publishable (anon) key carries no auth.uid() and no email claim, so it
-- reads and writes nothing, which is the point.

create table if not exists public.allowed_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);

insert into public.allowed_emails (email)
values ('danieljoffeinfo@gmail.com')
on conflict (email) do nothing;

alter table public.allowed_emails enable row level security;
-- No policies: the table is readable only through the security-definer function
-- below, never directly by a client.

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.allowed_emails a
      where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

revoke all on function public.is_allowed_user() from public;
grant execute on function public.is_allowed_user() to authenticated, anon, service_role;

create or replace function public.owns(row_owner uuid)
returns boolean
language sql
stable
as $$
  select row_owner is not null
     and row_owner = auth.uid()
     and public.is_allowed_user();
$$;

grant execute on function public.owns(uuid) to authenticated, anon, service_role;

-- Apply the same four policies to every owned table.
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
  end loop;
end $$;

-- RLS is not FORCEd, so the table owner (postgres) and service_role still
-- bypass it. That is deliberate: migrations, seeding and the CSV import run
-- server-side with the secret key. Anything holding only the publishable key
-- authenticates as `anon`, which has no table grants and no passing policy.

revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
