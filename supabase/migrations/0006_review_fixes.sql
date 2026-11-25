-- 0006: inceleme düzeltmeleri

-- (1) Davet puanı: davet eden başına bekleme süresi içinde en fazla 1.
create or replace function public.claim_stamp(p_shop_code text, p_lat float8, p_lng float8, p_accuracy float8)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s shops; c customers; v_last timestamptz; v_next timestamptz; v_stamp stamps; v_ref_stamp stamps;
  v_grants jsonb; v_dist float8;
begin
  s := shop_by_code(p_shop_code);
  select * into c from customers where shop_id = s.id and auth_user_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('status', 'not_registered');
  end if;

  if s.lat is not null and s.lng is not null then
    if p_lat is null or p_lng is null then
      return jsonb_build_object('status', 'too_far', 'card', card_json(c.id));
    end if;
    v_dist := haversine_m(s.lat, s.lng, p_lat, p_lng) - least(greatest(coalesce(p_accuracy, 0), 0), 1000);
    if v_dist > s.radius_m then
      return jsonb_build_object('status', 'too_far', 'card', card_json(c.id));
    end if;
  end if;

  select max(created_at) into v_last from stamps
  where customer_id = c.id and source = 'card' and cancelled_at is null;
  v_next := v_last + make_interval(hours => s.cooldown_hours);
  if v_next is not null and v_next > now() then
    return jsonb_build_object('status', 'cooldown', 'next_allowed_at', v_next, 'card', card_json(c.id));
  end if;

  insert into stamps (shop_id, customer_id, source) values (s.id, c.id, 'card') returning * into v_stamp;
  v_grants := issue_grants(c.id, v_stamp.id);

  if c.referred_by is not null
     and (select count(*) from stamps where customer_id = c.id and source = 'card' and cancelled_at is null) = 1
     and not exists (select 1 from stamps rs join stamps own on own.id = rs.referral_for_stamp_id
                     where own.customer_id = c.id and rs.cancelled_at is null) then
    perform 1 from customers where id = c.referred_by for update;
    if not exists (select 1 from stamps where customer_id = c.referred_by and source = 'referral' and cancelled_at is null
                   and created_at > now() - make_interval(hours => greatest(s.cooldown_hours, 1))) then
      insert into stamps (shop_id, customer_id, source, referral_for_stamp_id)
      values (s.id, c.referred_by, 'referral', v_stamp.id) returning * into v_ref_stamp;
      perform issue_grants(c.referred_by, v_ref_stamp.id);
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'new_grants', v_grants, 'card', card_json(c.id));
end $$;

-- (4) Personel telefon araması yerel biçimleri de bulur.
create or replace function public.shop_customers(p_search text) returns table (
  id uuid, name text, phone text, progress int, available int, last_visit timestamptz, created_at timestamptz,
  referred_count int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_shop uuid := staff_shop_id();
  v_q text := nullif(trim(coalesce(p_search, '')), '');
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
begin
  -- Baştaki 66 / 0 atılır: kalan rakamlar kayıtlı numaranın içinde aranır.
  v_digits := regexp_replace(regexp_replace(v_digits, '^66', ''), '^0', '');
  return query
  select c.id, c.name, c.phone, customer_progress(c.id),
    (select count(*)::int from reward_grants g where g.customer_id = c.id and g.redeemed_at is null and g.voided_at is null),
    (select max(s.created_at) from stamps s where s.customer_id = c.id and s.source = 'card' and s.cancelled_at is null),
    c.created_at,
    (select count(*)::int from customers r where r.referred_by = c.id)
  from customers c
  where c.shop_id = v_shop
    and (v_q is null or c.name ilike '%' || v_q || '%' or (v_digits <> '' and c.phone like '%' || v_digits || '%'))
  order by c.created_at desc
  limit 500;
end $$;

-- (5b) Akış: puanı iptal edilmiş kullanılmış ödül işaretlenir.
drop function public.shop_feed();
create function public.shop_feed() returns table (
  kind text, id uuid, customer_id uuid, customer_name text, title_th text, title_en text,
  source text, at timestamptz, cancelled boolean, stamp_cancelled boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select shop_id from shop_staff where user_id = auth.uid())
  select * from (
    select 'stamp'::text, s.id, c.id, c.name, null::text, null::text, s.source, s.created_at, s.cancelled_at is not null, false
    from stamps s join customers c on c.id = s.customer_id where s.shop_id in (select shop_id from me)
    union all
    select 'redeem', g.id, c.id, c.name, g.title_th, g.title_en, null, g.redeemed_at, false,
      coalesce((select st.cancelled_at is not null from stamps st where st.id = g.stamp_id), false)
    from reward_grants g join customers c on c.id = g.customer_id
    where g.shop_id in (select shop_id from me) and g.redeemed_at is not null
  ) f order by 8 desc limit 200
$$;
revoke execute on function public.shop_feed() from public, anon;
grant execute on function public.shop_feed() to authenticated;
