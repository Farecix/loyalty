-- 0010: konum kontrolü berberin ayarı (varsayılan KAPALI). Bekleme süresi her zaman geçerli.
alter table public.shops add column if not exists location_check boolean not null default false;

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

  if s.location_check and s.lat is not null and s.lng is not null then
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

create or replace function public.card_json(p_customer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.name, 'invite_code', c.invite_code),
    'shop', jsonb_build_object('name', sh.name, 'logo_url', sh.logo_url, 'location_check', sh.location_check),
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


create or replace function public.shop_public(p_shop_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  s := shop_by_code(p_shop_code);
  return jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'location_check', s.location_check);
end $$;
