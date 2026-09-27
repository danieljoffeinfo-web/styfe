-- Styfe HQ — claim orphaned reference rows when the owner's auth user appears.
--
-- The reference-data migration inserts through public.seed_owner(), which
-- returns null when Dan's auth user does not exist yet. That is exactly the
-- case on a project that has only ever been migrated — nobody has signed in,
-- so there is no auth.users row to resolve. Those rows then carry a null
-- owner_id, and public.owns() requires owner_id = auth.uid(), so RLS hides the
-- categories, the rules, the settings singleton and the path segments from him
-- for ever: Settings renders empty and next_invoice_number() raises.
--
-- seed/seed.sql and scripts/claim-seed.ts already repair this, but both run
-- through the secret key, which a deploy does not have. Doing it on insert
-- makes a migrate-only project correct itself on first login, and it is a
-- no-op once nothing is orphaned.

create or replace function public.claim_orphaned_rows()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare t text;
begin
  -- Only the allow-listed owner claims anything.
  if not exists (
    select 1 from public.allowed_emails a
    where a.email = lower(coalesce(new.email, ''))
  ) then
    return new;
  end if;

  foreach t in array array[
    'settings', 'path_segments', 'categories', 'category_rules', 'clients',
    'offerings', 'offering_tiers', 'subscriptions', 'invoices', 'invoice_lines',
    'transactions', 'deals', 'goals', 'goal_entries', 'weekly_targets',
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

drop trigger if exists claim_orphaned_rows on auth.users;
create trigger claim_orphaned_rows
  after insert on auth.users
  for each row execute function public.claim_orphaned_rows();
