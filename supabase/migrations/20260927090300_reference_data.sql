-- Styfe HQ — reference data: spend categories and the auto-categorisation rules.
-- These are Dan's rows (owner_id resolves through public.seed_owner()) and are
-- fully editable from Settings, so this migration only establishes the defaults.

insert into public.categories (slug, label, "group", color, recurring, sort) values
  -- income -----------------------------------------------------------------
  ('income_proto',             'Proto Trading',      'income',   '#1D6B4F', true,  10),
  ('income_ie_global',         'IE Global salary',   'income',   '#1D6B4F', true,  20),
  ('income_britos',            'Britos',             'income',   '#C9A77A', false, 30),
  ('income_client_unlabelled', 'Client — unlabelled','income',   '#C9A77A', false, 40),
  ('income_other',             'Other income',       'income',   '#C9A77A', false, 50),
  -- internal ---------------------------------------------------------------
  ('internal_transfer',        'Internal transfer',  'internal', '#A8A396', false, 60),
  -- business ---------------------------------------------------------------
  ('software_tools',           'Software & tools',   'business', '#2F5D8A', false, 70),
  ('phone_data',               'Phone & data',       'business', '#2F5D8A', false, 80),
  ('bank_fees',                'Bank fees',          'business', '#2F5D8A', false, 90),
  ('utilities',                'Utilities',          'business', '#2F5D8A', false, 100),
  ('debit_order_reversal',     'Debit order unpaid', 'business', '#8A3E12', false, 110),
  -- personal ---------------------------------------------------------------
  ('eating_out',               'Eating out',         'personal', '#8A3E12', false, 120),
  ('transport_uber',           'Uber rides',         'personal', '#8A3E12', false, 130),
  ('food_delivery',            'Food delivery',      'personal', '#8A3E12', false, 140),
  ('groceries',                'Groceries',          'personal', '#8A3E12', false, 150),
  ('grooming',                 'Grooming',           'personal', '#8A3E12', false, 160),
  ('health_fitness',           'Health & fitness',   'personal', '#8A3E12', false, 170),
  ('shopping',                 'Shopping',           'personal', '#8A3E12', false, 180),
  ('betting',                  'Betting',            'personal', '#8A3E12', false, 190),
  ('travel',                   'Travel',             'personal', '#8A3E12', false, 200),
  ('family',                   'Family',             'personal', '#8A3E12', false, 210),
  ('crypto',                   'Crypto',             'personal', '#8A3E12', false, 220),
  ('p2p_out',                  'Person to person',   'personal', '#8A3E12', false, 230),
  ('other',                    'Other',              'personal', '#5E5B55', false, 240)
on conflict (slug) do update
  set label     = excluded.label,
      "group"   = excluded."group",
      color     = excluded.color,
      recurring = excluded.recurring,
      sort      = excluded.sort;

