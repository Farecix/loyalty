-- 0003: puan alma

create or replace function public.haversine_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Puan eklendikten sonra çağrılır: eşiğe ulaşılan ödülleri verir, gerekirse döngüyü sıfırlar.
-- Çağıran, müşteri satırını kilitlemiş olmalı. Yeni ödülleri jsonb dizi olarak döndürür.
create or replace function public.issue_grants(p_customer uuid, p_stamp uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c customers; st stamps; v_progress int; v_len int; v_max reward_rules; v_out jsonb := '[]'::jsonb; g reward_grants; r reward_rules;
begin
  select * into c from customers where id = p_customer;
  select * into st from stamps where id = p_stamp;
  v_progress := customer_progress(p_customer);
  v_len := shop_cycle_length(c.shop_id);

  for r in select * from reward_rules where shop_id = c.shop_id and active and threshold = v_progress loop
    insert into reward_grants (shop_id, customer_id, rule_id, stamp_id, title_th, title_en)
    values (c.shop_id, c.id, r.id, st.id, r.title_th, r.title_en) returning * into g;
    v_out := v_out || jsonb_build_object('id', g.id, 'title_th', g.title_th, 'title_en', g.title_en);
  end loop;

  if v_progress >= v_len then
    -- Kurallar döngü ortasında küçüldüyse en yüksek ödül yine de bir kez verilir.
    select * into v_max from reward_rules where shop_id = c.shop_id and active order by threshold desc limit 1;
    if found and v_max.threshold <> v_progress then
      insert into reward_grants (shop_id, customer_id, rule_id, stamp_id, title_th, title_en)
      values (c.shop_id, c.id, v_max.id, st.id, v_max.title_th, v_max.title_en) returning * into g;
      v_out := v_out || jsonb_build_object('id', g.id, 'title_th', g.title_th, 'title_en', g.title_en);
    end if;
    update stamps set prev_cycle_reset_at = c.cycle_reset_at where id = st.id;
    update customers set cycle_reset_at = st.created_at where id = c.id;
  end if;
  return v_out;
end $$;
revoke execute on function public.issue_grants(uuid, uuid) from public, anon, authenticated;

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

  -- Davet: bu müşterinin ilk aktif puanıysa davet edene +1.
  if c.referred_by is not null
     and (select count(*) from stamps where customer_id = c.id and source = 'card' and cancelled_at is null) = 1
     and not exists (select 1 from stamps rs join stamps own on own.id = rs.referral_for_stamp_id
                     where own.customer_id = c.id and rs.cancelled_at is null) then
    perform 1 from customers where id = c.referred_by for update;
    insert into stamps (shop_id, customer_id, source, referral_for_stamp_id)
    values (s.id, c.referred_by, 'referral', v_stamp.id) returning * into v_ref_stamp;
    perform issue_grants(c.referred_by, v_ref_stamp.id);
  end if;

  return jsonb_build_object('status', 'ok', 'new_grants', v_grants, 'card', card_json(c.id));
end $$;
revoke execute on function public.claim_stamp(text, float8, float8, float8) from public, anon;
grant execute on function public.claim_stamp(text, float8, float8, float8) to authenticated;
