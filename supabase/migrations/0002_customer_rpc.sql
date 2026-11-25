-- 0002: telefon normalizasyonu, müşteri kaydı, kart okuma

-- Tayland numarası: rakam dışı at; baştaki 0 → 66; 66 yoksa başa ekle.
create or replace function public.normalize_phone(p text) returns text
language sql immutable as $$
  select case
    when d = '' then ''
    when d like '66%' then d
    when d like '0%' then '66' || substr(d, 2)
    else '66' || d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

create or replace function public.shop_by_code(p_code text) returns public.shops
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  select * into s from shops where card_code = p_code;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  return s;
end $$;
revoke execute on function public.shop_by_code(text) from public, anon, authenticated;

create or replace function public.shop_cycle_length(p_shop uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(threshold), 10) from reward_rules where shop_id = p_shop and active
$$;

create or replace function public.customer_progress(p_customer uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from stamps s join customers c on c.id = s.customer_id
  where s.customer_id = p_customer and s.cancelled_at is null and s.created_at > c.cycle_reset_at
$$;

-- Kartın JSON hâli (iç kullanım; get_my_card ve claim_stamp döndürür).
create or replace function public.card_json(p_customer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.name, 'invite_code', c.invite_code),
    'shop', jsonb_build_object('name', sh.name),
    'progress', public.customer_progress(c.id),
    'cycle_length', public.shop_cycle_length(c.shop_id),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('threshold', r.threshold, 'title_th', r.title_th, 'title_en', r.title_en) order by r.threshold)
                       from reward_rules r where r.shop_id = c.shop_id and r.active), '[]'::jsonb),
    'available', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title_th', g.title_th, 'title_en', g.title_en, 'created_at', g.created_at) order by g.created_at)
                           from reward_grants g where g.customer_id = c.id and g.redeemed_at is null and g.voided_at is null), '[]'::jsonb),
    'last_stamp_at', ls.created_at,
    'next_allowed_at', case when ls.created_at + make_interval(hours => sh.cooldown_hours) > now()
                            then ls.created_at + make_interval(hours => sh.cooldown_hours) end
  )
  from customers c
  join shops sh on sh.id = c.shop_id
  left join lateral (select created_at from stamps where customer_id = c.id and source = 'card' and cancelled_at is null
                     order by created_at desc limit 1) ls on true
  where c.id = p_customer
$$;
revoke execute on function public.card_json(uuid) from public, anon, authenticated;
revoke execute on function public.customer_progress(uuid) from public, anon, authenticated;

create or replace function public.register_customer(
  p_shop_code text, p_name text, p_phone text, p_ref_code text default null, p_pdpa boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s shops; v_phone text; v_id uuid; v_ref uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  s := shop_by_code(p_shop_code);
  select id into v_id from customers where shop_id = s.id and auth_user_id = auth.uid();
  if found then return v_id; end if;
  if not coalesce(p_pdpa, false) then raise exception 'PDPA_REQUIRED'; end if;
  v_phone := normalize_phone(p_phone);
  if v_phone !~ '^66[0-9]{8,9}$' then raise exception 'PHONE_INVALID'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'NAME_REQUIRED'; end if;
  if exists (select 1 from customers where shop_id = s.id and phone = v_phone) then raise exception 'PHONE_TAKEN'; end if;
  if p_ref_code is not null then
    select id into v_ref from customers where shop_id = s.id and invite_code = p_ref_code;
  end if;
  insert into customers (shop_id, auth_user_id, name, phone, referred_by, pdpa_accepted_at)
  values (s.id, auth.uid(), left(trim(p_name), 80), v_phone, v_ref, now())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'PHONE_TAKEN';
end $$;
revoke execute on function public.register_customer(text, text, text, text, boolean) from public, anon;
grant execute on function public.register_customer(text, text, text, text, boolean) to authenticated;

create or replace function public.get_my_card(p_shop_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops; v_id uuid;
begin
  s := shop_by_code(p_shop_code);
  select id into v_id from customers where shop_id = s.id and auth_user_id = auth.uid();
  if v_id is null then return null; end if;
  return card_json(v_id);
end $$;
revoke execute on function public.get_my_card(text) from public, anon;
grant execute on function public.get_my_card(text) to authenticated;

-- Kayıt öncesi dükkân adı (müşteri formunda göstermek için; kodu bilen herkes görebilir).
create or replace function public.shop_public(p_shop_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  s := shop_by_code(p_shop_code);
  return jsonb_build_object('name', s.name);
end $$;
grant execute on function public.shop_public(text) to anon, authenticated;