-- Rules run in priority order, first match wins. Patterns are POSIX regex
-- matched case-insensitively against the transaction description.
insert into public.category_rules (pattern, category, priority, note) values
  ('Payment To Investment|FNB App Transfer (To|From)|Payshap Account On-Us|Payshap Credit D Mayele Joffe|Investment Deposit',
                                                    'internal_transfer',    10,  'Money moved between Dan''s own accounts'),
  ('Luno|Yellow Card|Binance|Valr',                 'crypto',               15,  null),
  ('Patin|Ie Global',                               'income_ie_global',     20,  'Salary, paid as Patin Trading 84 T/A'),
  ('Magtape Credit Proto',                          'income_proto',         25,  'Retainer'),
  ('Britos',                                        'income_britos',        30,  null),
  ('Unpaid|Rm Ction|Rm Internal',                   'debit_order_reversal', 35,  'Returned debit order'),
  ('^$|^[0-9]{6}$|Hybrid Subscription Fee|Service Fee|Monthly Account Fee|Cash Dep Fee',
                                                    'bank_fees',            40,  'FNB posts fees with a blank or numeric description'),
  ('Prepaid Electricity|Electricity Prepaid',       'utilities',            45,  null),
  ('Uber Eats|Mr D|Sixty60',                        'food_delivery',        50,  'Must beat the Uber rides rule'),
  ('Uber|Bolt|Ben Vorster Motors',                  'transport_uber',       55,  null),
  ('Airtime|Mvno Payment|Cellular|Cellucity|Vodashop|Vodacom|Telkom|Rain Mobile',
                                                    'phone_data',           60,  null),
  ('Apple\.Com|Netflix|Microsoft|Google.?.?Workspace|Vercel|Openrouter|Higgsfield|Upfollow|Spotify|Github|Openai|Anthropic|Adobe|Canva|Notion|Figma|Supabase',
                                                    'software_tools',       65,  null),
  ('Virgin Act|Gymfee|Planet Fitness|Green Point Tennis|Tennis Club|Nu Health',
                                                    'health_fitness',       70,  null),
  ('Woolworths|Tajminimarket|Ok Minimarket|Checkersfx|PNA Sea Point|Frankie Fenner|Gramodi Gro|Seapointlongmar|Breestreetminis|Pick N Pay|Shoprite|Sans Grocer',
                                                    'groceries',            75,  null),
  ('Betway|Hollywoodbets|Sportingbet|Supabets',     'betting',              80,  null),
  ('Flysafair|Kulula|Airlink|British Airways|Booking\.Com|Airbnb',
                                                    'travel',               85,  null),
  ('Takealot|Smw 0750|Ae Green Point|Mila Morgan|Drama Cape Town|Superbalist|Zando',
                                                    'shopping',             90,  null),
  ('Nandos|Mugg And Bean|Yoco \*|Yustras|Market Kokoro|President Hotel|Caprice|Hudson|Mcd |Andiccio|Halo Night Club|Giovanni Esposito|Station On Bree|Vida E Caffe|Tabbs \*|Kolonaki|Mochachos|Aperitif|Paul 12|Liquorshop|Green Dot Cafe|KFC|Tin Roof|Streetbar|Cock N Bull|Relish|Broke Klubhouse|Sterkinekor|Charles Hope|Adderley Fl|Restaurant|Coffee|Pizza|Burger',
                                                    'eating_out',           95,  null),
  ('FNB App Payment From (Papa|Mama|Maman|Mm D|Mmm+|Nnn+|Heee+|Bank)',
                                                    'family',               100, 'Money in from family'),
  ('Send Money App|Payshap Account Off-Us|FNB App (Geo )?Payment To|Payshapid Off-Us',
                                                    'p2p_out',              105, null),
  ('Barber|Hairdress|Salon|Grooming',               'grooming',             110, null),
  ('Dis-Chem|Clicks Pharm|Schd Trxn|No Av Bal',       'other',                115, null)
on conflict do nothing;

-- Settings singleton + the default "path to R50k" segments. Both are guarded on
-- existence rather than ON CONFLICT because owner_id may still be null before
-- Dan's first login (see scripts/claim-seed.ts).
insert into public.settings (business_name, business_details, invoice_prefix, next_invoice_number)
select 'Styfe',
       E'Styfe\nCape Town, South Africa\ndanieljoffeinfo@gmail.com',
       'STY', 1
where not exists (select 1 from public.settings);

insert into public.path_segments (slug, label, target_zar, source, offering_slug, category, target_units, color, sort)
select * from (values
  ('proto',      'Proto retainer',        8000::numeric,  'subscriptions',    'proto-retainer', null,       1, '#1D6B4F', 10),
  ('retainers',  '2 new retainers',       15000::numeric, 'subscriptions',    null,             'Retainer', 2, '#9CC3B0', 20),
  ('moto-desk',  'Moto Desk × 2 dealers', 16000::numeric, 'subscriptions',    'moto-desk',      null,       2, '#2F5D8A', 30),
  ('projects',   'Project work',          11000::numeric, 'project_average',  null,             null,    null, '#E7DCC8', 40)
) as v(slug, label, target_zar, source, offering_slug, category, target_units, color, sort)
where not exists (select 1 from public.path_segments);
