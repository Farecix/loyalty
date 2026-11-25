-- 0004: ödül kullanma, iptal, giriş linki, dükkân yönetimi, akış

alter table public.shops add column if not exists logo_url text;

create or replace function public.require_staff(p_shop uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff(p_shop) then raise exception 'NOT_STAFF'; end if;
end $$;

create or replace function public.staff_shop_id() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select shop_id into v from shop_staff where user_id = auth.uid() limit 1;
  if v is null then raise exception 'NOT_STAFF'; end if;
  return v;
end $$;

create or replace function public.redeem_grant(p_grant_id uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  update reward_grants g set redeemed_at = now()
  where g.id = p_grant_id and g.redeemed_at is null and g.voided_at is null
    and g.customer_id in (select id from customers where auth_user_id = auth.uid())
  returning redeemed_at into v;
  if v is null then raise exception 'GRANT_NOT_AVAILABLE'; end if;
  return v;
end $$;

create or replace function public.cancel_stamp(p_stamp_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare st stamps; c customers; ref_id uuid;
begin
  select * into st from stamps where id = p_stamp_id;
  if not found then raise exception 'NOT_STAFF'; end if;
  perform require_staff(st.shop_id);
  select * into c from customers where id = st.customer_id for update;
  if st.cancelled_at is not null then return; end if;

  update stamps set cancelled_at = now() where id = st.id;
  update reward_grants set voided_at = now()
  where stamp_id = st.id and redeemed_at is null and voided_at is null;
  if st.prev_cycle_reset_at is not null and c.cycle_reset_at = st.created_at then
    update customers set cycle_reset_at = st.prev_cycle_reset_at where id = c.id;
  end if;

  for ref_id in select id from stamps where referral_for_stamp_id = st.id and cancelled_at is null loop
    perform cancel_stamp(ref_id);
  end loop;
end $$;

create or replace function public.undo_redemption(p_grant_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g reward_grants;
begin
  select * into g from reward_grants where id = p_grant_id;
  if not found then raise exception 'NOT_STAFF'; end if;
  perform require_staff(g.shop_id);
  update reward_grants set redeemed_at = null where id = g.id;
end $$;

create or replace function public.create_login_link(p_customer_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c customers; v text;
begin
  select * into c from customers where id = p_customer_id;
  if not found then raise exception 'NOT_STAFF'; end if;
  perform require_staff(c.shop_id);
  insert into login_links (customer_id) values (c.id) returning token into v;
  return v;
end $$;

-- Linki kullanan cihazın oturumunu müşteriye bağlar; yönlendirme için dükkân kart kodunu döndürür.
create or replace function public.consume_login_link(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare l login_links; v_code text; v_shop uuid;
begin
  if auth.uid() is null then raise exception 'LINK_INVALID'; end if;
  select * into l from login_links where token = p_token for update;
  if not found or l.used_at is not null or l.expires_at < now() then raise exception 'LINK_INVALID'; end if;
  select shop_id into v_shop from customers where id = l.customer_id;
  -- Bu cihazın aynı dükkânda başka (boş) bir kaydı varsa çakışmayı önlemek için ayır.
  update customers set auth_user_id = null where shop_id = v_shop and auth_user_id = auth.uid() and id <> l.customer_id;
  update customers set auth_user_id = auth.uid() where id = l.customer_id;
  update login_links set used_at = now() where token = l.token;
  select card_code into v_code from shops where id = v_shop;
  return v_code;
end $$;

create or replace function public.create_shop(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select shop_id into v from shop_staff where user_id = auth.uid() limit 1;
  if v is not null then return v; end if;
  insert into shops (name) values (coalesce(nullif(trim(p_name), ''), 'Barber')) returning id into v;
  insert into shop_staff (shop_id, user_id) values (v, auth.uid());
  insert into reward_rules (shop_id, threshold, title_th, title_en) values
    (v, 5, 'ล้างผมฟรี', 'Free hair wash'),
    (v, 10, 'ตัดผมฟรี', 'Free haircut');
  return v;
end $$;

create or replace function public.my_shop() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) from shops s join shop_staff ss on ss.shop_id = s.id where ss.user_id = auth.uid() limit 1
$$;

create or replace function public.regenerate_card_code() returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  update shops set card_code = gen_code(16) where id = staff_shop_id() returning card_code into v;
  return v;
end $$;

create or replace function public.shop_feed() returns table (
  kind text, id uuid, customer_id uuid, customer_name text, title_th text, title_en text,
  source text, at timestamptz, cancelled boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select shop_id from shop_staff where user_id = auth.uid())
  select * from (
    select 'stamp'::text, s.id, c.id, c.name, null::text, null::text, s.source, s.created_at, s.cancelled_at is not null
    from stamps s join customers c on c.id = s.customer_id where s.shop_id in (select shop_id from me)
    union all
    select 'redeem', g.id, c.id, c.name, g.title_th, g.title_en, null, g.redeemed_at, false
    from reward_grants g join customers c on c.id = g.customer_id
    where g.shop_id in (select shop_id from me) and g.redeemed_at is not null
  ) f order by 8 desc limit 200
$$;

create or replace function public.shop_customers(p_search text) returns table (
  id uuid, name text, phone text, progress int, available int, last_visit timestamptz, created_at timestamptz,
  referred_count int
)
language plpgsql stable security definer set search_path = public as $$
declare v_shop uuid := staff_shop_id(); v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  return query
  select c.id, c.name, c.phone, customer_progress(c.id),
    (select count(*)::int from reward_grants g where g.customer_id = c.id and g.redeemed_at is null and g.voided_at is null),
    (select max(s.created_at) from stamps s where s.customer_id = c.id and s.source = 'card' and s.cancelled_at is null),
    c.created_at,
    (select count(*)::int from customers r where r.referred_by = c.id)
  from customers c
  where c.shop_id = v_shop
    and (v_q is null or c.name ilike '%' || v_q || '%' or c.phone like '%' || regexp_replace(v_q, '\D', '', 'g') || '%' and regexp_replace(v_q, '\D', '', 'g') <> '')
  order by c.created_at desc
  limit 500;
end $$;

-- Yetkiler: iç yardımcılar kapalı, RPC'ler yalnız oturumlu kullanıcıya.
revoke execute on function public.require_staff(uuid), public.staff_shop_id() from public, anon, authenticated;
revoke execute on function public.redeem_grant(uuid), public.cancel_stamp(uuid), public.undo_redemption(uuid),
  public.create_login_link(uuid), public.consume_login_link(text), public.create_shop(text), public.my_shop(),
  public.regenerate_card_code(), public.shop_feed(), public.shop_customers(text) from public, anon;
grant execute on function public.redeem_grant(uuid), public.cancel_stamp(uuid), public.undo_redemption(uuid),
  public.create_login_link(uuid), public.consume_login_link(text), public.create_shop(text), public.my_shop(),
  public.regenerate_card_code(), public.shop_feed(), public.shop_customers(text) to authenticated;
