-- Styfe HQ — the account a client actually pays into.
--
-- Banking sat inside settings.business_details, a free-text blob printed under
-- the business name. That is fine for an address and useless for a bank
-- account: it cannot be laid out as a labelled block, and a typo in an account
-- number is the one mistake on an invoice that costs real money.

alter table public.settings
  add column if not exists bank_name        text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_branch_code text,
  add column if not exists bank_swift       text,
  add column if not exists payment_reference text;

comment on column public.settings.payment_reference is
  'What the client should use as their payment reference. The invoice number is used when this is blank.';
