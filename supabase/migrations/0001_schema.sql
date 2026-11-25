-- 0001: tablolar, indeksler, RLS
-- Her tablo shop_id taşır (ileride çok berber).

-- Tahmin edilemez kısa kod (gen_random_uuid kriptografik rastgele).
create or replace function public.gen_code(n int) returns text
language sql volatile as $$
  select substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, n)
$$;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  card_code text not null unique default public.gen_code(16),
  lat double precision,
  lng double precision,
  radius_m int not null default 100 check (radius_m between 10 and 5000),
  cooldown_hours int not null default 20 check (cooldown_hours between 0 and 168),
  created_at timestamptz not null default now()
);

create table public.shop_staff (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (shop_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 80),
  phone text not null,
  invite_code text not null unique default public.gen_code(8),
  referred_by uuid references public.customers(id) on delete set null,
  pdpa_accepted_at timestamptz not null,
  cycle_reset_at timestamptz not null default '-infinity',
  created_at timestamptz not null default now(),
  unique (shop_id, phone),
  unique (shop_id, auth_user_id)
);

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  source text not null check (source in ('card', 'referral')),
  referral_for_stamp_id uuid references public.stamps(id) on delete set null,
  prev_cycle_reset_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz
);
create index stamps_customer_idx on public.stamps (customer_id, created_at desc);
create index stamps_shop_idx on public.stamps (shop_id, created_at desc);
create index stamps_referral_idx on public.stamps (referral_for_stamp_id) where referral_for_stamp_id is not null;

create table public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  threshold int not null check (threshold between 1 and 100),
  title_th text not null check (length(trim(title_th)) > 0),
  title_en text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index reward_rules_active_threshold on public.reward_rules (shop_id, threshold) where active;

create table public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rule_id uuid references public.reward_rules(id) on delete set null,
  stamp_id uuid references public.stamps(id) on delete set null,
  title_th text not null,
  title_en text,
  created_at timestamptz not null default clock_timestamp(),
  redeemed_at timestamptz,
  voided_at timestamptz
);
create index reward_grants_customer_idx on public.reward_grants (customer_id);
create index reward_grants_stamp_idx on public.reward_grants (stamp_id);

create table public.login_links (
  token text primary key default public.gen_code(32),
  customer_id uuid not null references public.customers(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Yardımcılar ----------
create or replace function public.is_staff(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_staff where shop_id = p_shop and user_id = auth.uid())
$$;

create or replace function public.my_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from customers where auth_user_id = auth.uid()
$$;

-- ---------- RLS ----------
alter table public.shops enable row level security;
alter table public.shop_staff enable row level security;
alter table public.customers enable row level security;
alter table public.stamps enable row level security;
alter table public.reward_rules enable row level security;
alter table public.reward_grants enable row level security;
alter table public.login_links enable row level security;

-- Yazma yalnız RPC ile (rules/shops hariç: personel doğrudan düzenler).
revoke insert, update, delete on public.shop_staff, public.customers, public.stamps,
  public.reward_grants, public.login_links from anon, authenticated;
revoke insert, delete on public.shops from anon, authenticated;
revoke all on public.login_links from anon, authenticated;
revoke all on public.shops, public.reward_rules, public.shop_staff, public.customers,
  public.stamps, public.reward_grants from anon;

create policy shops_staff_read on public.shops for select to authenticated using (public.is_staff(id));
create policy shops_staff_update on public.shops for update to authenticated using (public.is_staff(id)) with check (public.is_staff(id));

create policy staff_self_read on public.shop_staff for select to authenticated using (user_id = auth.uid());

create policy customers_read on public.customers for select to authenticated
  using (auth_user_id = auth.uid() or public.is_staff(shop_id));

create policy stamps_read on public.stamps for select to authenticated
  using (customer_id in (select public.my_customer_ids()) or public.is_staff(shop_id));

create policy grants_read on public.reward_grants for select to authenticated
  using (customer_id in (select public.my_customer_ids()) or public.is_staff(shop_id));

create policy rules_staff_all on public.reward_rules for all to authenticated
  using (public.is_staff(shop_id)) with check (public.is_staff(shop_id));

-- Realtime (panel canlı akışı)
alter publication supabase_realtime add table public.stamps, public.reward_grants;
